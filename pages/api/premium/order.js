import { getUserFromRequest } from '@/lib/auth';
import { startCheckout } from '@/lib/premium';
import { rateLimit } from '@/lib/rateLimit';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  const limit = rateLimit(`premium-order:${payload.id}`, { max: 10, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return res.status(429).json({ success: false, message: 'Trop de tentatives, reessayez plus tard' });

  try {
    const result = await startCheckout(payload.id);
    return res.status(result.success ? 201 : result.status || 500).json(result);
  } catch (error) {
    return res.status(502).json({ success: false, message: 'Impossible de contacter PayPal' });
  }
}
