import { query } from '@/lib/db';
import { validateForgotPasswordInput } from '@/lib/validators';
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

// Meme reponse que le compte existe ou non : on ne revele pas quels emails
// sont inscrits.
const GENERIC_MESSAGE = 'Si un compte existe avec cette adresse, un code de verification vient d\'etre envoye.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const { isValid, errors, data } = validateForgotPasswordInput(req.body || {});
  if (!isValid) {
    return res.status(422).json({ success: false, message: 'Donnees invalides', errors });
  }

  const limit = rateLimit(`forgot:${getClientIp(req)}`, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de demandes, reessayez dans quelques minutes' });
  }

  try {
    const rows = await query('SELECT id, firstName FROM user WHERE email = ? LIMIT 1', [data.email]);
    const okResponse = {
      success: true,
      message: GENERIC_MESSAGE,
      resendAfterSeconds: RESET_RESEND_COOLDOWN_SECONDS
    };

    if (rows.length === 0) {
      return res.status(200).json(okResponse);
    }

    const user = rows[0];
    if (await hasRecentResetRequest(user.id)) {
      // Un code vient deja d'etre envoye : on n'en renvoie pas (anti-spam).
      return res.status(200).json(okResponse);
    }

    const code = await createResetCode(user.id);
    const mail = buildPasswordResetEmail({ locale: getRequestLocale(req),
      firstName: user.firstName,
      code,
      expiresInMinutes: RESET_CODE_TTL_MINUTES
    });

    try {
      await sendMail({ to: data.email, ...mail });
    } catch (mailError) {
      console.error('Echec envoi email de reinitialisation :', mailError);
      await deleteResetCodes(user.id);
      return res.status(502).json({
        success: false,
        message: 'Impossible d\'envoyer l\'email pour le moment, reessayez plus tard'
      });
    }

    return res.status(200).json(okResponse);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur, veuillez reessayer' });
  }
}
