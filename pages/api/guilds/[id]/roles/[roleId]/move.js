import { allowMethods, requireMember, denyUnless } from '@/lib/guildApi';
import { getRole, moveRole, canManageRole, emitToGuild } from '@/lib/guilds';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const member = await requireMember(req, res);
  if (!member) return;

  const direction = req.body?.direction;
  if (direction !== 'up' && direction !== 'down') {
    return res.status(422).json({ success: false, message: 'Direction invalide' });
  }

  try {
    const role = await getRole(member.guildId, Number(req.query.roleId));
    if (!role || role.isDefault) return res.status(404).json({ success: false, message: 'Role introuvable' });
    if (!denyUnless(res, canManageRole(member.context, role), 'Ce role est au-dessus du votre')) return;

    const moved = await moveRole(member.guildId, member.context, role.id, direction);
    if (!moved) return res.status(400).json({ success: false, message: 'Deplacement impossible' });
    emitToGuild(member.guildId, 'guild:updated', { guildId: member.guildId });
    emitToGuild(member.guildId, 'guild:members-changed', { guildId: member.guildId });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
