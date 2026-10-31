import { getUserFromRequest } from '@/lib/auth';
import { getFriendsList, getRelationStatus } from '@/lib/friends';
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

  const targetId = Number(req.query.id);
  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ success: false, message: 'Identifiant invalide' });
  }

  try {
    const relation = await getRelationStatus(payload.id, targetId);
    if (relation === 'blockedByMe' || relation === 'blockingMe') {
      return res.status(200).json({ success: true, items: [] });
    }

    const rows = await getFriendsList(targetId);
    const items = withAvatarUrl(rows);
    return res.status(200).json({ success: true, items });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
