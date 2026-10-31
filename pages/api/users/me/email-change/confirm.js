import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { consumeVerificationCode, deleteVerificationCodes } from '@/lib/emailVerification';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_CODE_MESSAGE = 'Code invalide ou expire';

// Etape 2 : verifie le code recu a la nouvelle adresse puis applique le
// changement au compte.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  const email = (req.body?.email || '').toString().trim().toLowerCase();
  const code = (req.body?.code || '').toString().replace(/\s+/g, '');

  if (!EMAIL_REGEX.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(422).json({ success: false, message: 'Le code doit contenir 6 chiffres' });
  }

  const limit = rateLimit(`email-change-confirm:${payload.id}`, { max: 20, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de tentatives, reessayez dans quelques minutes' });
  }

  try {
    const result = await consumeVerificationCode({ purpose: 'change_email', email, code });
    // Le code doit avoir ete demande par CE compte.
    if (!result.ok || result.userId !== payload.id) {
      const message =
        result.reason === 'too_many_attempts'
          ? 'Trop de tentatives incorrectes, demandez un nouveau code'
          : INVALID_CODE_MESSAGE;
      return res.status(400).json({ success: false, message, tooManyAttempts: result.reason === 'too_many_attempts' });
    }

    const existing = await query('SELECT id FROM user WHERE email = ? AND id != ? LIMIT 1', [email, payload.id]);
    if (existing.length > 0) {
      await deleteVerificationCodes('change_email', email);
      return res.status(409).json({ success: false, message: 'Cette adresse email est deja utilisee' });
    }

    await query('UPDATE user SET email = ?, emailVerifiedAt = NOW() WHERE id = ?', [email, payload.id]);
    await deleteVerificationCodes('change_email', email);
    return res.status(200).json({ success: true, email });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
