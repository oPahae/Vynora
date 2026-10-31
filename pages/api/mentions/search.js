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

  const searchTerm = (req.query.q || '').toString().trim();

  try {
    const likeTerm = `%${searchTerm}%`;
    const rows = await query(
      `SELECT u.id, u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified,
        EXISTS(
          SELECT 1 FROM friend f
          WHERE f.status = 'accepted' AND ((f.requesterId = ? AND f.addresseeId = u.id) OR (f.addresseeId = ? AND f.requesterId = u.id))
        ) as isFriend
       FROM user u
       WHERE u.id != ? AND u.bannedAt IS NULL
         AND (? = '' OR u.firstName LIKE ? OR u.lastName LIKE ? OR CONCAT(u.firstName, ' ', u.lastName) LIKE ?)
         AND u.id NOT IN (
           SELECT blockedId FROM block WHERE blockerId = ?
           UNION
           SELECT blockerId FROM block WHERE blockedId = ?
         )
       ORDER BY isFriend DESC, u.firstName ASC
       LIMIT 8`,
      [payload.id, payload.id, payload.id, searchTerm, likeTerm, likeTerm, likeTerm, payload.id, payload.id]
    );

    const users = withAvatarUrl(rows).map((row) => ({ ...row, isFriend: Boolean(row.isFriend) }));
    return res.status(200).json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
