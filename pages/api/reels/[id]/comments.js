import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getVisibleReelRow, hydrateReelComments, REEL_COMMENT_SELECT } from '@/lib/reels';
import { createNotification } from '@/lib/notifications';
import { logActivity, snippet } from '@/lib/activity';
import { rateLimit } from '@/lib/rateLimit';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const reelId = Number(req.query.id);
  if (!Number.isInteger(reelId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const reel = await getVisibleReelRow(payload.id, reelId);
    if (!reel) return res.status(404).json({ success: false, message: 'Reel introuvable' });

    if (req.method === 'GET') {
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const limit = Math.min(Math.max(Number(req.query.limit) || 15, 1), 30);
      const parentId = req.query.parentId ? Number(req.query.parentId) : null;

      let rows;
      if (parentId) {
        // reponses : ordre chronologique
        rows = await query(
          `${REEL_COMMENT_SELECT} WHERE c.reelId = ? AND c.parentId = ? AND c.deletedAt IS NULL
           ORDER BY c.createdAt ASC, c.id ASC LIMIT ${limit + 1} OFFSET ${offset}`,
          [reelId, parentId]
        );
      } else {
        // commentaires : "Populaires" (reactions + reponses) ou "Recents"
        const order =
          req.query.sort === 'new'
            ? 'c.createdAt DESC, c.id DESC'
            : `((SELECT COUNT(*) FROM reelCommentReaction rr WHERE rr.commentId = c.id) * 2
                + (SELECT COUNT(*) FROM reelComment ch WHERE ch.parentId = c.id AND ch.deletedAt IS NULL)) DESC, c.createdAt DESC, c.id DESC`;
        rows = await query(
          `${REEL_COMMENT_SELECT} WHERE c.reelId = ? AND c.parentId IS NULL AND c.deletedAt IS NULL
           ORDER BY ${order} LIMIT ${limit + 1} OFFSET ${offset}`,
          [reelId]
        );
      }
      const comments = await hydrateReelComments(rows.slice(0, limit), payload.id);
      return res.status(200).json({ success: true, comments, hasMore: rows.length > limit });
    }

    if (req.method === 'POST') {
      const limitCheck = rateLimit(`reelcomment:${payload.id}`, { max: 30, windowMs: 10 * 60 * 1000 });
      if (!limitCheck.allowed) {
        return res.status(429).json({ success: false, message: 'Trop de commentaires, reessayez dans un instant' });
      }

      const content = (req.body?.content || '').toString().trim().slice(0, 1000);
      if (!content) return res.status(422).json({ success: false, message: 'Le commentaire ne peut pas etre vide' });

      let parentId = req.body?.parentId ? Number(req.body.parentId) : null;
      let parentAuthor = null;
      if (parentId) {
        const parentRows = await query(
          'SELECT id, userId, parentId FROM reelComment WHERE id = ? AND reelId = ? AND deletedAt IS NULL LIMIT 1',
          [parentId, reelId]
        );
        if (!parentRows[0]) return res.status(404).json({ success: false, message: 'Commentaire parent introuvable' });
        // Pour garder un affichage lisible, les reponses a une reponse sont
        // rattachees au commentaire racine (a la maniere de Instagram/TikTok).
        parentAuthor = parentRows[0].userId;
        if (parentRows[0].parentId) parentId = parentRows[0].parentId;
      }

      const result = await query('INSERT INTO reelComment (reelId, userId, parentId, content) VALUES (?, ?, ?, ?)', [
        reelId,
        payload.id,
        parentId,
        content
      ]);
      const commentId = result.insertId;

      if (parentId) {
        if (parentAuthor && parentAuthor !== payload.id) {
          await createNotification({
            userId: parentAuthor,
            actorId: payload.id,
            type: 'reply',
            targetType: 'reelComment',
            targetId: commentId,
            content: String(reelId)
          });
        }
      } else if (reel.userId !== payload.id) {
        await createNotification({
          userId: reel.userId,
          actorId: payload.id,
          type: 'comment',
          targetType: 'reel',
          targetId: reelId
        });
      }

      await logActivity(payload.id, 'comment_create', {
        targetType: 'reelComment',
        targetId: commentId,
        meta: { reelId, isReply: Boolean(parentId), snippet: snippet(content) }
      });

      const rows = await query(`${REEL_COMMENT_SELECT} WHERE c.id = ? LIMIT 1`, [commentId]);
      const [comment] = await hydrateReelComments(rows, payload.id);
      return res.status(201).json({ success: true, comment });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
