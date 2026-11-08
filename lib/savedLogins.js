import crypto from 'crypto';
import { query } from './db';
import { mediaUrl } from './upload';
import { describeUserAgent } from './devices';

// Connexions enregistrees (Account Center) : le navigateur garde, par compte,
// un jeton aleatoire dans un cookie HttpOnly. Seul son hash est stocke en base.
// Le jeton ne vaut que pour CE navigateur et peut etre revoque a tout moment.

export const SAVED_LOGIN_DAYS = 60;
const MAX_PER_USER = 10;
const COOKIE_PREFIX = 'vyn_sl_';

export function savedCookieName(userId) {
  return `${COOKIE_PREFIX}${Number(userId)}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function cookieAttrs(maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function buildSavedLoginCookie(userId, token) {
  return `${savedCookieName(userId)}=${token}; ${cookieAttrs(SAVED_LOGIN_DAYS * 24 * 60 * 60)}`;
}

export function buildClearSavedLoginCookie(userId) {
  return `${savedCookieName(userId)}=; ${cookieAttrs(0)}`;
}

function readToken(req, userId) {
  const value = req.cookies ? req.cookies[savedCookieName(userId)] : null;
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

// Ids de comptes pour lesquels ce navigateur possede un cookie.
function cookieUserIds(req) {
  const ids = [];
  Object.keys(req.cookies || {}).forEach((name) => {
    const match = new RegExp(`^${COOKIE_PREFIX}(\\d+)$`).exec(name);
    if (match) ids.push(Number(match[1]));
  });
  return ids;
}

// Cree (ou remplace) la connexion enregistree de cet utilisateur sur ce navigateur.
export async function createSavedLogin(req, userId) {
  const previous = readToken(req, userId);
  if (previous) await query('DELETE FROM savedLogin WHERE tokenHash = ? AND userId = ?', [hashToken(previous), userId]);

  const token = crypto.randomBytes(32).toString('base64url');
  const label = describeUserAgent(req.headers['user-agent']).label.slice(0, 120);
  await query(
    'INSERT INTO savedLogin (userId, tokenHash, label, expiresAt) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
    [userId, hashToken(token), label, SAVED_LOGIN_DAYS]
  );

  // On garde au plus MAX_PER_USER appareils par compte (les plus anciens sautent).
  await query(
    `DELETE FROM savedLogin WHERE userId = ? AND id NOT IN (
       SELECT id FROM (SELECT id FROM savedLogin WHERE userId = ? ORDER BY createdAt DESC LIMIT ?) AS keepers
     )`,
    [userId, userId, MAX_PER_USER]
  );
  return token;
}

// Verifie le cookie d'un compte. Renvoie la ligne utilisateur ou null.
export async function verifySavedLogin(req, userId) {
  const token = readToken(req, userId);
  if (!token) return null;
  const rows = await query(
    `SELECT s.id AS savedId, u.id, u.firstName, u.lastName, u.email, u.avatarId, u.coverId, u.language,
            u.deactivatedAt, u.role, u.bannedAt, u.banReason,
            ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified
     FROM savedLogin s JOIN user u ON u.id = s.userId
     WHERE s.tokenHash = ? AND s.userId = ? AND s.expiresAt > NOW() LIMIT 1`,
    [hashToken(token), userId]
  );
  return rows[0] || null;
}

export async function touchSavedLogin(savedId) {
  await query('UPDATE savedLogin SET lastUsedAt = NOW(), expiresAt = DATE_ADD(NOW(), INTERVAL ? DAY) WHERE id = ?', [
    SAVED_LOGIN_DAYS,
    savedId
  ]);
}

export async function revokeSavedLogin(req, userId) {
  const token = readToken(req, userId);
  if (token) await query('DELETE FROM savedLogin WHERE tokenHash = ? AND userId = ?', [hashToken(token), userId]);
}

// A appeler quand le mot de passe change : toutes les connexions enregistrees sautent.
export async function revokeAllSavedLogins(userId) {
  await query('DELETE FROM savedLogin WHERE userId = ?', [userId]);
}

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!domain) return '';
  const visible = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, Math.min(6, name.length - visible.length)))}@${domain}`;
}

// Comptes enregistres sur ce navigateur (cookie valide + jeton connu en base).
export async function listSavedAccounts(req) {
  const accounts = [];
  const staleIds = [];
  for (const userId of cookieUserIds(req)) {
    // eslint-disable-next-line no-await-in-loop
    const row = await verifySavedLogin(req, userId);
    if (!row || row.bannedAt) {
      staleIds.push(userId);
      continue;
    }
    accounts.push({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      emailMasked: maskEmail(row.email),
      avatar: mediaUrl(row.avatarId),
      verified: Boolean(Number(row.verified))
    });
  }
  return { accounts, staleIds };
}
