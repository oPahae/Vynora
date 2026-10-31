import { allowMethods, requireMember, denyUnless, cleanName } from '@/lib/guildApi';
import {
  getRole,
  updateRole,
  deleteRole,
  canManageRole,
  canGrantPermissions,
  sanitizePermissions,
  emitToGuild
} from '@/lib/guilds';

const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['PUT', 'DELETE'])) return;
  const member = await requireMember(req, res);
  if (!member) return;

  try {
    const role = await getRole(member.guildId, Number(req.query.roleId));
    if (!role) return res.status(404).json({ success: false, message: 'Role introuvable' });

    if (req.method === 'DELETE') {
      if (role.isDefault) return res.status(400).json({ success: false, message: 'Le role @everyone ne peut pas etre supprime' });
      if (!denyUnless(res, canManageRole(member.context, role), 'Ce role est au-dessus du votre')) return;
      await deleteRole(role.id);
    } else {
      // @everyone : seules ses permissions sont modifiables, et uniquement
      // par le proprietaire (ou un administrateur) via la regle de grant.
      const isEveryone = role.isDefault;
      if (!isEveryone && !denyUnless(res, canManageRole(member.context, role), 'Ce role est au-dessus du votre')) return;
      if (isEveryone && !denyUnless(res, member.context.isOwner || member.context.permissions & 1)) return;

      const changes = {};
      if (req.body?.name !== undefined && !isEveryone) {
        const name = cleanName(req.body.name, 50);
        if (!name) return res.status(422).json({ success: false, message: 'Nom de role requis' });
        changes.name = name;
      }
      if (req.body?.color !== undefined && !isEveryone) {
        if (!COLOR_REGEX.test(req.body.color)) return res.status(422).json({ success: false, message: 'Couleur invalide' });
        changes.color = req.body.color;
      }
      if (req.body?.permissions !== undefined) {
        const permissions = sanitizePermissions(req.body.permissions);
        if (!denyUnless(res, canGrantPermissions(member.context, role.permissions, permissions), 'Vous ne pouvez pas accorder/retirer des permissions que vous ne possedez pas')) return;
        changes.permissions = permissions;
      }
      await updateRole(role.id, changes);
    }
    emitToGuild(member.guildId, 'guild:updated', { guildId: member.guildId });
    emitToGuild(member.guildId, 'guild:members-changed', { guildId: member.guildId });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
