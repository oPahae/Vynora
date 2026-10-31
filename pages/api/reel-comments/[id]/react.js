import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { REACTION_TYPES } from '@/lib/posts';
import { getVisibleReelRow, getReelCommentAggregates } from '@/lib/reels';
import { createNotification } from '@/lib/notifications';
import { logActivity } from '@/lib/activity';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const commentId = Number(req.query.id);
  if (!Number.isInteger(commentId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const rows = await query('SELECT id, userId, reelId FROM reelComment WHERE id = ? AND deletedAt IS NULL LIMIT 1', [commentId]);
    const comment = rows[0];
    if (!comment) return res.status(404).json({ success: false, message: 'Commentaire introuvable' });
    if (!(await getVisibleReelRow(payload.id, comment.reelId))) {
      return res.status(403).json({ success: false, message: 'Action non autorisee' });
    }

    if (req.method === 'POST') {
      const type = (req.body?.type || '').toString();
      if (!REACTION_TYPES.includes(type)) {
        return res.status(422).json({ success: false, message: 'Type de reaction invalide' });
      }
      const existing = await query('SELECT type FROM reelCommentReaction WHERE commentId = ? AND userId = ? LIMIT 1', [commentId, payload.id]);
      await query(
        `INSERT INTO reelCommentReaction (commentId, userId, type) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE type = VALUES(type), createdAt = NOW()`,
        [commentId, payload.id, type]
      );
      if (comment.userId !== payload.id && !existing[0] && type !== 'dislike') {
        await createNotification({
          userId: comment.userId,
          actorId: payload.id,
          type: 'like',
          targetType: 'reelComment',
          targetId: commentId,
          content: String(comment.reelId)
        });
      }
      await logActivity(payload.id, 'reaction', { targetType: 'reelComment', targetId: commentId, meta: { type, reelId: comment.reelId } });
      return res.status(200).json({ success: true, ...(await getReelCommentAggregates(commentId, payload.id)) });
    }

    if (req.method === 'DELETE') {
      await query('DELETE FROM reelCommentReaction WHERE commentId = ? AND userId = ?', [commentId, payload.id]);
      return res.status(200).json({ success: true, ...(await getReelCommentAggregates(commentId, payload.id)) });
    }

    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
