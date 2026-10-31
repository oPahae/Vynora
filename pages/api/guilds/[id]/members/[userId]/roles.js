import { allowMethods, requireMember, denyUnless, toIdList } from '@/lib/guildApi';
import { getMemberContext, getMemberRoleIds, setMemberRoles, can, emitToGuild } from '@/lib/guilds';
import { PERMISSIONS } from '@/lib/guildPermissions';

// GET : ids des roles d'un membre ; PUT : remplace ses roles. Necessite
// MANAGE_ROLES et un role plus haut que ceux modifies ET que le membre cible.
export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'PUT'])) return;
  const member = await requireMember(req, res);
  if (!member) return;
  if (!denyUnless(res, can(member.context, PERMISSIONS.MANAGE_ROLES))) return;

  try {
    const targetId = Number(req.query.userId);
    const target = Number.isInteger(targetId) ? await getMemberContext(member.guildId, targetId) : null;
    if (!target) return res.status(404).json({ success: false, message: 'Membre introuvable' });

    if (req.method === 'GET') {
      return res.status(200).json({ success: true, roleIds: await getMemberRoleIds(member.guildId, targetId) });
    }

    if (target.isOwner && targetId !== member.userId) {
      return res.status(403).json({ success: false, message: 'Les roles du proprietaire ne peuvent etre modifies que par lui-meme' });
    }
    if (targetId !== member.userId && !member.context.isOwner && target.topPosition >= member.context.topPosition) {
      return res.status(403).json({ success: false, message: 'Ce membre a un role egal ou superieur au votre' });
    }

    const result = await setMemberRoles(member.guildId, member.context, target, toIdList(req.body?.roleIds));
    if (result.error) return res.status(403).json({ success: false, message: result.error });

    emitToGuild(member.guildId, 'guild:members-changed', { guildId: member.guildId });
    emitToGuild(member.guildId, 'guild:updated', { guildId: member.guildId });
    return res.status(200).json({ success: true, roleIds: result.roleIds });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
