import crypto from 'crypto';
import { parseUpload } from './upload';
import { query } from './db';

// =====================================================================
// Envoi de fichiers "en arriere-plan" : upload par morceaux, reprenable.
// =====================================================================
// Le navigateur decoupe chaque fichier en morceaux (voir lib/uploadQueue.jsx)
// et les envoie un par un. Les morceaux sont stockes dans `uploadChunk`
// jusqu'a /complete, qui assemble le fichier dans la table `media`. Comme
// le serveur sait quels morceaux il a deja recus, l'envoi peut reprendre
// apres un rechargement de la page ou une coupure reseau.
// =====================================================================

export const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
export const SESSION_TTL_HOURS = 48;

export const POST_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/ogg'
];

export function newSessionId() {
  return crypto.randomUUID();
}

// Lit le corps brut d'une requete (bodyParser desactive) avec un plafond.
export function readRawBody(req, limit = MAX_CHUNK_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limit) {
        reject(new Error('Morceau trop volumineux'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJsonBody(req) {
  const buffer = await readRawBody(req, 1024 * 1024);
  if (buffer.length === 0) return {};
  return JSON.parse(buffer.toString('utf8'));
}

// Nettoyage opportuniste des sessions abandonnees.
export async function purgeStaleSessions() {
  try {
    await query('DELETE FROM uploadSession WHERE updatedAt < (NOW() - INTERVAL ? HOUR)', [SESSION_TTL_HOURS]);
  } catch (error) {
    // sans consequence
  }
}

// Verifie que les medias deja envoyes (via /api/uploads) appartiennent bien
// a l'utilisateur et sont d'un type autorise. Conserve l'ordre fourni.
export async function resolvePreUploadedMedia(userId, mediaIds, allowedTypes) {
  const ids = (Array.isArray(mediaIds) ? mediaIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id))
    .slice(0, 50);
  if (ids.length === 0) return [];

  const rows = await query(
    `SELECT id, mimetype FROM media WHERE uploaderId = ? AND id IN (${ids.map(() => '?').join(', ')})`,
    [userId, ...ids]
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error('Media introuvable');
    if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(row.mimetype)) {
      throw new Error('Type de fichier non autorise');
    }
    return { id: row.id, mimetype: row.mimetype };
  });
}

// Lit une requete de creation de publication : soit multipart (fichiers
// joints, ancien mode), soit JSON avec `mediaIds` (fichiers deja envoyes
// en arriere-plan).
export async function parsePostRequest(req, allowedTypes, userId) {
  const contentType = String(req.headers['content-type'] || '');
  if (contentType.includes('application/json')) {
    const body = await readJsonBody(req);
    const fields = {};
    Object.keys(body).forEach((key) => {
      const value = body[key];
      fields[key] = typeof value === 'string' ? value : JSON.stringify(value);
    });
    const preMedia = await resolvePreUploadedMedia(userId, body.mediaIds, allowedTypes);
    return { fields, files: [], preMedia };
  }
  const { fields, files } = await parseUpload(req, allowedTypes);
  return { fields, files, preMedia: [] };
}

export async function findPostByClientKey(userId, clientKey) {
  if (!clientKey) return null;
  const rows = await query('SELECT postId FROM postClientKey WHERE userId = ? AND clientKey = ? LIMIT 1', [userId, clientKey]);
  return rows[0] ? rows[0].postId : null;
}

export async function rememberClientKey(userId, clientKey, postId) {
  if (!clientKey) return;
  await query('INSERT IGNORE INTO postClientKey (userId, clientKey, postId) VALUES (?, ?, ?)', [userId, clientKey, postId]);
}
