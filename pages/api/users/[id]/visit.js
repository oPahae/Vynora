import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getBlockStatus } from '@/lib/friends';

// Enregistre la visite du profil de :id par l'utilisateur connecte.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  const profileId = Number(req.query.id);
  if (!Number.isInteger(profileId) || profileId === payload.id) return res.status(200).json({ success: true });

  try {
    const { blockedByMe, blockingMe } = await getBlockStatus(payload.id, profileId);
    if (blockedByMe || blockingMe) return res.status(200).json({ success: true });
    const exists = await query('SELECT id FROM user WHERE id = ? AND bannedAt IS NULL LIMIT 1', [profileId]);
    if (!exists[0]) return res.status(200).json({ success: true });

    await query(
      `INSERT INTO profileVisit (profileId, visitorId) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
         visitCount = IF(lastVisitedAt < DATE_SUB(NOW(), INTERVAL 30 MINUTE), visitCount + 1, visitCount),
         lastVisitedAt = NOW()`,
      [profileId, payload.id]
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(200).json({ success: true });
  }
}
