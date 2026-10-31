import crypto from 'crypto';
import { query } from '@/lib/db';

export const RESET_CODE_TTL_MINUTES = 15;
export const RESET_RESEND_COOLDOWN_SECONDS = 60;
export const RESET_MAX_ATTEMPTS = 5;

function hashCode(userId, code) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'dev-secret')
    .update(`${userId}:${code}`)
    .digest('hex');
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// Les comparaisons de dates se font en SQL (NOW()) pour ne pas dependre du
// fuseau horaire du serveur Node.
export async function hasRecentResetRequest(userId) {
  const rows = await query(
    `SELECT 1 FROM passwordReset
     WHERE userId = ? AND createdAt > DATE_SUB(NOW(), INTERVAL ? SECOND) LIMIT 1`,
    [userId, RESET_RESEND_COOLDOWN_SECONDS]
  );
  return rows.length > 0;
}

export async function createResetCode(userId) {
  const code = generateCode();
  // Un seul code valide a la fois par utilisateur.
  await query('DELETE FROM passwordReset WHERE userId = ?', [userId]);
  await query(
    `INSERT INTO passwordReset (userId, codeHash, expiresAt)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [userId, hashCode(userId, code), RESET_CODE_TTL_MINUTES]
  );
  return code;
}

export async function deleteResetCodes(userId) {
  await query('DELETE FROM passwordReset WHERE userId = ?', [userId]);
}

// Retourne { ok: true } si le code est valide et le consomme (usage unique),
// sinon { ok: false, reason: 'invalid' | 'too_many_attempts' }.
export async function consumeResetCode(userId, code) {
  const rows = await query(
    `SELECT id, codeHash, attempts FROM passwordReset
     WHERE userId = ? AND usedAt IS NULL AND expiresAt > NOW()
     ORDER BY id DESC LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) return { ok: false, reason: 'invalid' };

  const record = rows[0];
  if (record.attempts >= RESET_MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };

  // La tentative est comptee AVANT la comparaison pour empecher le
  // brute-force, meme avec des requetes concurrentes.
  const bump = await query(
    'UPDATE passwordReset SET attempts = attempts + 1 WHERE id = ? AND attempts < ?',
    [record.id, RESET_MAX_ATTEMPTS]
  );
  if (bump.affectedRows !== 1) return { ok: false, reason: 'too_many_attempts' };

  const expected = Buffer.from(record.codeHash, 'hex');
  const received = Buffer.from(hashCode(userId, code), 'hex');
  const matches = expected.length === received.length && crypto.timingSafeEqual(expected, received);
  if (!matches) return { ok: false, reason: 'invalid' };

  const consumed = await query('UPDATE passwordReset SET usedAt = NOW() WHERE id = ? AND usedAt IS NULL', [record.id]);
  if (consumed.affectedRows !== 1) return { ok: false, reason: 'invalid' };

  return { ok: true };
}
