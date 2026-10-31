import { query } from '@/lib/db';
import { readDeviceCookie, newDeviceId, buildDeviceCookie, recordLoginDevice } from '@/lib/devices';
import { signToken, buildAuthCookie } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { consumeVerificationCode, deleteVerificationCodes } from '@/lib/emailVerification';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_CODE_MESSAGE = 'Code invalide ou expire';

// Etape 2 de l'inscription : verifie le code puis cree reellement le compte
// avec les donnees mises en attente a l'etape 1.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const email = (req.body?.email || '').toString().trim().toLowerCase();
  const code = (req.body?.code || '').toString().replace(/\s+/g, '');

  if (!EMAIL_REGEX.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(422).json({
      success: false,
      message: 'Le code doit contenir 6 chiffres',
      errors: { code: 'Le code doit contenir 6 chiffres' }
    });
  }

  const limit = rateLimit(`register-confirm:${getClientIp(req)}`, { max: 20, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de tentatives, reessayez dans quelques minutes' });
  }

  try {
    const result = await consumeVerificationCode({ purpose: 'register', email, code });
    if (!result.ok || !result.payload) {
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

    // L'email a pu etre pris entre l'envoi du code et sa saisie.
    const existing = await query('SELECT id FROM user WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      await deleteVerificationCodes('register', email);
      return res.status(409).json({ success: false, message: 'Un compte existe deja avec cette adresse email' });
    }

    const { firstName, lastName, passwordHash, gender, birthDate } = result.payload;
    const insert = await query(
      'INSERT INTO user (firstName, lastName, email, emailVerifiedAt, password, gender, birthDate) VALUES (?, ?, ?, NOW(), ?, ?, ?)',
      [firstName, lastName, email, passwordHash, gender, birthDate]
    );
    await deleteVerificationCodes('register', email);
    await query('DELETE FROM deletedAccount WHERE email = ?', [email]);

    const userId = insert.insertId;
    const token = await signToken({ id: userId, email });
    const deviceId = readDeviceCookie(req) || newDeviceId();
    res.setHeader('Set-Cookie', [buildAuthCookie(token), buildDeviceCookie(deviceId)]);
    res.on('finish', () => {
      recordLoginDevice({ user: { id: userId, email, firstName, language: null }, req, deviceId });
    });
    return res.status(201).json({
      success: true,
      message: 'Compte cree avec succes',
      user: { id: userId, firstName, lastName, email, gender, birthDate, avatar: null, cover: null }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur, veuillez reessayer' });
  }
}
