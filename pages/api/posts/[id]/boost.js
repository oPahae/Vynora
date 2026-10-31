import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getPremiumStatus } from '@/lib/premium';
import { getSettings } from '@/lib/settings';

// POST   : booste ma publication (premium requis) pendant `boost_hours` heures
// DELETE : arrete le boost
export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Non authentifie' });

  const postId = Number(req.query.id);
  if (!Number.isInteger(postId)) return res.status(422).json({ success: false, message: 'Requete invalide' });

  try {
    const posts = await query('SELECT id, userId, visibility, groupId FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [postId]);
    const post = posts[0];
    if (!post || post.userId !== payload.id) return res.status(404).json({ success: false, message: 'Publication introuvable' });

    if (req.method === 'DELETE') {
      await query('DELETE FROM postBoost WHERE postId = ?', [postId]);
      return res.status(200).json({ success: true, boostedUntil: null });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST', 'DELETE']);
      return res.status(405).json({ success: false, message: 'Methode non autorisee' });
    }

    const status = await getPremiumStatus(payload.id);
    if (!status.active) return res.status(402).json({ success: false, premiumRequired: true, message: 'Fonctionnalite reservee aux comptes premium' });

    if (post.groupId || post.visibility !== 'public') {
      return res.status(422).json({ success: false, message: 'Seules les publications publiques (hors groupes) peuvent etre boostees' });
    }

    const settings = await getSettings();
    const hours = Number(settings.boost_hours);
    const max = Number(settings.boost_max_active);

    const active = await query('SELECT postId FROM postBoost WHERE userId = ? AND endsAt > NOW()', [payload.id]);
    const alreadyBoosted = active.some((row) => row.postId === postId);
    if (!alreadyBoosted && active.length >= max) {
      return res.status(422).json({ success: false, message: `Limite atteinte : ${max} boosts actifs en meme temps` });
    }

    await query('DELETE FROM postBoost WHERE postId = ?', [postId]);
    await query('INSERT INTO postBoost (postId, userId, endsAt) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))', [postId, payload.id, hours]);
    const rows = await query('SELECT endsAt FROM postBoost WHERE postId = ? ORDER BY id DESC LIMIT 1', [postId]);
    return res.status(200).json({ success: true, boostedUntil: rows[0].endsAt });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
