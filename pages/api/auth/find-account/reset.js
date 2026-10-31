import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { consumeResetCode, deleteResetCodes } from '@/lib/passwordReset';

const INVALID_CODE_MESSAGE = 'Code invalide ou expire';

// Recuperation du compte : code recu par email + nouveau mot de passe,
// identifie par l'id du compte choisi.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const id = Number(req.body?.id);
  const code = (req.body?.code || '').toString().replace(/\s+/g, '');
  const password = (req.body?.password || '').toString();
  const errors = {};
  if (!Number.isInteger(id) || id <= 0) errors.id = 'Compte invalide';
  if (!/^\d{6}$/.test(code)) errors.code = 'Le code doit contenir 6 chiffres';
  if (password.length < 8) errors.password = 'Le mot de passe doit contenir au moins 8 caracteres';
  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ success: false, message: 'Donnees invalides', errors });
  }

  const limit = rateLimit(`find-account-reset:${getClientIp(req)}`, { max: 20, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de tentatives, reessayez dans quelques minutes' });
  }

  try {
    const rows = await query('SELECT id FROM user WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: INVALID_CODE_MESSAGE, errors: { code: INVALID_CODE_MESSAGE } });
    }

    const result = await consumeResetCode(id, code);
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

    await query('UPDATE user SET password = ? WHERE id = ?', [await hashPassword(password), id]);
    await deleteResetCodes(id);
    return res.status(200).json({ success: true, message: 'Mot de passe mis a jour' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur, veuillez reessayer' });
  }
}
