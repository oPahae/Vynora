import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getRelationStatus, getMutualFriendsCount, getFriendsCount, getBlockStatus } from '@/lib/friends';
import { withProfileUrls } from '@/lib/upload';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const targetId = Number(req.query.id);
  if (!Number.isInteger(targetId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const rows = await query(
      'SELECT id, firstName, lastName, avatarId, coverId, bio, work, education, city, country, createdAt FROM user WHERE id = ? LIMIT 1',
      [targetId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    const isSelf = payload.id === targetId;
    const { blockedByMe, blockingMe } = await getBlockStatus(payload.id, targetId);
    const status = await getRelationStatus(payload.id, targetId);
    const mutualFriendsCount = isSelf ? 0 : await getMutualFriendsCount(payload.id, targetId);
    const friendsCount = await getFriendsCount(targetId);

    return res.status(200).json({
      success: true,
      profile: withProfileUrls(rows[0]),
      relation: { status, blockedByMe, blockingMe },
      mutualFriendsCount,
      friendsCount,
      isSelf
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
