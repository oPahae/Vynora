import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { query } from '@/lib/db';
import { hydrateComments, COMMENT_SELECT, syncCommentMentions } from '@/lib/comments';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const commentId = Number(req.query.id);
  if (!Number.isInteger(commentId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const rows = await query('SELECT * FROM comment WHERE id = ? AND deletedAt IS NULL LIMIT 1', [commentId]);
  if (rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Commentaire introuvable' });
  }

  const comment = rows[0];
  if (comment.userId !== payload.id) {
    return res.status(403).json({ success: false, message: 'Action non autorisee' });
  }

  if (req.method === 'PUT') {
    const content = (req.body?.content || '').toString().trim();
    if (!content && !comment.mediaId) {
      return res.status(422).json({ success: false, message: 'Le commentaire ne peut pas etre vide' });
    }

    try {
      await query('UPDATE comment SET content = ?, isEdited = 1, updatedAt = NOW() WHERE id = ?', [
        content || null,
        commentId
      ]);

      const mentionIds = Array.isArray(req.body?.mentions) ? req.body.mentions.map(Number).filter((id) => Number.isInteger(id)) : [];
      const postRows = await query('SELECT id, userId, visibility FROM post WHERE id = ? LIMIT 1', [comment.postId]);
      if (postRows[0]) {
        await syncCommentMentions(commentId, postRows[0], content ? mentionIds : [], payload.id);
      }

      const updatedRows = await query(`${COMMENT_SELECT} WHERE c.id = ? LIMIT 1`, [commentId]);
      const [updated] = await hydrateComments(updatedRows, payload.id);

      return res.status(200).json({ success: true, comment: updated });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await query('UPDATE comment SET deletedAt = NOW() WHERE id = ?', [commentId]);
      await logActivity(payload.id, 'comment_delete', {
        targetType: 'comment',
        targetId: commentId,
        meta: { postId: comment.postId, snippet: snippet(comment.content) }
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  res.setHeader('Allow', ['PUT', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
