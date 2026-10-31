import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { query } from './db';

const encoder = new TextEncoder();

function getSecretKey() {
  return encoder.encode(process.env.JWT_SECRET);
}

export async function signToken(payload) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch (error) {
    return null;
  }
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export const AUTH_COOKIE_NAME = 'authToken';

export function buildAuthCookie(token) {
  const maxAge = 60 * 60 * 24 * 7;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function buildClearAuthCookie() {
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// Etat de moderation (role / bannissement) mis en cache quelques secondes pour
// ne pas ajouter une requete SQL a chaque appel d'API tout en rendant un
// bannissement effectif presque immediatement (invalidation explicite via
// invalidateUserStatus() lors d'un ban / deban / changement de role).
const STATUS_TTL_MS = 15 * 1000;
const statusCache = new Map();

export function invalidateUserStatus(userId) {
  if (userId === undefined || userId === null) statusCache.clear();
  else statusCache.delete(Number(userId));
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getUserStatus(userId) {
  const id = Number(userId);
  const cached = statusCache.get(id);
  if (cached && Date.now() - cached.at < STATUS_TTL_MS) return cached.value;

  const rows = await query('SELECT id, email, role, bannedAt, banReason FROM user WHERE id = ? LIMIT 1', [id]);
  let value = null;
  if (rows[0]) {
    let role = rows[0].role;
    // ADMIN_EMAILS (variable d'environnement) : promotion automatique des
    // comptes listes, pratique pour creer le tout premier administrateur.
    if (role !== 'admin' && adminEmails().includes(String(rows[0].email).toLowerCase())) {
      await query("UPDATE user SET role = 'admin' WHERE id = ?", [id]);
      role = 'admin';
    }
    value = { role, banned: Boolean(rows[0].bannedAt), banReason: rows[0].banReason || null };
  }
  statusCache.set(id, { at: Date.now(), value });
  return value;
}

export async function getUserFromRequest(req) {
  const token = req.cookies ? req.cookies[AUTH_COOKIE_NAME] : null;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  // Un compte banni (ou supprime) perd immediatement l'acces a toute l'API.
  try {
    const status = await getUserStatus(payload.id);
    if (!status || status.banned) return null;
    return { ...payload, role: status.role, isAdmin: status.role === 'admin' };
  } catch (error) {
    return payload;
  }
}

// Garde pour les routes d'administration : renvoie le payload ou repond
// 401/403 et retourne null.
export async function requireAdmin(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    res.status(401).json({ success: false, message: 'Non authentifie' });
    return null;
  }
  if (!payload.isAdmin) {
    res.status(403).json({ success: false, message: 'Acces reserve aux administrateurs' });
    return null;
  }
  return payload;
}
