import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { mediaUrl } from '@/lib/upload';

// Acheteurs de Premium (paiements finalises) + statistiques de vente.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  try {
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const limit = 15;

    const buyers = await query(
      `SELECT u.id, u.firstName, u.lastName, u.avatarId, u.premiumUntil,
              COUNT(p.id) AS purchases, SUM(p.amountMad) AS totalMad,
              MIN(p.completedAt) AS firstAt, MAX(p.completedAt) AS lastAt
       FROM payment p JOIN user u ON u.id = p.userId
       WHERE p.status = 'completed'
       GROUP BY u.id ORDER BY lastAt DESC LIMIT ${limit + 1} OFFSET ${offset}`
    );

    // Les statistiques ne sont calculees qu'a la premiere page.
    let stats = null;
    if (offset === 0) {
      const [totals] = await query(`
        SELECT
          COALESCE(SUM(amountMad), 0) AS totalMad,
          COALESCE(SUM(completedAt >= CURDATE()) , 0) AS todayCount,
          COALESCE(SUM(IF(completedAt >= CURDATE(), amountMad, 0)), 0) AS todayMad,
          COALESCE(SUM(IF(completedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY), amountMad, 0)), 0) AS week7Mad,
          COALESCE(SUM(IF(completedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY), amountMad, 0)), 0) AS month30Mad,
          COUNT(DISTINCT userId) AS buyers,
          COUNT(*) AS payments
        FROM payment WHERE status = 'completed'`);
      const [repeat] = await query(
        "SELECT COUNT(*) AS repeatBuyers FROM (SELECT userId FROM payment WHERE status = 'completed' GROUP BY userId HAVING COUNT(*) > 1) t"
      );
      const [users] = await query('SELECT COUNT(*) AS total FROM user');
      const [active] = await query('SELECT COUNT(*) AS count FROM user WHERE premiumUntil IS NOT NULL AND premiumUntil > NOW()');
      const daily = await query(
        `SELECT DATE(completedAt) AS day, COUNT(*) AS count, SUM(amountMad) AS amount FROM payment
         WHERE status = 'completed' AND completedAt >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) GROUP BY DATE(completedAt)`
      );

      const days = [];
      for (let back = 13; back >= 0; back -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - back);
        days.push(date.toISOString().slice(0, 10));
      }
      const map = Object.fromEntries(daily.map((row) => [String(row.day).slice(0, 10), { count: Number(row.count), amount: Number(row.amount) }]));

      const buyersCount = Number(totals.buyers);
      stats = {
        totalMad: Number(totals.totalMad),
        todayMad: Number(totals.todayMad),
        todayCount: Number(totals.todayCount),
        week7Mad: Number(totals.week7Mad),
        month30Mad: Number(totals.month30Mad),
        buyers: buyersCount,
        payments: Number(totals.payments),
        repeatBuyers: Number(repeat.repeatBuyers),
        activePremium: Number(active.count),
        avgPerBuyerMad: buyersCount > 0 ? Math.round((Number(totals.totalMad) / buyersCount) * 100) / 100 : 0,
        conversionRate: Number(users.total) > 0 ? Math.round((buyersCount / Number(users.total)) * 1000) / 10 : 0,
        daily: days.map((day) => ({ day, count: map[day]?.count || 0, amount: map[day]?.amount || 0 }))
      };
    }

    const now = Date.now();
    return res.status(200).json({
      success: true,
      stats,
      hasMore: buyers.length > limit,
      buyers: buyers.slice(0, limit).map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        avatar: mediaUrl(row.avatarId),
        purchases: Number(row.purchases),
        totalMad: Number(row.totalMad),
        firstAt: row.firstAt,
        lastAt: row.lastAt,
        premiumUntil: row.premiumUntil,
        active: Boolean(row.premiumUntil && new Date(String(row.premiumUntil).replace(' ', 'T')).getTime() > now)
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
