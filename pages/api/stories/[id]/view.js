import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewStory } from '@/lib/stories';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const storyId = Number(req.query.id);
  if (!Number.isInteger(storyId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const storyRows = await query('SELECT * FROM status WHERE id = ? AND expiresAt > NOW() LIMIT 1', [storyId]);
    if (storyRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Story introuvable ou expiree' });
    }

    if (storyRows[0].userId === payload.id) {
      return res.status(200).json({ success: true, recorded: false });
    }

    const allowed = await canViewStory(payload.id, storyRows[0]);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Action non autorisee' });
    }

    const result = await query('INSERT IGNORE INTO statusView (statusId, userId) VALUES (?, ?)', [storyId, payload.id]);
    return res.status(200).json({ success: true, recorded: result.affectedRows > 0 });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
