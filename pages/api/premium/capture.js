import { getUserFromRequest } from '@/lib/auth';
import { completeCheckout, getPremiumStatus } from '@/lib/premium';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  const orderId = (req.body?.orderId || '').toString().slice(0, 64);
  if (!orderId) return res.status(422).json({ success: false, message: 'Requete invalide' });

  try {
    const result = await completeCheckout(payload.id, orderId);
    if (!result.success) return res.status(result.status || 402).json(result);
    return res.status(200).json({ success: true, status: await getPremiumStatus(payload.id) });
  } catch (error) {
    return res.status(502).json({ success: false, message: 'Impossible de valider le paiement' });
  }
}
