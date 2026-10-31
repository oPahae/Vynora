import { allowMethods, requireMember, requireChannel, denyUnless, cleanName, toIdList } from '@/lib/guildApi';
import { updateChannel, deleteChannel, getChannelAccess, can, emitToGuild } from '@/lib/guilds';
import { PERMISSIONS } from '@/lib/guildPermissions';

// GET : reglages d'acces d'un salon (roles/membres autorises) ; PUT :
// modification ; DELETE : suppression. Reserve a MANAGE_CHANNELS.
export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'PUT', 'DELETE'])) return;
  const member = await requireMember(req, res);
  if (!member) return;
  if (!denyUnless(res, can(member.context, PERMISSIONS.MANAGE_CHANNELS))) return;
  const channel = await requireChannel(req, res, member);
  if (!channel) return;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ success: true, channel, access: await getChannelAccess(channel.id) });
    }
    if (req.method === 'DELETE') {
      await deleteChannel(channel.id);
    } else {
      const body = req.body || {};
      const changes = {};
      if (body.name !== undefined) {
        const name = cleanName(body.name, 60);
        if (!name) return res.status(422).json({ success: false, message: 'Nom de salon requis' });
        changes.name = channel.type === 'text' ? name.toLowerCase().replace(/\s/g, '-') : name;
      }
      if (body.topic !== undefined) changes.topic = cleanName(body.topic, 200);
      if (body.categoryId !== undefined) changes.categoryId = Number(body.categoryId) || null;
      if (body.isPrivate !== undefined) changes.isPrivate = Boolean(body.isPrivate);
      if (body.roleIds !== undefined) changes.roleIds = toIdList(body.roleIds);
      if (body.userIds !== undefined) changes.userIds = toIdList(body.userIds);
      await updateChannel(channel, changes);
    }
    emitToGuild(member.guildId, 'guild:updated', { guildId: member.guildId });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
