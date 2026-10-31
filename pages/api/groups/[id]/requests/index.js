import { getUserFromRequest } from '@/lib/auth';
import { isAdminOrOwner, getPendingRequests } from '@/lib/groups';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const groupId = Number(req.query.id);
  if (!Number.isInteger(groupId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  if (!(await isAdminOrOwner(groupId, payload.id))) {
    return res.status(403).json({ success: false, message: 'Action non autorisee' });
  }

  const requests = await getPendingRequests(groupId);
  return res.status(200).json({ success: true, requests });
}
