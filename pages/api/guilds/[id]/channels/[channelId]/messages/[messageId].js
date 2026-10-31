import { allowMethods, requireMember, requireChannel, denyUnless } from '@/lib/guildApi';
import { getMessage, deleteMessage, can, emitToChannel } from '@/lib/guilds';
import { PERMISSIONS } from '@/lib/guildPermissions';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['DELETE'])) return;
  const member = await requireMember(req, res);
  if (!member) return;
  const channel = await requireChannel(req, res, member);
  if (!channel) return;

  try {
    const message = await getMessage(Number(req.query.messageId));
    if (!message || message.channelId !== channel.id) {
      return res.status(404).json({ success: false, message: 'Message introuvable' });
    }
    const isAuthor = message.senderId === member.userId;
    if (!denyUnless(res, isAuthor || can(member.context, PERMISSIONS.MANAGE_MESSAGES))) return;

    await deleteMessage(message.id);
    await emitToChannel(channel, 'guild:message-deleted', { id: message.id, channelId: channel.id, guildId: channel.guildId });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
