import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getMutualFriendsCount } from '@/lib/friends';
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
    const candidates = await query(
      `SELECT u.id, u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified
       FROM user u
       WHERE u.id != ? AND u.bannedAt IS NULL AND u.deactivatedAt IS NULL
         AND u.id NOT IN (
           SELECT CASE WHEN requesterId = ? THEN addresseeId ELSE requesterId END
           FROM friend WHERE requesterId = ? OR addresseeId = ?
         )
         AND u.id NOT IN (
           SELECT blockedId FROM block WHERE blockerId = ?
           UNION
           SELECT blockerId FROM block WHERE blockedId = ?
         )
       ORDER BY u.createdAt DESC
       LIMIT 30`,
      [payload.id, payload.id, payload.id, payload.id, payload.id, payload.id]
    );

    const candidatesWithAvatar = withAvatarUrl(candidates);

    const withMutuals = await Promise.all(
      candidatesWithAvatar.map(async (candidate) => ({
        ...candidate,
        status: 'none',
        mutualFriendsCount: await getMutualFriendsCount(payload.id, candidate.id)
      }))
    );

    withMutuals.sort((a, b) => b.mutualFriendsCount - a.mutualFriendsCount);

    return res.status(200).json({ success: true, items: withMutuals.slice(0, 12) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
