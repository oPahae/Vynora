import { searchPlaces } from '@/lib/geo';
import { getRequestLocale } from '@/lib/i18n/server';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// Suggestions de lieux pour le champ "Localisation" (inscription et profil).
// Accessible sans compte (la page d'inscription n'en a pas) mais limite par IP.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const limit = rateLimit(`geo-search:${getClientIp(req)}`, { max: 60, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de demandes, reessayez dans quelques minutes' });
  }

  const places = await searchPlaces(req.query.q, getRequestLocale(req), 5);
  return res.status(200).json({ success: true, places });
}
