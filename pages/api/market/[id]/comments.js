import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { mediaUrl } from '@/lib/upload';
import { createNotification } from '@/lib/notifications';
import { MARKET_SELECT, MARKET_MAX_COMMENT, marketVisibilitySql } from '@/lib/market';
import { marketRepliesSupported } from '@/lib/marketComments';

export const MARKET_COMMENT_SELECT = `
  SELECT c.id, c.productId, c.userId, c.parentId, c.content, c.isEdited, c.createdAt,
         (SELECT COUNT(*) FROM marketComment r WHERE r.parentId = c.id AND r.deletedAt IS NULL) AS replyCount,
         u.firstName, u.lastName, u.avatarId,
         ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified
  FROM marketComment c
  JOIN user u ON u.id = c.userId
`;

export function shapeMarketComment(row, sellerId) {
  return {
    id: row.id,
    productId: row.productId,
    parentId: row.parentId || null,
    replyCount: Number(row.replyCount) || 0,
    content: row.content,
    isEdited: Boolean(row.isEdited),
    createdAt: row.createdAt,
    isSeller: row.userId === sellerId,
    author: {
      id: row.userId,
      firstName: row.firstName,
      lastName: row.lastName,
      avatar: mediaUrl(row.avatarId),
      verified: Boolean(row.verified)
    }
  };
}

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const productId = Number(req.query.id);
  if (!Number.isInteger(productId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const visibility = marketVisibilitySql(payload.id);
    const rows = await query(`${MARKET_SELECT} WHERE p.id = ? AND ${visibility.clause} LIMIT 1`, [productId, ...visibility.params]);
    const product = rows[0];
    if (!product) return res.status(404).json({ success: false, message: 'Annonce introuvable' });

    const repliesOk = await marketRepliesSupported();

    if (req.method === 'GET') {
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const parentId = Number(req.query.parentId) || null;
      // Sans parentId : commentaires de premier niveau (recents d'abord).
      // Avec parentId : reponses de ce commentaire (anciennes d'abord, comme une conversation).
      const level = !repliesOk ? '1 = 1' : parentId ? 'c.parentId = ?' : 'c.parentId IS NULL';
      const order = parentId ? 'c.createdAt ASC, c.id ASC' : 'c.createdAt DESC, c.id DESC';
      const list = await query(
        `${MARKET_COMMENT_SELECT}
          WHERE c.productId = ? AND ${level} AND c.deletedAt IS NULL AND u.bannedAt IS NULL
            AND NOT EXISTS (SELECT 1 FROM block b WHERE (b.blockerId = ? AND b.blockedId = c.userId) OR (b.blockerId = c.userId AND b.blockedId = ?))
          ORDER BY ${order} LIMIT ? OFFSET ?`,
        [productId, ...(repliesOk && parentId ? [parentId] : []), payload.id, payload.id, limit + 1, offset]
      );
      return res.status(200).json({
        success: true,
        comments: list.slice(0, limit).map((row) => shapeMarketComment(row, product.sellerId)),
        hasMore: list.length > limit
      });
    }

    if (req.method === 'POST') {
      const content = (req.body?.content || '').toString().trim().slice(0, MARKET_MAX_COMMENT);
      if (!content) return res.status(422).json({ success: false, message: 'Le commentaire ne peut pas etre vide' });

      let parentId = null;
      let parentAuthor = null;
      const requestedParent = Number(req.body?.parentId) || null;
      if (requestedParent) {
        if (!repliesOk) return res.status(501).json({ success: false, message: 'Reponses indisponibles' });
        const parents = await query(
          'SELECT id, userId, parentId FROM marketComment WHERE id = ? AND productId = ? AND deletedAt IS NULL LIMIT 1',
          [requestedParent, productId]
        );
        const parent = parents[0];
        if (!parent) return res.status(404).json({ success: false, message: 'Commentaire introuvable' });
        // Un seul niveau de reponses : repondre a une reponse la rattache au commentaire d'origine.
        parentId = parent.parentId || parent.id;
        parentAuthor = parent.userId;
      }

      const result = repliesOk
        ? await query('INSERT INTO marketComment (productId, userId, parentId, content) VALUES (?, ?, ?, ?)', [
            productId,
            payload.id,
            parentId,
            content
          ])
        : await query('INSERT INTO marketComment (productId, userId, content) VALUES (?, ?, ?)', [
            productId,
            payload.id,
            content
          ]);

      if (parentId) {
        if (parentAuthor && parentAuthor !== payload.id) {
          await createNotification({
            userId: parentAuthor,
            actorId: payload.id,
            type: 'reply',
            targetType: 'product',
            targetId: productId,
            content: content.slice(0, 80)
          });
        }
        if (product.sellerId !== payload.id && product.sellerId !== parentAuthor) {
          await createNotification({
            userId: product.sellerId,
            actorId: payload.id,
            type: 'comment',
            targetType: 'product',
            targetId: productId,
            content: content.slice(0, 80)
          });
        }
      } else if (product.sellerId !== payload.id) {
        await createNotification({
          userId: product.sellerId,
          actorId: payload.id,
          type: 'comment',
          targetType: 'product',
          targetId: productId,
          content: content.slice(0, 80)
        });
      }
      const created = await query(`${MARKET_COMMENT_SELECT} WHERE c.id = ? LIMIT 1`, [result.insertId]);
      return res.status(201).json({ success: true, comment: shapeMarketComment(created[0], product.sellerId) });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
