import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { getVisibleReelRow, hydrateReels, syncReelHashtags, REEL_SELECT } from '@/lib/reels';
import { logActivity, snippet } from '@/lib/activity';

const VISIBILITIES = ['public', 'friends', 'private'];

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
    const row = await getVisibleReelRow(payload.id, reelId);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Reel introuvable' });
    }

    if (req.method === 'GET') {
      const [reel] = await hydrateReels([row], payload.id);
      return res.status(200).json({ success: true, reel });
    }

    if (req.method === 'PUT') {
      if (row.userId !== payload.id) return res.status(403).json({ success: false, message: 'Action non autorisee' });
      const caption = (req.body?.caption || '').toString().trim().slice(0, 500) || null;
      const visibility = req.body?.visibility ? req.body.visibility.toString() : row.visibility;
      if (!VISIBILITIES.includes(visibility)) {
        return res.status(422).json({ success: false, message: 'Visibilite invalide' });
      }
      await query('UPDATE reel SET caption = ?, visibility = ?, isEdited = 1 WHERE id = ?', [caption, visibility, reelId]);
      await syncReelHashtags(reelId, caption);
      const updated = await query(`${REEL_SELECT} WHERE r.id = ? LIMIT 1`, [reelId]);
      const [reel] = await hydrateReels(updated, payload.id);
      return res.status(200).json({ success: true, reel });
    }

    if (req.method === 'DELETE') {
      if (row.userId !== payload.id) {
        return res.status(403).json({ success: false, message: 'Action non autorisee' });
      }
      await query('UPDATE reel SET deletedAt = NOW() WHERE id = ?', [reelId]);
      await logActivity(payload.id, 'reel_delete', { targetType: 'reel', targetId: reelId, meta: { snippet: snippet(row.caption) } });
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
