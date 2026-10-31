import { getUserFromRequest } from '@/lib/auth';
import { getGroupById, getMembership, canViewGroupContent, updateGroup, deleteGroup } from '@/lib/groups';

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const groupId = Number(req.query.id);
  if (!Number.isInteger(groupId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  if (req.method === 'GET') {
    const group = await getGroupById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Groupe introuvable' });
    }

    const membership = await getMembership(groupId, payload.id);
    const canViewContent = await canViewGroupContent(payload.id, groupId, group.visibility);

    return res.status(200).json({
      success: true,
      group,
      membership: membership || null,
      canViewContent
    });
  }

  if (req.method === 'PUT') {
    const { name, description, visibility } = req.body || {};
    const result = await updateGroup(groupId, payload.id, { name, description, visibility });
    if (!result.success) {
      return res.status(403).json(result);
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const result = await deleteGroup(groupId, payload.id);
    if (!result.success) {
      return res.status(403).json(result);
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
