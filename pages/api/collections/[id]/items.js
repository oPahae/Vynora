import { getUserFromRequest } from '@/lib/auth';
import { addItem, removeItem, reorderItems } from '@/lib/collections';

// POST   { itemType, itemId }      : ajoute un post/reel
// DELETE { itemType, itemId }      : retire un element
// PUT    { order: [collectionItemId, ...] } : reordonne
export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const collectionId = Number(req.query.id);
  if (!Number.isInteger(collectionId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const body = req.body || {};
    let result;
    if (req.method === 'POST') {
      result = await addItem(payload.id, collectionId, (body.itemType || '').toString(), Number(body.itemId));
    } else if (req.method === 'DELETE') {
      result = await removeItem(payload.id, collectionId, (body.itemType || '').toString(), Number(body.itemId));
    } else if (req.method === 'PUT') {
      result = await reorderItems(payload.id, collectionId, body.order);
    } else {
      res.setHeader('Allow', ['POST', 'DELETE', 'PUT']);
      return res.status(405).json({ success: false, message: 'Methode non autorisee' });
    }
    return res.status(result.success ? 200 : result.status || 422).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
