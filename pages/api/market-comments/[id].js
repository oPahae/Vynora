import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { MARKET_MAX_COMMENT } from '@/lib/market';

// Modifier / supprimer un commentaire d'annonce. L'auteur, le vendeur et les
// administrateurs peuvent supprimer ; seul l'auteur peut modifier.
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
    const rows = await query(
      `SELECT c.id, c.userId, c.productId, p.sellerId
         FROM marketComment c JOIN marketProduct p ON p.id = c.productId
        WHERE c.id = ? AND c.deletedAt IS NULL LIMIT 1`,
      [commentId]
    );
    const comment = rows[0];
    if (!comment) return res.status(404).json({ success: false, message: 'Commentaire introuvable' });
    const isAuthor = comment.userId === payload.id;

    if (req.method === 'PUT') {
      if (!isAuthor) return res.status(403).json({ success: false, message: 'Action non autorisee' });
      const content = (req.body?.content || '').toString().trim().slice(0, MARKET_MAX_COMMENT);
      if (!content) return res.status(422).json({ success: false, message: 'Le commentaire ne peut pas etre vide' });
      await query('UPDATE marketComment SET content = ?, isEdited = 1 WHERE id = ?', [content, commentId]);
      return res.status(200).json({ success: true, content });
    }

    if (req.method === 'DELETE') {
      if (!isAuthor && comment.sellerId !== payload.id && !payload.isAdmin) {
        return res.status(403).json({ success: false, message: 'Action non autorisee' });
      }
      await query('UPDATE marketComment SET deletedAt = NOW() WHERE id = ?', [commentId]);
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
