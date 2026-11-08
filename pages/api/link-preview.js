import { getUserFromRequest } from '@/lib/auth';
import { getLinkPreview } from '@/lib/linkPreview';
import { rateLimit } from '@/lib/rateLimit';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  const limit = rateLimit(`link-preview:${payload.id}`, { max: 120, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return res.status(429).json({ success: false, message: 'Trop de requetes' });

  const url = (req.query.url || '').toString().slice(0, 2000);
  if (!url) return res.status(422).json({ success: false, message: 'Requete invalide' });

  try {
    const preview = await getLinkPreview(url);
    if (!preview) return res.status(422).json({ success: false, message: 'Lien invalide' });
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.status(200).json({ success: true, preview });
  } catch (error) {
    return res.status(200).json({ success: true, preview: null });
  }
}
