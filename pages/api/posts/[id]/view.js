import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewPost } from '@/lib/posts';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const postId = Number(req.query.id);
  if (!Number.isInteger(postId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const postRows = await query(
      'SELECT id, userId, visibility FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1',
      [postId]
    );
    if (postRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Publication introuvable' });
    }

    if (postRows[0].userId === payload.id) {
      return res.status(200).json({ success: true, recorded: false });
    }

    const allowed = await canViewPost(payload.id, postRows[0]);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Action non autorisee' });
    }

    const result = await query('INSERT IGNORE INTO postView (postId, userId) VALUES (?, ?)', [postId, payload.id]);
    if (result.affectedRows > 0) {
      await query('UPDATE post SET viewsCount = viewsCount + 1 WHERE id = ?', [postId]);
    }

    return res.status(200).json({ success: true, recorded: result.affectedRows > 0 });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
