import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewPost, REACTION_TYPES } from '@/lib/posts';
import { withAvatarUrl } from '@/lib/upload';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const postId = Number(req.query.id);
  if (!Number.isInteger(postId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const postRows = await query('SELECT id, userId, visibility FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [
    postId
  ]);
  if (postRows.length === 0) {
    return res.status(404).json({ success: false, message: 'Publication introuvable' });
  }

  const allowed = await canViewPost(payload.id, postRows[0]);
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Action non autorisee' });
  }

  const typeFilter = (req.query.type || '').toString();

  try {
    let rows;
    if (REACTION_TYPES.includes(typeFilter)) {
      rows = await query(
        `SELECT u.id, u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified, r.type
         FROM reaction r JOIN user u ON u.id = r.userId
         WHERE r.postId = ? AND r.type = ?
         ORDER BY r.createdAt DESC`,
        [postId, typeFilter]
      );
    } else {
      rows = await query(
        `SELECT u.id, u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified, r.type
         FROM reaction r JOIN user u ON u.id = r.userId
         WHERE r.postId = ?
         ORDER BY r.createdAt DESC`,
        [postId]
      );
    }

    return res.status(200).json({ success: true, reactors: withAvatarUrl(rows) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
