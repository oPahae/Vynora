import { allowMethods, requireMember, denyUnless, cleanName, toIdList } from '@/lib/guildApi';
import { createChannel, can, emitToGuild } from '@/lib/guilds';
import { PERMISSIONS } from '@/lib/guildPermissions';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const member = await requireMember(req, res);
  if (!member) return;
  if (!denyUnless(res, can(member.context, PERMISSIONS.MANAGE_CHANNELS))) return;

  const name = cleanName(req.body?.name, 60);
  const type = req.body?.type === 'voice' ? 'voice' : 'text';
  if (!name) return res.status(422).json({ success: false, message: 'Nom de salon requis' });

  try {
    const result = await createChannel(member.guildId, {
      name: type === 'text' ? name.toLowerCase().replace(/\s/g, '-') : name,
      type,
      categoryId: Number(req.body?.categoryId) || null,
      topic: cleanName(req.body?.topic, 200),
      isPrivate: Boolean(req.body?.isPrivate),
      roleIds: toIdList(req.body?.roleIds),
      userIds: toIdList(req.body?.userIds)
    });
    if (result.error) return res.status(422).json({ success: false, message: result.error });
    emitToGuild(member.guildId, 'guild:updated', { guildId: member.guildId });
    return res.status(201).json({ success: true, channel: result.channel });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
