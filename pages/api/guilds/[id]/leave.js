import { allowMethods, requireMember, denyUnless } from '@/lib/guildApi';
import { removeMember, emitToGuild } from '@/lib/guilds';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const member = await requireMember(req, res);
  if (!member) return;
  if (!denyUnless(res, !member.context.isOwner, 'Le proprietaire ne peut pas quitter son serveur : supprimez-le a la place')) return;

  try {
    await removeMember(member.guildId, member.userId);
    if (global.io) global.io.in(`user:${member.userId}`).socketsLeave(`guild:${member.guildId}`);
    emitToGuild(member.guildId, 'guild:members-changed', { guildId: member.guildId });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
