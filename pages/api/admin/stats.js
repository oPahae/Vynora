import { requireAdmin } from '@/lib/auth';
import { getOverview } from '@/lib/admin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  try {
    const overview = await getOverview();
    return res.status(200).json({ success: true, ...overview });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
