import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { mediaUrl } from '@/lib/upload';
import { createNotification } from '@/lib/notifications';
import { MARKET_SELECT, MARKET_MAX_COMMENT, marketVisibilitySql } from '@/lib/market';

export const MARKET_COMMENT_SELECT = `
  SELECT c.id, c.productId, c.userId, c.content, c.isEdited, c.createdAt,
         u.firstName, u.lastName, u.avatarId,
         ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified
  FROM marketComment c
  JOIN user u ON u.id = c.userId
`;

export function shapeMarketComment(row, sellerId) {
  return {
    id: row.id,
    productId: row.productId,
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

    if (req.method === 'GET') {
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const list = await query(
        `${MARKET_COMMENT_SELECT}
          WHERE c.productId = ? AND c.deletedAt IS NULL AND u.bannedAt IS NULL
            AND NOT EXISTS (SELECT 1 FROM block b WHERE (b.blockerId = ? AND b.blockedId = c.userId) OR (b.blockerId = c.userId AND b.blockedId = ?))
          ORDER BY c.createdAt DESC, c.id DESC LIMIT ? OFFSET ?`,
        [productId, payload.id, payload.id, limit + 1, offset]
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

      const result = await query('INSERT INTO marketComment (productId, userId, content) VALUES (?, ?, ?)', [
        productId,
        payload.id,
        content
      ]);
      if (product.sellerId !== payload.id) {
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
