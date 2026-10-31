import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewPost } from '@/lib/posts';
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

  try {
    const rows = await query(
      `SELECT u.id, u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified, v.createdAt as viewedAt
       FROM postView v JOIN user u ON u.id = v.userId
       WHERE v.postId = ?
       ORDER BY v.createdAt DESC`,
      [postId]
    );

    return res.status(200).json({ success: true, viewers: withAvatarUrl(rows) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
