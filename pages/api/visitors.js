import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { mediaUrl } from '@/lib/upload';
import { getPremiumStatus } from '@/lib/premium';

// Visiteurs de mon profil. Les visites sont enregistrees pour tout le monde ;
// leur detail est reserve aux comptes premium (les autres voient seulement un compteur).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  try {
    const [status, totals] = await Promise.all([
      getPremiumStatus(payload.id),
      query(
        `SELECT COUNT(*) AS total,
                SUM(lastVisitedAt > DATE_SUB(NOW(), INTERVAL 7 DAY)) AS last7
         FROM profileVisit pv JOIN user u ON u.id = pv.visitorId AND u.bannedAt IS NULL
         WHERE pv.profileId = ?`,
        [payload.id]
      )
    ]);
    const summary = { total: Number(totals[0].total), last7Days: Number(totals[0].last7 || 0) };

    if (!status.active) {
      return res.status(200).json({ success: true, premium: false, ...summary, visitors: [] });
    }

    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const limit = 20;
    const rows = await query(
      `SELECT u.id, u.firstName, u.lastName, u.avatarId, pv.lastVisitedAt, pv.visitCount
       FROM profileVisit pv JOIN user u ON u.id = pv.visitorId AND u.bannedAt IS NULL
       WHERE pv.profileId = ?
       ORDER BY pv.lastVisitedAt DESC LIMIT ${limit + 1} OFFSET ${offset}`,
      [payload.id]
    );
    return res.status(200).json({
      success: true,
      premium: true,
      ...summary,
      hasMore: rows.length > limit,
      visitors: rows.slice(0, limit).map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        avatar: mediaUrl(row.avatarId),
        lastVisitedAt: row.lastVisitedAt,
        visitCount: row.visitCount
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
