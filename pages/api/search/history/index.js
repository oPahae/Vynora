import { getUserFromRequest } from '@/lib/auth';
import { getRecentSearches, clearSearchHistory } from '@/lib/search';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  if (req.method === 'GET') {
    const history = await getRecentSearches(payload.id);
    return res.status(200).json({ success: true, history });
  }

  if (req.method === 'DELETE') {
    await clearSearchHistory(payload.id);
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
