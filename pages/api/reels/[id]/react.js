import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { REACTION_TYPES } from '@/lib/posts';
import { getVisibleReelRow, getReelAggregates } from '@/lib/reels';
import { createNotification } from '@/lib/notifications';
import { logActivity } from '@/lib/activity';

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
    const reel = await getVisibleReelRow(payload.id, reelId);
    if (!reel) return res.status(404).json({ success: false, message: 'Reel introuvable' });

    if (req.method === 'POST') {
      const type = (req.body?.type || '').toString();
      if (!REACTION_TYPES.includes(type)) {
        return res.status(422).json({ success: false, message: 'Type de reaction invalide' });
      }
      const existing = await query('SELECT type FROM reelReaction WHERE reelId = ? AND userId = ? LIMIT 1', [reelId, payload.id]);
      await query(
        `INSERT INTO reelReaction (reelId, userId, type) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE type = VALUES(type), createdAt = NOW()`,
        [reelId, payload.id, type]
      );
      if (reel.userId !== payload.id && !existing[0] && type !== 'dislike') {
        await createNotification({ userId: reel.userId, actorId: payload.id, type: 'like', targetType: 'reel', targetId: reelId });
      }
      await logActivity(payload.id, 'reaction', { targetType: 'reel', targetId: reelId, meta: { type } });
      const aggregates = await getReelAggregates(reelId, payload.id);
      return res.status(200).json({ success: true, ...aggregates });
    }

    if (req.method === 'DELETE') {
      await query('DELETE FROM reelReaction WHERE reelId = ? AND userId = ?', [reelId, payload.id]);
      const aggregates = await getReelAggregates(reelId, payload.id);
      return res.status(200).json({ success: true, ...aggregates });
    }

    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
