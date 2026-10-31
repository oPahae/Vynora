import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewStory, hydrateStories, STORY_SELECT } from '@/lib/stories';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const storyId = Number(req.query.id);
  if (!Number.isInteger(storyId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  if (req.method === 'GET') {
    try {
      const storyRows = await query('SELECT * FROM status WHERE id = ? AND expiresAt > NOW() LIMIT 1', [storyId]);
      if (storyRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Story introuvable ou expiree' });
      }

      const allowed = await canViewStory(payload.id, storyRows[0]);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Action non autorisee' });
      }

      const rows = await query(`${STORY_SELECT} WHERE s.id = ? LIMIT 1`, [storyId]);
      const [story] = await hydrateStories(rows, payload.id);

      return res.status(200).json({ success: true, story });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const storyRows = await query('SELECT * FROM status WHERE id = ? LIMIT 1', [storyId]);
      if (storyRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Story introuvable' });
      }
      if (storyRows[0].userId !== payload.id) {
        return res.status(403).json({ success: false, message: 'Action non autorisee' });
      }

      await query('DELETE FROM status WHERE id = ?', [storyId]);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  res.setHeader('Allow', ['GET', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
