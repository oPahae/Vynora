import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { query } from '@/lib/db';
import { canViewPost, REACTION_TYPES } from '@/lib/posts';
import { getCommentAggregates } from '@/lib/comments';
import { createNotification } from '@/lib/notifications';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const commentId = Number(req.query.id);
  if (!Number.isInteger(commentId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const commentRows = await query('SELECT id, userId, postId FROM comment WHERE id = ? AND deletedAt IS NULL LIMIT 1', [
    commentId
  ]);
  if (commentRows.length === 0) {
    return res.status(404).json({ success: false, message: 'Commentaire introuvable' });
  }

  const postRows = await query('SELECT id, userId, visibility FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [
    commentRows[0].postId
  ]);
  if (postRows.length === 0) {
    return res.status(404).json({ success: false, message: 'Publication introuvable' });
  }

  const allowed = await canViewPost(payload.id, postRows[0]);
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Action non autorisee' });
  }

  if (req.method === 'POST') {
    const type = (req.body?.type || '').toString();
    if (!REACTION_TYPES.includes(type)) {
      return res.status(422).json({ success: false, message: 'Type de reaction invalide' });
    }

    try {
      await query(
        `INSERT INTO reaction (userId, commentId, type) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE type = VALUES(type), createdAt = NOW()`,
        [payload.id, commentId, type]
      );

      if (commentRows[0].userId !== payload.id) {
        await createNotification({
          userId: commentRows[0].userId,
          actorId: payload.id,
          type: 'like',
          targetType: 'comment',
          targetId: commentId,
          content: String(commentRows[0].postId)
        });
      }

      await logActivity(payload.id, 'reaction', {
        targetType: 'comment',
        targetId: commentId,
        meta: { type, postId: commentRows[0].postId }
      });

      const aggregates = await getCommentAggregates(commentId, payload.id);
      return res.status(200).json({ success: true, ...aggregates });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await query('DELETE FROM reaction WHERE commentId = ? AND userId = ?', [commentId, payload.id]);
      const aggregates = await getCommentAggregates(commentId, payload.id);
      return res.status(200).json({ success: true, ...aggregates });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  res.setHeader('Allow', ['POST', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
