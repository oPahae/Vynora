import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { hydrateReelComments, REEL_COMMENT_SELECT } from '@/lib/reels';
import { logActivity, snippet } from '@/lib/activity';

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
    const rows = await query('SELECT * FROM reelComment WHERE id = ? AND deletedAt IS NULL LIMIT 1', [commentId]);
    const comment = rows[0];
    if (!comment) return res.status(404).json({ success: false, message: 'Commentaire introuvable' });

    // Le proprietaire du reel peut aussi supprimer les commentaires de son reel.
    const reelRows = await query('SELECT userId FROM reel WHERE id = ? LIMIT 1', [comment.reelId]);
    const isReelOwner = reelRows[0]?.userId === payload.id;
    const isAuthor = comment.userId === payload.id;

    if (req.method === 'PUT') {
      if (!isAuthor) return res.status(403).json({ success: false, message: 'Action non autorisee' });
      const content = (req.body?.content || '').toString().trim().slice(0, 1000);
      if (!content) return res.status(422).json({ success: false, message: 'Le commentaire ne peut pas etre vide' });
      await query('UPDATE reelComment SET content = ?, isEdited = 1 WHERE id = ?', [content, commentId]);
      const updated = await query(`${REEL_COMMENT_SELECT} WHERE c.id = ? LIMIT 1`, [commentId]);
      const [hydrated] = await hydrateReelComments(updated, payload.id);
      return res.status(200).json({ success: true, comment: hydrated });
    }

    if (req.method === 'DELETE') {
      if (!isAuthor && !isReelOwner) {
        return res.status(403).json({ success: false, message: 'Action non autorisee' });
      }
      await query('UPDATE reelComment SET deletedAt = NOW() WHERE id = ?', [commentId]);
      await logActivity(payload.id, 'comment_delete', {
        targetType: 'reelComment',
        targetId: commentId,
        meta: { reelId: comment.reelId, snippet: snippet(comment.content) }
      });
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
