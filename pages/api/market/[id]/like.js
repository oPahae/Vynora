import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { MARKET_SELECT, hydrateProducts, marketVisibilitySql } from '@/lib/market';

// J'aime / je n'aime plus une annonce.
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
    const row = rows[0];
    if (!row) return res.status(404).json({ success: false, message: 'Annonce introuvable' });

    if (req.method === 'POST') {
      const result = await query('INSERT IGNORE INTO marketProductLike (productId, userId) VALUES (?, ?)', [productId, payload.id]);
      if (result.affectedRows > 0 && row.sellerId !== payload.id) {
        await createNotification({
          userId: row.sellerId,
          actorId: payload.id,
          type: 'like',
          targetType: 'product',
          targetId: productId
        });
      }
    } else if (req.method === 'DELETE') {
      await query('DELETE FROM marketProductLike WHERE productId = ? AND userId = ?', [productId, payload.id]);
    } else {
      res.setHeader('Allow', ['POST', 'DELETE']);
      return res.status(405).json({ success: false, message: 'Methode non autorisee' });
    }

    const [product] = await hydrateProducts([row], payload.id);
    return res.status(200).json({ success: true, likeCount: product.likeCount, likedByMe: product.likedByMe });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
