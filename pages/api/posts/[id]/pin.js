import { getUserFromRequest } from '@/lib/auth';
import { pinPost, unpinPost } from '@/lib/pinnedPosts';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const postId = Number(req.query.id);
  if (!Number.isInteger(postId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  if (req.method === 'POST') {
    const result = await pinPost(payload.id, postId);
    if (!result.success) {
      return res.status(422).json({ success: false, message: result.message });
    }
    return res.status(200).json({ success: true, pinned: true });
  }

  if (req.method === 'DELETE') {
    await unpinPost(payload.id, postId);
    return res.status(200).json({ success: true, pinned: false });
  }

  res.setHeader('Allow', ['POST', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
