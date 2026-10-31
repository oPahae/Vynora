import { getUserFromRequest } from '@/lib/auth';
import { listActivity, ACTIVITY_CATEGORIES } from '@/lib/activity';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const category = (req.query.category || 'all').toString();
  if (category !== 'all' && !ACTIVITY_CATEGORIES[category]) {
    return res.status(422).json({ success: false, message: 'Categorie invalide' });
  }

  try {
    const result = await listActivity(payload.id, {
      category,
      before: req.query.before,
      limit: req.query.limit
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
