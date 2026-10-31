import { getUserFromRequest } from '@/lib/auth';
import { acceptGroupInvite, declineGroupInvite } from '@/lib/groups';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const groupId = Number(req.query.id);
  if (!Number.isInteger(groupId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  if (req.method === 'POST') {
    const result = await acceptGroupInvite(groupId, payload.id);
    if (!result.success) {
      return res.status(422).json(result);
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const result = await declineGroupInvite(groupId, payload.id);
    if (!result.success) {
      return res.status(422).json(result);
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['POST', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
