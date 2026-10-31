import { getUserFromRequest } from '@/lib/auth';
import { getPresenceStatus, canViewPresenceStatus } from '@/lib/presenceStatus';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const targetId = Number(req.query.userId);
  if (!Number.isInteger(targetId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const allowed = await canViewPresenceStatus(payload.id, targetId);
  if (!allowed) {
    return res.status(200).json({ success: true, status: null });
  }

  const status = await getPresenceStatus(targetId);
  return res.status(200).json({ success: true, status });
}
