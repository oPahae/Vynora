import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { withAvatarUrl } from '@/lib/upload';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
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
    const storyRows = await query('SELECT * FROM status WHERE id = ? LIMIT 1', [storyId]);
    if (storyRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Story introuvable' });
    }
    if (storyRows[0].userId !== payload.id) {
      return res.status(403).json({ success: false, message: 'Action non autorisee' });
    }

    const rows = await query(
      `SELECT u.id, u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified, v.createdAt as viewedAt, r.type as reactionType
       FROM statusView v
       JOIN user u ON u.id = v.userId
       LEFT JOIN statusReaction r ON r.statusId = v.statusId AND r.userId = v.userId
       WHERE v.statusId = ?
       ORDER BY v.createdAt DESC`,
      [storyId]
    );

    return res.status(200).json({ success: true, viewers: withAvatarUrl(rows) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
