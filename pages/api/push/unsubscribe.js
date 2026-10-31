import { getUserFromRequest } from '@/lib/auth';
import { removeSubscription } from '@/lib/push';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const endpoint = (req.body?.endpoint || '').toString();
  if (!endpoint) {
    return res.status(422).json({ success: false, message: 'endpoint manquant' });
  }

  await removeSubscription(payload.id, endpoint);
  return res.status(200).json({ success: true });
}
