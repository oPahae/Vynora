import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { createGroup, listMyGroups, discoverGroups, listMyGroupInvitations } from '@/lib/groups';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  if (req.method === 'GET') {
    const offset = Number(req.query.offset) || 0;
    const limit = Math.min(Number(req.query.limit) || 12, 30);
    const scope = ['discover', 'invitations'].includes(req.query.scope) ? req.query.scope : 'mine';

    let result;
    if (scope === 'discover') {
      result = await discoverGroups(payload.id, offset, limit);
    } else if (scope === 'invitations') {
      result = await listMyGroupInvitations(payload.id, offset, limit);
    } else {
      result = await listMyGroups(payload.id, offset, limit);
    }
    return res.status(200).json({ success: true, ...result });
  }

  if (req.method === 'POST') {
    const name = (req.body?.name || '').toString().trim();
    const description = (req.body?.description || '').toString().trim();
    const visibility = (req.body?.visibility || 'public').toString();

    if (!name) {
      return res.status(422).json({ success: false, message: 'Le nom du groupe est requis' });
    }

    const result = await createGroup(payload.id, { name, description, visibility });
    if (!result.success) {
      return res.status(422).json(result);
    }

    await logActivity(payload.id, 'group_create', { targetType: 'group', targetId: result.groupId, meta: { name } });

    return res.status(201).json({ success: true, groupId: result.groupId });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
