import { getUserFromRequest } from '@/lib/auth';
import { getVapidPublicKey, isPushConfigured } from '@/lib/push';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  return res.status(200).json({ success: true, configured: isPushConfigured, publicKey: getVapidPublicKey() });
}
