import { getUserFromRequest } from '@/lib/auth';
import { getPresenceStatusBatch, canViewPresenceStatus } from '@/lib/presenceStatus';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const userIds = (req.query.userIds || '')
    .toString()
    .split(',')
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id))
    .slice(0, 100);

  if (userIds.length === 0) {
    return res.status(200).json({ success: true, statuses: {} });
  }

  const allStatuses = await getPresenceStatusBatch(userIds);

  const visibleEntries = await Promise.all(
    Object.keys(allStatuses).map(async (id) => {
      const targetId = Number(id);
      const allowed = await canViewPresenceStatus(payload.id, targetId);
      return allowed ? [targetId, allStatuses[targetId]] : null;
    })
  );

  const statuses = Object.fromEntries(visibleEntries.filter(Boolean));

  return res.status(200).json({ success: true, statuses });
}
