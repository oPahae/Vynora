import { submitAppeal } from '@/lib/appeals';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// Demande de revision d'un bannissement (public : le compte banni ne peut pas se connecter).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const limit = rateLimit(`appeal:${getClientIp(req)}`, { max: 6, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return res.status(429).json({ success: false, message: 'Trop de tentatives, reessayez plus tard' });

  try {
    const { email, password, message } = req.body || {};
    const result = await submitAppeal({ email, password, message });
    return res.status(result.success ? 201 : result.status || 422).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
