import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getVisibleReelRow } from '@/lib/reels';

// "Ce reel ne m'interesse pas" : le retire de mon flux et alimente la recommandation.
export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const reelId = Number(req.query.id);
  if (!Number.isInteger(reelId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    if (req.method === 'POST') {
      const reel = await getVisibleReelRow(payload.id, reelId);
      if (!reel) return res.status(404).json({ success: false, message: 'Reel introuvable' });
      await query('INSERT IGNORE INTO reelHidden (reelId, userId) VALUES (?, ?)', [reelId, payload.id]);
      return res.status(200).json({ success: true });
    }
    if (req.method === 'DELETE') {
      await query('DELETE FROM reelHidden WHERE reelId = ? AND userId = ?', [reelId, payload.id]);
      return res.status(200).json({ success: true });
    }
    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
