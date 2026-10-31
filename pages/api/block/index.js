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
       FROM block b
       JOIN user u ON u.id = b.blockedId
       WHERE b.blockerId = ?
       ORDER BY b.createdAt DESC`,
      [payload.id]
    );

    return res.status(200).json({ success: true, items: withAvatarUrl(rows) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
