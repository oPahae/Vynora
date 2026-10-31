import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { withAvatarUrl } from '@/lib/upload';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  try {
    const rows = await query(
      `SELECT u.id, u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified
       FROM friend f
       JOIN user u ON u.id = f.addresseeId
       WHERE f.status = 'pending' AND f.requesterId = ?
       ORDER BY f.createdAt DESC`,
      [payload.id]
    );

    const items = withAvatarUrl(rows).map((row) => ({ ...row, status: 'requestSent' }));
    return res.status(200).json({ success: true, items });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
