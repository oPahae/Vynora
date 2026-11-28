import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getMutualFriendsCount } from '@/lib/friends';
import { withAvatarUrl } from '@/lib/upload';

const DEFAULT_RADIUS_KM = 50;
const MAX_RADIUS_KM = 500;
const MAX_RESULTS = 40;

// Distance rendue volontairement approximative : 0 = moins de 1 km, puis arrondie
// (au km sous 10 km, aux 5 km au-dela). Les coordonnees des autres membres ne sont
// jamais envoyees au navigateur.
function approximateDistance(km) {
  if (km < 1) return 0;
  if (km < 10) return Math.round(km);
  return Math.max(10, Math.round(km / 5) * 5);
}

// Onglet "Proches de moi" : membres geographiquement proches (formule de Haversine),
// hors amis, bloques et comptes suspendus/desactives. Les invitations en cours restent
// visibles pour pouvoir etre annulees ou acceptees.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const requested = Number(req.query.radius);
  const radiusKm = Number.isFinite(requested) && requested > 0 ? Math.min(Math.round(requested), MAX_RADIUS_KM) : DEFAULT_RADIUS_KM;

  try {
    const mine = await query('SELECT latitude, longitude FROM user WHERE id = ? LIMIT 1', [payload.id]);
    const lat = mine[0]?.latitude !== null && mine[0]?.latitude !== undefined ? Number(mine[0].latitude) : null;
    const lng = mine[0]?.longitude !== null && mine[0]?.longitude !== undefined ? Number(mine[0].longitude) : null;

    if (lat === null || lng === null) {
      return res.status(200).json({ success: true, items: [], needsLocation: true, radiusKm });
    }

    // Boite englobante (utilise l'index idx_user_geo) avant le calcul exact de la distance.
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
    const lngMin = lng - lngDelta;
    const lngMax = lng + lngDelta;
    const wrapsAntimeridian = lngMin < -180 || lngMax > 180;

    // Les parametres suivent l'ordre des "?" dans la requete ci-dessous.
    const params = [
      payload.id, // statut : l'invitation vient-elle de moi ?
      lat, lng, lat, // distance (Haversine)
      payload.id, payload.id, // jointure avec la table friend
      payload.id, // exclut mon propre compte
      lat - latDelta, lat + latDelta // boite englobante (latitude)
    ];
    let lngClause = '';
    if (!wrapsAntimeridian) {
      lngClause = 'AND u.longitude BETWEEN ? AND ?';
      params.push(lngMin, lngMax);
    }
    params.push(payload.id, payload.id, radiusKm, MAX_RESULTS); // blocages, rayon, limite

    const rows = await query(
      `SELECT u.id, u.firstName, u.lastName, u.avatarId,
              ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified,
              CASE WHEN f.id IS NULL THEN 'none' WHEN f.requesterId = ? THEN 'requestSent' ELSE 'requestReceived' END AS status,
              (6371 * ACOS(LEAST(1, GREATEST(-1,
                COS(RADIANS(?)) * COS(RADIANS(u.latitude)) * COS(RADIANS(u.longitude) - RADIANS(?))
                + SIN(RADIANS(?)) * SIN(RADIANS(u.latitude))
              )))) AS distanceKm
       FROM user u
       LEFT JOIN friend f
         ON (f.requesterId = ? AND f.addresseeId = u.id) OR (f.requesterId = u.id AND f.addresseeId = ?)
       WHERE u.id != ?
         AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL
         AND u.latitude BETWEEN ? AND ?
         ${lngClause}
         AND u.bannedAt IS NULL AND u.deactivatedAt IS NULL
         AND (f.id IS NULL OR f.status = 'pending')
         AND u.id NOT IN (
           SELECT blockedId FROM block WHERE blockerId = ?
           UNION
           SELECT blockerId FROM block WHERE blockedId = ?
         )
       HAVING distanceKm <= ?
       ORDER BY distanceKm ASC
       LIMIT ?`,
      params
    );

    const items = await Promise.all(
      withAvatarUrl(rows).map(async (row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        avatar: row.avatar,
        verified: Boolean(row.verified),
        status: row.status,
        distanceKm: approximateDistance(Number(row.distanceKm)),
        mutualFriendsCount: await getMutualFriendsCount(payload.id, row.id)
      }))
    );

    return res.status(200).json({ success: true, items, needsLocation: false, radiusKm });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
