import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { validateResetPasswordInput } from '@/lib/validators';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { consumeResetCode, deleteResetCodes } from '@/lib/passwordReset';

const INVALID_CODE_MESSAGE = 'Code invalide ou expire';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const { isValid, errors, data } = validateResetPasswordInput(req.body || {});
  if (!isValid) {
    return res.status(422).json({ success: false, message: 'Donnees invalides', errors });
  }

  const limit = rateLimit(`reset:${getClientIp(req)}`, { max: 20, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de tentatives, reessayez dans quelques minutes' });
  }

  try {
    const rows = await query('SELECT id FROM user WHERE email = ? LIMIT 1', [data.email]);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: INVALID_CODE_MESSAGE, errors: { code: INVALID_CODE_MESSAGE } });
    }

    const userId = rows[0].id;
    const result = await consumeResetCode(userId, data.code);

    if (!result.ok) {
      const message =
        result.reason === 'too_many_attempts'
          ? 'Trop de tentatives incorrectes, demandez un nouveau code'
          : INVALID_CODE_MESSAGE;
      return res.status(400).json({
        success: false,
        message,
        errors: { code: message },
        tooManyAttempts: result.reason === 'too_many_attempts'
      });
    }

    const hashedPassword = await hashPassword(data.password);
    await query('UPDATE user SET password = ? WHERE id = ?', [hashedPassword, userId]);
    await deleteResetCodes(userId);

    return res.status(200).json({ success: true, message: 'Mot de passe mis a jour' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur, veuillez reessayer' });
  }
}
