import { getUserFromRequest } from '@/lib/auth';
import { removeMember, setMemberRole, getGroupById } from '@/lib/groups';
import { createNotification } from '@/lib/notifications';

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

  if (req.method === 'DELETE') {
    const result = await removeMember(groupId, payload.id, targetUserId);
    if (!result.success) {
      return res.status(403).json(result);
    }

    try {
      const group = await getGroupById(groupId);
      await createNotification({
        userId: targetUserId,
        actorId: payload.id,
        type: 'groupRemoved',
        targetType: 'group',
        targetId: groupId,
        content: group?.name || null
      });
    } catch (notifyError) {
      // La notification n'est pas critique : on ignore un eventuel echec.
    }

    return res.status(200).json({ success: true });
  }

  if (req.method === 'PUT') {
    const role = (req.body?.role || '').toString();
    const result = await setMemberRole(groupId, payload.id, targetUserId, role);
    if (!result.success) {
      return res.status(403).json(result);
    }

    if (role === 'admin') {
      try {
        const group = await getGroupById(groupId);
        await createNotification({
          userId: targetUserId,
          actorId: payload.id,
          type: 'groupRoleChange',
          targetType: 'group',
          targetId: groupId,
          content: group?.name || null
        });
      } catch (notifyError) {
        // La notification n'est pas critique : on ignore un eventuel echec.
      }
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['PUT', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
