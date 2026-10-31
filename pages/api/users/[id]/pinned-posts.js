import { getUserFromRequest } from '@/lib/auth';
import { getPinnedPosts } from '@/lib/pinnedPosts';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const profileId = Number(req.query.id);
  if (!Number.isInteger(profileId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const posts = await getPinnedPosts(profileId, payload.id);
    return res.status(200).json({ success: true, posts });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
