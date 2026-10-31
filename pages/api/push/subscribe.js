import { getUserFromRequest } from '@/lib/auth';
import { saveSubscription, isPushConfigured } from '@/lib/push';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  if (!isPushConfigured) {
    return res.status(503).json({ success: false, message: 'Notifications push non configurees sur ce serveur' });
  }

  try {
    await saveSubscription(payload.id, req.body?.subscription, req.headers['user-agent']);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(422).json({ success: false, message: error.message || 'Abonnement invalide' });
  }
}
