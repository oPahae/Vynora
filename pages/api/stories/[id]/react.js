import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { REACTION_TYPES } from '@/lib/posts';
import { canViewStory, getStoryAggregates } from '@/lib/stories';
import { createNotification } from '@/lib/notifications';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const storyId = Number(req.query.id);
  if (!Number.isInteger(storyId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const storyRows = await query('SELECT * FROM status WHERE id = ? AND expiresAt > NOW() LIMIT 1', [storyId]);
  if (storyRows.length === 0) {
    return res.status(404).json({ success: false, message: 'Story introuvable ou expiree' });
  }

  const allowed = await canViewStory(payload.id, storyRows[0]);
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Action non autorisee' });
  }

  if (req.method === 'POST') {
    const type = (req.body?.type || '').toString();
    if (!REACTION_TYPES.includes(type)) {
      return res.status(422).json({ success: false, message: 'Type de reaction invalide' });
    }

    try {
      await query(
        `INSERT INTO statusReaction (userId, statusId, type) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE type = VALUES(type), createdAt = NOW()`,
        [payload.id, storyId, type]
      );

      if (storyRows[0].userId !== payload.id) {
        await createNotification({
          userId: storyRows[0].userId,
          actorId: payload.id,
          type: 'status',
          targetType: 'status',
          targetId: storyId
        });
      }

      const aggregates = await getStoryAggregates(storyId, payload.id);
      return res.status(200).json({ success: true, ...aggregates });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await query('DELETE FROM statusReaction WHERE statusId = ? AND userId = ?', [storyId, payload.id]);
      const aggregates = await getStoryAggregates(storyId, payload.id);
      return res.status(200).json({ success: true, ...aggregates });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  res.setHeader('Allow', ['POST', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
