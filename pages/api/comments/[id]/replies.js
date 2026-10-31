import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewPost } from '@/lib/posts';
import { hydrateComments, COMMENT_SELECT } from '@/lib/comments';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const commentId = Number(req.query.id);
  if (!Number.isInteger(commentId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const parentRows = await query('SELECT id, postId FROM comment WHERE id = ? AND deletedAt IS NULL LIMIT 1', [
      commentId
    ]);
    if (parentRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Commentaire introuvable' });
    }

    const postRows = await query('SELECT id, userId, visibility FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [
      parentRows[0].postId
    ]);
    if (postRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Publication introuvable' });
    }

    const allowed = await canViewPost(payload.id, postRows[0]);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Action non autorisee' });
    }

    const rows = await query(
      `${COMMENT_SELECT} WHERE c.parentId = ? AND c.deletedAt IS NULL ORDER BY c.createdAt ASC`,
      [commentId]
    );

    const replies = await hydrateComments(rows, payload.id);
    return res.status(200).json({ success: true, replies });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
