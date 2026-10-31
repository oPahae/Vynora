import { allowMethods, requireMember, denyUnless } from '@/lib/guildApi';
import { getMemberContext, removeMember, can, emitToGuild } from '@/lib/guilds';
import { PERMISSIONS } from '@/lib/guildPermissions';

// Expulsion d'un membre (KICK_MEMBERS, avec respect de la hierarchie).
export default async function handler(req, res) {
  if (!allowMethods(req, res, ['DELETE'])) return;
  const member = await requireMember(req, res);
  if (!member) return;
  if (!denyUnless(res, can(member.context, PERMISSIONS.KICK_MEMBERS))) return;

  try {
    const targetId = Number(req.query.userId);
    const target = Number.isInteger(targetId) ? await getMemberContext(member.guildId, targetId) : null;
    if (!target) return res.status(404).json({ success: false, message: 'Membre introuvable' });
    if (targetId === member.userId) return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous expulser vous-meme' });
    if (target.isOwner) return res.status(403).json({ success: false, message: 'Le proprietaire ne peut pas etre expulse' });
    if (!member.context.isOwner && target.topPosition >= member.context.topPosition) {
      return res.status(403).json({ success: false, message: 'Ce membre a un role egal ou superieur au votre' });
    }

    await removeMember(member.guildId, targetId);
    if (global.io) {
      global.io.to(`user:${targetId}`).emit('guild:deleted', { guildId: member.guildId });
      global.io.in(`user:${targetId}`).socketsLeave(`guild:${member.guildId}`);
    }
    emitToGuild(member.guildId, 'guild:members-changed', { guildId: member.guildId });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
