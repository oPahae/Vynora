import { query } from '@/lib/db';
import { maskEmail } from '@/lib/accountRecovery';
import { getRequestLocale } from '@/lib/i18n/server';
import { sendMail, buildPasswordResetEmail } from '@/lib/mailer';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import {
  RESET_CODE_TTL_MINUTES,
  RESET_RESEND_COOLDOWN_SECONDS,
  createResetCode,
  deleteResetCodes,
  hasRecentResetRequest
} from '@/lib/passwordReset';

// Envoie le code de recuperation a l'email reel du compte choisi (que le
// navigateur ne connait jamais en clair).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const id = Number(req.body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(422).json({ success: false, message: 'Compte invalide' });
  }

  const limit = rateLimit(`find-account-send:${getClientIp(req)}`, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de demandes, reessayez dans quelques minutes' });
  }

  try {
    const rows = await query('SELECT id, firstName, email FROM user WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Compte introuvable' });
    const user = rows[0];

    const okResponse = {
      success: true,
      maskedEmail: maskEmail(user.email),
      resendAfterSeconds: RESET_RESEND_COOLDOWN_SECONDS
    };

    if (await hasRecentResetRequest(user.id)) return res.status(200).json(okResponse);

    const code = await createResetCode(user.id);
    const mail = buildPasswordResetEmail({ locale: getRequestLocale(req),
      firstName: user.firstName,
      code,
      expiresInMinutes: RESET_CODE_TTL_MINUTES
    });

    try {
      await sendMail({ to: user.email, ...mail });
    } catch (mailError) {
      console.error('Echec envoi email de recuperation :', mailError);
      await deleteResetCodes(user.id);
      return res.status(502).json({ success: false, message: "Impossible d'envoyer l'email pour le moment" });
    }

    return res.status(200).json(okResponse);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur, veuillez reessayer' });
  }
}
