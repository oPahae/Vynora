import { locateIp, formatLocation, isValidCoordinates, roundCoordinate } from '@/lib/geo';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

// Detection automatique de la localisation (ville approximative, d'apres l'IP).
// Utilisee par le champ "Localisation" de l'inscription ; accessible sans compte.
// Ne renvoie rien (location: null) si l'IP est locale ou inconnue.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const ip = getClientIp(req);
  const limit = rateLimit(`geo-detect:${ip}`, { max: 20, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ success: false, message: 'Trop de demandes, reessayez dans quelques minutes' });
  }

  res.setHeader('Cache-Control', 'no-store');
  try {
    const place = await locateIp(ip, req.headers);
    const label = formatLocation(place);
    if (!label || !isValidCoordinates(place.latitude, place.longitude)) {
      return res.status(200).json({ success: true, location: null });
    }
    return res.status(200).json({
      success: true,
      location: {
        label,
        latitude: roundCoordinate(place.latitude),
        longitude: roundCoordinate(place.longitude)
      }
    });
  } catch (error) {
    return res.status(200).json({ success: true, location: null });
  }
}
