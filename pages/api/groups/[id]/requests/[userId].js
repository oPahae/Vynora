import { getUserFromRequest } from '@/lib/auth';
import { approveJoinRequest, rejectJoinRequest } from '@/lib/groups';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const groupId = Number(req.query.id);
  const targetUserId = Number(req.query.userId);
  if (!Number.isInteger(groupId) || !Number.isInteger(targetUserId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  if (req.method === 'POST') {
    const result = await approveJoinRequest(groupId, payload.id, targetUserId);
    if (!result.success) return res.status(403).json(result);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const result = await rejectJoinRequest(groupId, payload.id, targetUserId);
    if (!result.success) return res.status(403).json(result);
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['POST', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
