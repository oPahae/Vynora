import crypto from 'crypto';
import { query } from '@/lib/db';

// =====================================================================
// VERIFICATION D'EMAIL PAR CODE A 6 CHIFFRES
// =====================================================================
// Meme principe que lib/passwordReset.js (code a usage unique, hache,
// duree de vie limitee, compteur de tentatives anti-bruteforce), mais
// generalise a deux usages identifies par `purpose` :
//   - 'register'      : verifier l'email AVANT de creer le compte. Le
//                        compte n'existe pas encore, donc on identifie le
//                        code par l'email lui-meme (pas de userId), et on
//                        conserve les donnees du formulaire d'inscription
//                        dans `payload` pour creer le compte une fois le
//                        code valide.
//   - 'change_email'  : verifier la nouvelle adresse AVANT de l'appliquer
//                        au compte existant (userId connu).
// =====================================================================

export const VERIFICATION_CODE_TTL_MINUTES = 15;
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
export const VERIFICATION_MAX_ATTEMPTS = 5;

function hashCode(purpose, email, code) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'dev-secret')
    .update(`${purpose}:${email.toLowerCase()}:${code}`)
    .digest('hex');
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export async function hasRecentVerificationRequest(purpose, email) {
  const rows = await query(
    `SELECT 1 FROM emailVerification
     WHERE purpose = ? AND email = ? AND createdAt > DATE_SUB(NOW(), INTERVAL ? SECOND) LIMIT 1`,
    [purpose, email, VERIFICATION_RESEND_COOLDOWN_SECONDS]
  );
  return rows.length > 0;
}

// Cree un nouveau code de verification (un seul valide a la fois pour un
// couple purpose/email donne) et renvoie le code en clair (a envoyer par
// email, jamais stocke tel quel).
export async function createVerificationCode({ purpose, email, userId = null, payload = null }) {
  const code = generateCode();
  await query('DELETE FROM emailVerification WHERE purpose = ? AND email = ?', [purpose, email]);
  await query(
    `INSERT INTO emailVerification (purpose, userId, email, codeHash, payload, expiresAt)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [purpose, userId, email, hashCode(purpose, email, code), payload ? JSON.stringify(payload) : null, VERIFICATION_CODE_TTL_MINUTES]
  );
  return code;
}

export async function deleteVerificationCodes(purpose, email) {
  await query('DELETE FROM emailVerification WHERE purpose = ? AND email = ?', [purpose, email]);
}

// Verifie le code fourni et le consomme (usage unique) si valide. Renvoie :
//   { ok: true, userId, payload }
//   { ok: false, reason: 'invalid' | 'too_many_attempts' }
export async function consumeVerificationCode({ purpose, email, code }) {
  const rows = await query(
    `SELECT id, codeHash, attempts, userId, payload FROM emailVerification
     WHERE purpose = ? AND email = ? AND usedAt IS NULL AND expiresAt > NOW()
     ORDER BY id DESC LIMIT 1`,
    [purpose, email]
  );
  if (rows.length === 0) return { ok: false, reason: 'invalid' };

  const record = rows[0];
  if (record.attempts >= VERIFICATION_MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };

  // La tentative est comptee AVANT la comparaison pour empecher le
  // brute-force, meme avec des requetes concurrentes.
  const bump = await query(
    'UPDATE emailVerification SET attempts = attempts + 1 WHERE id = ? AND attempts < ?',
    [record.id, VERIFICATION_MAX_ATTEMPTS]
  );
  if (bump.affectedRows !== 1) return { ok: false, reason: 'too_many_attempts' };

  const expected = Buffer.from(record.codeHash, 'hex');
  const received = Buffer.from(hashCode(purpose, email, code), 'hex');
  const matches = expected.length === received.length && crypto.timingSafeEqual(expected, received);
  if (!matches) return { ok: false, reason: 'invalid' };

  const consumed = await query('UPDATE emailVerification SET usedAt = NOW() WHERE id = ? AND usedAt IS NULL', [record.id]);
  if (consumed.affectedRows !== 1) return { ok: false, reason: 'invalid' };

  return {
    ok: true,
    userId: record.userId,
    payload: record.payload ? JSON.parse(record.payload) : null
  };
}
