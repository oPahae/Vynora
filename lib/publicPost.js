import { query } from './db';

// Une publication peut etre vue SANS compte (lien partage a l'exterieur)
// uniquement si elle est publique, hors groupe, et si son auteur n'a pas un
// profil prive.
export async function isPostPubliclyViewable(postRow) {
  if (!postRow || postRow.deletedAt) return false;
  if (postRow.visibility !== 'public' || postRow.groupId) return false;
  const owner = await query('SELECT isPrivate, bannedAt FROM user WHERE id = ? LIMIT 1', [postRow.userId]);
  return Boolean(owner[0]) && !owner[0].isPrivate && !owner[0].bannedAt;
}

// Un media est servi aux visiteurs non connectes s'il appartient a une
// publication publique, ou s'il s'agit de l'avatar d'un profil non prive, ou
// de la photo d'une annonce du Market encore active.
export async function isMediaPubliclyViewable(mediaId) {
  const postRows = await query(
    `SELECT 1
       FROM postMedia pm
       JOIN post p ON p.id = pm.postId AND p.deletedAt IS NULL AND p.visibility = 'public' AND p.groupId IS NULL
       JOIN user u ON u.id = p.userId AND u.isPrivate = 0 AND u.bannedAt IS NULL
      WHERE pm.mediaId = ?
      LIMIT 1`,
    [mediaId]
  );
  if (postRows.length > 0) return true;

  const avatarRows = await query('SELECT 1 FROM user WHERE avatarId = ? AND isPrivate = 0 AND bannedAt IS NULL LIMIT 1', [mediaId]);
  if (avatarRows.length > 0) return true;

  const productRows = await query(
    `SELECT 1
       FROM marketProductMedia mm
       JOIN marketProduct mp ON mp.id = mm.productId AND mp.deletedAt IS NULL AND mp.status <> 'removed'
      WHERE mm.mediaId = ?
      LIMIT 1`,
    [mediaId]
  );
  return productRows.length > 0;
}

// URL publique de l'application (liens partages, balises Open Graph).
export function getBaseUrl(req) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0] || (req.socket && req.socket.encrypted ? 'https' : 'http');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0];
  return `${proto}://${host}`;
}
