import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { mediaUrl } from '@/lib/upload';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  try {
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const limit = 20;
    const [rows, totals, active] = await Promise.all([
      query(
        `SELECT p.id, p.orderId, p.status, p.amountMad, p.chargeAmount, p.chargeCurrency, p.premiumDays, p.payerEmail, p.createdAt, p.completedAt,
                u.id AS userId, u.firstName, u.lastName, u.avatarId
         FROM payment p JOIN user u ON u.id = p.userId
         ORDER BY p.id DESC LIMIT ${limit + 1} OFFSET ${offset}`
      ),
      query("SELECT COUNT(*) AS count, COALESCE(SUM(amountMad), 0) AS totalMad FROM payment WHERE status = 'completed'"),
      query('SELECT COUNT(*) AS count FROM user WHERE premiumUntil IS NOT NULL AND premiumUntil > NOW()')
    ]);
    return res.status(200).json({
      success: true,
      totals: { payments: Number(totals[0].count), totalMad: Number(totals[0].totalMad), activePremium: Number(active[0].count) },
      hasMore: rows.length > limit,
      items: rows.slice(0, limit).map((row) => ({
        id: row.id,
        orderId: row.orderId,
        status: row.status,
        amountMad: Number(row.amountMad),
        chargeAmount: row.chargeAmount,
        chargeCurrency: row.chargeCurrency,
        premiumDays: row.premiumDays,
        payerEmail: row.payerEmail,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
        user: { id: row.userId, firstName: row.firstName, lastName: row.lastName, avatar: mediaUrl(row.avatarId) }
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
