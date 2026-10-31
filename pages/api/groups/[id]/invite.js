import { getUserFromRequest } from '@/lib/auth';
import { inviteMember } from '@/lib/groups';
import { createNotification } from '@/lib/notifications';

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
  const targetUserId = Number(req.body?.userId);
  if (!Number.isInteger(groupId) || !Number.isInteger(targetUserId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const result = await inviteMember(groupId, payload.id, targetUserId);
    if (!result.success) {
      return res.status(422).json(result);
    }

    try {
      await createNotification({
        userId: targetUserId,
        actorId: payload.id,
        type: 'groupInvite',
        targetType: 'group',
        targetId: groupId,
        content: result.group?.name || null
      });
    } catch (notifyError) {
      // La notification n'est pas critique : on ignore un eventuel echec.
    }

    if (global.io) {
      global.io.to(`user:${targetUserId}`).emit('group:invited', { groupId });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
