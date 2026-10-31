import { getUserFromRequest, comparePassword } from '@/lib/auth';
import { query } from '@/lib/db';
import { getRequestLocale } from '@/lib/i18n/server';
import { sendMail, buildEmailVerificationEmail } from '@/lib/mailer';
import { rateLimit } from '@/lib/rateLimit';
import {
  VERIFICATION_CODE_TTL_MINUTES,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
  createVerificationCode,
  deleteVerificationCodes,
  hasRecentVerificationRequest
} from '@/lib/emailVerification';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Etape 1 du changement d'email : verifie le mot de passe, puis envoie un
// code a la NOUVELLE adresse. L'email du compte n'est pas modifie tant que
// le code n'a pas ete saisi (voir confirm.js).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  const email = (req.body?.email || '').toString().trim().toLowerCase();
  const password = (req.body?.password || '').toString();

  if (!EMAIL_REGEX.test(email)) {
    return res.status(422).json({ success: false, message: 'Adresse email invalide' });
  }
  if (!password) {
    return res.status(422).json({ success: false, message: 'Mot de passe requis pour confirmer ce changement' });
  }

  const limit = rateLimit(`email-change:${payload.id}`, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de demandes, reessayez dans quelques minutes' });
  }

  try {
    const rows = await query('SELECT id, firstName, email, password FROM user WHERE id = ? LIMIT 1', [payload.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    const user = rows[0];

    if (!(await comparePassword(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
    }
    if (email === user.email) {
      return res.status(422).json({ success: false, message: "C'est deja votre adresse email actuelle" });
    }

    const existing = await query('SELECT id FROM user WHERE email = ? AND id != ? LIMIT 1', [email, payload.id]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Cette adresse email est deja utilisee' });
    }

    if (await hasRecentVerificationRequest('change_email', email)) {
      return res.status(429).json({
        success: false,
        message: `Un code vient d'etre envoye, patientez ${VERIFICATION_RESEND_COOLDOWN_SECONDS} secondes`,
        resendAfterSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS
      });
    }

    const code = await createVerificationCode({ purpose: 'change_email', email, userId: payload.id });
    const mail = buildEmailVerificationEmail({ locale: getRequestLocale(req),
      firstName: user.firstName,
      code,
      expiresInMinutes: VERIFICATION_CODE_TTL_MINUTES,
      purpose: 'change_email'
    });

    try {
      await sendMail({ to: email, ...mail });
    } catch (mailError) {
      console.error('Echec envoi email de changement :', mailError);
      await deleteVerificationCodes('change_email', email);
      return res.status(502).json({ success: false, message: "Impossible d'envoyer l'email pour le moment" });
    }

    return res.status(200).json({
      success: true,
      message: `Un code a 6 chiffres a ete envoye a ${email}.`,
      resendAfterSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
