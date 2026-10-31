import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { validateRegisterInput } from '@/lib/validators';
import { getRequestLocale } from '@/lib/i18n/server';
import { sendMail, buildEmailVerificationEmail } from '@/lib/mailer';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import {
  VERIFICATION_CODE_TTL_MINUTES,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
  createVerificationCode,
  deleteVerificationCodes,
  hasRecentVerificationRequest
} from '@/lib/emailVerification';

// Etape 1 de l'inscription : valide le formulaire, puis envoie un code a
// 6 chiffres a l'adresse indiquee. Le compte n'est PAS cree ici : les
// donnees (mot de passe deja hache) sont mises en attente jusqu'a la
// saisie du bon code (voir confirm.js).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const { isValid, errors, data } = validateRegisterInput(req.body || {});
  if (!isValid) {
    return res.status(422).json({ success: false, message: 'Donnees invalides', errors });
  }

  const limit = rateLimit(`register-code:${getClientIp(req)}`, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de demandes, reessayez dans quelques minutes' });
  }

  try {
    const existing = await query('SELECT id FROM user WHERE email = ? LIMIT 1', [data.email]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Un compte existe deja avec cette adresse email',
        errors: { email: 'Cette adresse email est deja utilisee' }
      });
    }

    if (await hasRecentVerificationRequest('register', data.email)) {
      return res.status(429).json({
        success: false,
        message: `Un code vient d'etre envoye, patientez ${VERIFICATION_RESEND_COOLDOWN_SECONDS} secondes avant d'en redemander un`,
        resendAfterSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS
      });
    }

    const passwordHash = await hashPassword(data.password);
    const code = await createVerificationCode({
      purpose: 'register',
      email: data.email,
      payload: {
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        gender: data.gender,
        birthDate: data.birthDate
      }
    });

    const mail = buildEmailVerificationEmail({ locale: getRequestLocale(req),
      firstName: data.firstName,
      code,
      expiresInMinutes: VERIFICATION_CODE_TTL_MINUTES,
      purpose: 'register'
    });

    try {
      await sendMail({ to: data.email, ...mail });
    } catch (mailError) {
      console.error('Echec envoi email de verification :', mailError);
      await deleteVerificationCodes('register', data.email);
      return res.status(502).json({
        success: false,
        message: "Impossible d'envoyer l'email pour le moment, reessayez plus tard"
      });
    }

    return res.status(200).json({
      success: true,
      message: `Un code de verification a 6 chiffres a ete envoye a ${data.email}.`,
      resendAfterSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur, veuillez reessayer' });
  }
}
