import { getUserFromRequest } from '@/lib/auth';
import {
  getCollectionRow,
  canViewCollection,
  getBreadcrumb,
  attachCounts,
  listCollections,
  getCollectionItems,
  updateCollection,
  deleteCollection
} from '@/lib/collections';
import { mediaUrl } from '@/lib/upload';
import { query } from '@/lib/db';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const id = Number(req.query.id);
  if (!Number.isInteger(id)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    if (req.method === 'GET') {
      const collection = await getCollectionRow(id);
      if (!collection || !(await canViewCollection(payload.id, collection))) {
        return res.status(404).json({ success: false, message: 'Collection introuvable' });
      }

      const [meta] = await attachCounts([collection]);
      const [breadcrumb, children, items, ownerRows] = await Promise.all([
        getBreadcrumb(collection),
        listCollections(collection.userId, payload.id, collection.id),
        getCollectionItems(collection, payload.id),
        query('SELECT id, firstName, lastName, avatarId FROM user WHERE id = ? LIMIT 1', [collection.userId])
      ]);
      const owner = ownerRows[0]
        ? { id: ownerRows[0].id, firstName: ownerRows[0].firstName, lastName: ownerRows[0].lastName, avatar: mediaUrl(ownerRows[0].avatarId) }
        : null;

      return res.status(200).json({
        success: true,
        collection: meta,
        owner,
        isOwner: collection.userId === payload.id,
        breadcrumb,
        children,
        items
      });
    }

    if (req.method === 'PUT') {
      const result = await updateCollection(payload.id, id, req.body || {});
      return res.status(result.success ? 200 : result.status || 422).json(result);
    }

    if (req.method === 'DELETE') {
      const result = await deleteCollection(payload.id, id);
      return res.status(result.success ? 200 : result.status || 422).json(result);
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
