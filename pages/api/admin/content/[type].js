import { requireAdmin } from '@/lib/auth';
import { listContent, ADMIN_LIST_TYPES } from '@/lib/admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  const type = (req.query.type || '').toString();
  if (!ADMIN_LIST_TYPES.includes(type)) {
    return res.status(404).json({ success: false, message: 'Type inconnu' });
  }

  try {
    const result = await listContent(type, {
      q: req.query.q,
      offset: req.query.offset,
      limit: req.query.limit,
      filter: req.query.filter
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
