import crypto from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { saveMediaFile } from '@/lib/upload';
import { startSession, rejectIfBlocked, SESSION_USER_COLUMNS } from '@/lib/loginSession';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
}

// Photo de profil Google -> media (nouveaux comptes uniquement, jamais bloquant).
async function importPicture(url, userId) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('googleusercontent.com')) return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = response.headers.get('content-type') || '';
    if (!response.ok || !type.startsWith('image/')) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 2 * 1024 * 1024) return null;
    return await saveMediaFile({ mimetype: type.split(';')[0], buffer }, userId);
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const clientId = googleClientId();
  if (!clientId) {
    return res.status(503).json({ success: false, message: "La connexion Google n'est pas configuree" });
  }

  const limit = rateLimit(`google-login:${getClientIp(req)}`, { max: 30, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de tentatives, reessayez dans quelques minutes' });
  }

  const credential = (req.body?.credential || '').toString();
  if (!credential) return res.status(422).json({ success: false, message: 'Requete invalide' });

  let claims;
  try {
    const decodedToken = JSON.parse(
      Buffer.from(credential.split('.')[1], 'base64url').toString()
    );
    console.log('Backend Client ID:', clientId);
    console.log('Token Audience:', decodedToken.aud);
    const verified = await jwtVerify(credential, JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId
    });
    claims = verified.payload;
  } catch (error) {
    return res.status(401).json({ success: false, message: "error = " + error });
  }

  const email = String(claims.email || '').trim().toLowerCase();
  if (!email || claims.email_verified !== true || !claims.sub) {
    return res.status(401).json({ success: false, message: "L'adresse email Google n'est pas verifiee" });
  }
  const googleId = String(claims.sub).slice(0, 64);

  try {
    let rows = await query(`SELECT ${SESSION_USER_COLUMNS}, googleId FROM user WHERE googleId = ? LIMIT 1`, [googleId]);
    if (rows.length === 0) rows = await query(`SELECT ${SESSION_USER_COLUMNS}, googleId FROM user WHERE email = ? LIMIT 1`, [email]);

    let user = rows[0];
    let isNew = false;

    if (!user) {
      const deleted = await query('SELECT reason FROM deletedAccount WHERE email = ? LIMIT 1', [email]);
      if (deleted[0]) {
        return res.status(403).json({
          success: false,
          deleted: true,
          reason: deleted[0].reason,
          message: deleted[0].reason
            ? `Ce compte a ete supprime par l'administration. Motif : ${deleted[0].reason}`
            : "Ce compte a ete supprime par l'administration."
        });
      }

      const fullName = String(claims.name || '').trim();
      const firstName = String(claims.given_name || fullName.split(' ')[0] || email.split('@')[0]).slice(0, 50);
      const lastName = String(claims.family_name || fullName.split(' ').slice(1).join(' ') || '-').slice(0, 50);
      // Mot de passe aleatoire : le compte s'utilise via Google (ou "mot de passe oublie").
      const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
      const insert = await query(
        'INSERT INTO user (firstName, lastName, email, googleId, emailVerifiedAt, password) VALUES (?, ?, ?, ?, NOW(), ?)',
        [firstName, lastName, email, googleId, passwordHash]
      );
      const userId = insert.insertId;
      if (claims.picture) {
        const mediaId = await importPicture(String(claims.picture), userId);
        if (mediaId) await query('UPDATE user SET avatarId = ? WHERE id = ?', [mediaId, userId]);
      }
      rows = await query(`SELECT ${SESSION_USER_COLUMNS}, googleId FROM user WHERE id = ? LIMIT 1`, [userId]);
      user = rows[0];
      isNew = true;
    } else if (!user.googleId) {
      // Compte existant avec le meme email (verifie par Google) : on le relie.
      await query('UPDATE user SET googleId = ?, emailVerifiedAt = COALESCE(emailVerifiedAt, NOW()) WHERE id = ?', [googleId, user.id]);
    } else if (user.googleId !== googleId) {
      return res.status(409).json({ success: false, message: 'Ce compte est lie a un autre compte Google' });
    }

    if (await rejectIfBlocked(res, user)) return undefined;

    const session = await startSession(req, res, user);
    return res.status(200).json({ success: true, message: 'Connexion reussie', isNew, ...session });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur, veuillez reessayer' });
  }
}
