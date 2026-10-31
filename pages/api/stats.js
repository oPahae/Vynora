import { getUserFromRequest } from '@/lib/auth';
import { getUserStats, getEngagementTrend } from '@/lib/stats';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  try {
    const [stats, engagementTrend] = await Promise.all([getUserStats(payload.id), getEngagementTrend(payload.id)]);
    return res.status(200).json({ success: true, stats, engagementTrend });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
