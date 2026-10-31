import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { canViewPost } from '@/lib/posts';
import { savePost, unsavePost, isPostSaved } from '@/lib/savedPosts';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const postId = Number(req.query.id);
  if (!Number.isInteger(postId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const postRows = await query('SELECT id, userId, visibility FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [
    postId
  ]);
  if (postRows.length === 0) {
    return res.status(404).json({ success: false, message: 'Publication introuvable' });
  }

  const allowed = await canViewPost(payload.id, postRows[0]);
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Action non autorisee' });
  }

  if (req.method === 'POST') {
    await savePost(payload.id, postId);
    return res.status(200).json({ success: true, saved: true });
  }

  if (req.method === 'DELETE') {
    await unsavePost(payload.id, postId);
    return res.status(200).json({ success: true, saved: false });
  }

  if (req.method === 'GET') {
    const saved = await isPostSaved(payload.id, postId);
    return res.status(200).json({ success: true, saved });
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
