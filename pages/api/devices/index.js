import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { readDeviceCookie } from '@/lib/devices';
import crypto from 'crypto';

// Appareils depuis lesquels le compte s'est connecte.
//   GET    : liste (l'appareil courant est marque)
//   DELETE : { id } oublie un appareil (il redeclenchera une alerte a la prochaine connexion)
export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  try {
    if (req.method === 'GET') {
      const deviceId = readDeviceCookie(req);
      const currentKey = deviceId ? crypto.createHash('sha256').update(deviceId).digest('hex') : null;
      const rows = await query(
        `SELECT id, deviceKey, label, ip, city, region, country, firstSeenAt, lastSeenAt
         FROM loginDevice WHERE userId = ? ORDER BY lastSeenAt DESC LIMIT 50`,
        [payload.id]
      );
      return res.status(200).json({
        success: true,
        devices: rows.map((row) => ({
          id: row.id,
          label: row.label,
          ip: row.ip,
          city: row.city,
          region: row.region,
          country: row.country,
          firstSeenAt: row.firstSeenAt,
          lastSeenAt: row.lastSeenAt,
          current: row.deviceKey === currentKey
        }))
      });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.body?.id);
      if (!Number.isInteger(id)) return res.status(422).json({ success: false, message: 'Requete invalide' });
      await query('DELETE FROM loginDevice WHERE id = ? AND userId = ?', [id, payload.id]);
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
