import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getRelationStatus, getMutualFriendsCount } from '@/lib/friends';
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

  // Recherche par identifiant exact (utilise par le scan de QR code).
  const exactId = req.query.id ? Number(req.query.id) : null;
  if (exactId && Number.isInteger(exactId)) {
    try {
      const rows = await query(
        `SELECT id, firstName, lastName, avatarId, ((premiumUntil IS NOT NULL AND premiumUntil > NOW()) OR role = 'admin') AS verified FROM user
         WHERE id = ? AND id != ? AND bannedAt IS NULL
           AND id NOT IN (SELECT blockedId FROM block WHERE blockerId = ? UNION SELECT blockerId FROM block WHERE blockedId = ?)
         LIMIT 1`,
        [exactId, payload.id, payload.id, payload.id]
      );
      const users = await Promise.all(
        withAvatarUrl(rows).map(async (user) => ({
          ...user,
          status: await getRelationStatus(payload.id, user.id),
          mutualFriendsCount: await getMutualFriendsCount(payload.id, user.id)
        }))
      );
      return res.status(200).json({ success: true, users });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  const searchTerm = (req.query.q || '').toString().trim();
  if (searchTerm.length < 2) {
    return res.status(200).json({ success: true, users: [] });
  }

  try {
    const likeTerm = `%${searchTerm}%`;
    const rows = await query(
      `SELECT id, firstName, lastName, avatarId, ((premiumUntil IS NOT NULL AND premiumUntil > NOW()) OR role = 'admin') AS verified
       FROM user
       WHERE id != ? AND bannedAt IS NULL AND (firstName LIKE ? OR lastName LIKE ? OR CONCAT(firstName, ' ', lastName) LIKE ?)
         AND id NOT IN (
           SELECT blockedId FROM block WHERE blockerId = ?
           UNION
           SELECT blockerId FROM block WHERE blockedId = ?
         )
       LIMIT 15`,
      [payload.id, likeTerm, likeTerm, likeTerm, payload.id, payload.id]
    );

    const users = await Promise.all(
      withAvatarUrl(rows).map(async (user) => ({
        ...user,
        status: await getRelationStatus(payload.id, user.id),
        mutualFriendsCount: await getMutualFriendsCount(payload.id, user.id)
      }))
    );

    return res.status(200).json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
