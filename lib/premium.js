import { query } from './db';
import { getSettings } from './settings';
import { createOrder, captureOrder, getPaypalMode, isPaypalConfigured } from './paypal';
import { invalidateUserStatus } from './auth';
import { createNotification } from './notifications';
import { sendMail } from './mailer';
import { APP_NAME } from './constants';
import { tr } from './i18n/server';

export const LIFETIME_DATE = '9999-12-31 23:59:59';

export function isPremiumDate(premiumUntil) {
  if (!premiumUntil) return false;
  const time = new Date(String(premiumUntil).replace(' ', 'T')).getTime();
  return Number.isFinite(time) && time > Date.now();
}

// Condition SQL reutilisable : "ce compte a un premium actif".
export const PREMIUM_ACTIVE_SQL = '(premiumUntil IS NOT NULL AND premiumUntil > NOW())';

export async function getPremiumConfig() {
  const s = await getSettings();
  const priceMad = Number(s.premium_price_mad);
  const rate = Number(s.premium_mad_rate);
  return {
    priceMad,
    chargeCurrency: s.premium_charge_currency,
    rate,
    chargeAmount: (Math.round(priceMad * rate * 100) / 100).toFixed(2),
    durationDays: Number(s.premium_duration_days),
    boostHours: Number(s.boost_hours),
    boostMaxActive: Number(s.boost_max_active),
    paypalConfigured: isPaypalConfigured(),
    paypalMode: getPaypalMode(),
    paypalClientId: getPaypalMode() === 'mock' ? 'mock' : process.env.PAYPAL_CLIENT_ID || null
  };
}

export async function getPremiumStatus(userId) {
  const rows = await query('SELECT premiumUntil, role FROM user WHERE id = ? LIMIT 1', [userId]);
  const premiumUntil = rows[0] ? rows[0].premiumUntil : null;
  // Les administrateurs ont Premium par defaut (a vie).
  const isAdmin = rows[0] ? rows[0].role === 'admin' : false;
  const active = isAdmin || isPremiumDate(premiumUntil);
  return {
    active,
    isAdmin,
    lifetime: isAdmin || (active && String(premiumUntil).startsWith('9999')),
    until: active ? premiumUntil : null
  };
}

// Prolonge le premium a partir de la fin actuelle (ou de maintenant).
// days = 0 : a vie.
export async function grantPremium(userId, days) {
  if (days === 0) {
    await query('UPDATE user SET premiumUntil = ? WHERE id = ?', [LIFETIME_DATE, userId]);
  } else {
    await query(
      `UPDATE user SET premiumUntil = DATE_ADD(
         IF(premiumUntil IS NOT NULL AND premiumUntil > NOW(), premiumUntil, NOW()), INTERVAL ? DAY)
       WHERE id = ?`,
      [days, userId]
    );
  }
  invalidateUserStatus(userId);
}

export async function revokePremium(userId) {
  await query('UPDATE user SET premiumUntil = NULL WHERE id = ?', [userId]);
  await query('DELETE FROM postBoost WHERE userId = ?', [userId]);
  invalidateUserStatus(userId);
}

// Etape 1 : le serveur fixe le montant et cree la commande PayPal.
export async function startCheckout(userId) {
  const config = await getPremiumConfig();
  if (!config.paypalConfigured) return { success: false, status: 503, message: "Le paiement n'est pas configure" };

  const order = await createOrder({
    amount: config.chargeAmount,
    currency: config.chargeCurrency,
    description: `Premium ${config.priceMad} MAD`,
    customId: String(userId)
  });
  await query(
    `INSERT INTO payment (userId, orderId, status, amountMad, chargeAmount, chargeCurrency, premiumDays)
     VALUES (?, ?, 'created', ?, ?, ?, ?)`,
    [userId, order.id, config.priceMad, config.chargeAmount, config.chargeCurrency, config.durationDays]
  );
  return { success: true, orderId: order.id };
}

// Etape 2 : capture apres approbation, verification du montant puis activation.
export async function completeCheckout(userId, orderId) {
  const rows = await query('SELECT * FROM payment WHERE orderId = ? AND userId = ? LIMIT 1', [orderId, userId]);
  const payment = rows[0];
  if (!payment) return { success: false, status: 404, message: 'Commande introuvable' };
  if (payment.status === 'completed') return { success: true, alreadyDone: true };

  const result = await captureOrder(orderId, { amount: Number(payment.chargeAmount).toFixed(2), currency: payment.chargeCurrency });
  const amountOk =
    result.status === 'COMPLETED' &&
    Number(result.amount).toFixed(2) === Number(payment.chargeAmount).toFixed(2) &&
    result.currency === payment.chargeCurrency;

  if (!amountOk) {
    await query("UPDATE payment SET status = 'failed' WHERE id = ?", [payment.id]);
    return { success: false, status: 402, message: 'Paiement non valide' };
  }

  // Verrou : un seul "completed" par commande, meme en cas d'appels concurrents.
  const update = await query(
    "UPDATE payment SET status = 'completed', captureId = ?, payerEmail = ?, completedAt = NOW() WHERE id = ? AND status <> 'completed'",
    [result.captureId, result.payerEmail, payment.id]
  );
  if (update.affectedRows === 1) {
    await grantPremium(userId, payment.premiumDays);
    await notifyPurchase(userId, payment);
  }
  return { success: true };
}

// Apres un achat : felicitations a l'acheteur (notification + email) et alerte
// pour tous les administrateurs. Jamais bloquant pour le paiement.
async function notifyPurchase(userId, payment) {
  try {
    const amountMad = Number(payment.amountMad);
    await createNotification({
      userId,
      actorId: userId,
      type: 'premiumWelcome',
      allowSelf: true,
      content: JSON.stringify({ d: payment.premiumDays })
    });

    const admins = await query("SELECT id FROM user WHERE role = 'admin' AND bannedAt IS NULL AND id <> ?", [userId]);
    for (const admin of admins) {
      // eslint-disable-next-line no-await-in-loop
      await createNotification({
        userId: admin.id,
        actorId: userId,
        type: 'premiumPurchase',
        content: JSON.stringify({ m: amountMad })
      });
    }
    if (global.io) {
      admins.forEach((admin) => global.io.to(`user:${admin.id}`).emit('admin:premium', { userId }));
    }

    const rows = await query('SELECT email, firstName, language FROM user WHERE id = ? LIMIT 1', [userId]);
    if (rows[0]) {
      const locale = rows[0].language || 'fr';
      try {
        await sendMail({
          to: rows[0].email,
          subject: tr(locale, '{app} - Bienvenue dans Premium !', { app: APP_NAME }),
          text: tr(locale, 'Felicitations {name} ! Votre compte est maintenant Premium : badge verifie, visiteurs du profil et boost de publications.', { name: rows[0].firstName }),
          html:
            `<div dir="${locale === 'ar' ? 'rtl' : 'ltr'}" style="font-family:Arial,sans-serif;max-width:460px;margin:auto;padding:24px;color:#1e293b">` +
            `<h2 style="margin:0 0 12px;color:#ea580c">${APP_NAME} Premium</h2>` +
            `<p>${tr(locale, 'Felicitations {name} ! Votre compte est maintenant Premium : badge verifie, visiteurs du profil et boost de publications.', { name: String(rows[0].firstName).replace(/[<>&"]/g, '') })}</p></div>`
        });
      } catch (error) {
        // email non critique
      }
    }
  } catch (error) {
    // les notifications ne doivent pas faire echouer un paiement deja encaisse
  }
}
