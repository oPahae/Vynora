import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { joinGroup } from '@/lib/groups';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
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

  const result = await joinGroup(payload.id, groupId);
  if (!result.success) {
    return res.status(422).json(result);
  }

  await logActivity(payload.id, 'group_join', { targetType: 'group', targetId: groupId, meta: { status: result.status || null } });

  return res.status(200).json(result);
}
