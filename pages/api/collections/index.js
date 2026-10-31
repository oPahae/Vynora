import { getUserFromRequest } from '@/lib/auth';
import { createCollection, listCollections, listForPicker, getCollectionRow, canViewCollection } from '@/lib/collections';
import { logActivity } from '@/lib/activity';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  try {
    if (req.method === 'GET') {
      // Mode "selecteur" : toutes mes collections + presence d'un element donne.
      if (req.query.itemType && req.query.itemId) {
        const collections = await listForPicker(payload.id, req.query.itemType.toString(), Number(req.query.itemId));
        return res.status(200).json({ success: true, collections });
      }

      const ownerId = req.query.userId ? Number(req.query.userId) : payload.id;
      if (!Number.isInteger(ownerId)) return res.status(422).json({ success: false, message: 'Requete invalide' });

      let parentId = null;
      if (req.query.parentId) {
        parentId = Number(req.query.parentId);
        const parent = await getCollectionRow(parentId);
        if (!parent || parent.userId !== ownerId || !(await canViewCollection(payload.id, parent))) {
          return res.status(404).json({ success: false, message: 'Collection introuvable' });
        }
      }

      const collections = await listCollections(ownerId, payload.id, parentId);
      return res.status(200).json({ success: true, collections });
    }

    if (req.method === 'POST') {
      const result = await createCollection(payload.id, req.body || {});
      if (!result.success) return res.status(422).json(result);
      await logActivity(payload.id, 'collection_create', {
        targetType: 'collection',
        targetId: result.id,
        meta: { name: (req.body?.name || '').toString().slice(0, 60), kind: req.body?.kind }
      });
      return res.status(201).json(result);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
