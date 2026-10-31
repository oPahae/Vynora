import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getPremiumConfig, getPremiumStatus } from '@/lib/premium';

// Configuration publique du premium + statut et historique de l'utilisateur.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }
  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  try {
    const [config, status, payments, boosts] = await Promise.all([
      getPremiumConfig(),
      getPremiumStatus(payload.id),
      query(
        `SELECT id, status, amountMad, chargeAmount, chargeCurrency, premiumDays, createdAt, completedAt
         FROM payment WHERE userId = ? AND status = 'completed' ORDER BY id DESC LIMIT 10`,
        [payload.id]
      ),
      query('SELECT COUNT(*) AS count FROM postBoost WHERE userId = ? AND endsAt > NOW()', [payload.id])
    ]);
    return res.status(200).json({ success: true, config, status, payments, activeBoosts: Number(boosts[0].count) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
