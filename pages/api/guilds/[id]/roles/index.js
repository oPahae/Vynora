import { allowMethods, requireMember, denyUnless, cleanName } from '@/lib/guildApi';
import {
  listRoles,
  createRole,
  can,
  canGrantPermissions,
  sanitizePermissions,
  emitToGuild,
  MAX_ROLES_PER_GUILD
} from '@/lib/guilds';
import { PERMISSIONS } from '@/lib/guildPermissions';

const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

// GET : liste des roles (tout membre) ; POST : creation (MANAGE_ROLES).
export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST'])) return;
  const member = await requireMember(req, res);
  if (!member) return;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ success: true, roles: await listRoles(member.guildId) });
    }

    if (!denyUnless(res, can(member.context, PERMISSIONS.MANAGE_ROLES))) return;
    const name = cleanName(req.body?.name, 50);
    if (!name) return res.status(422).json({ success: false, message: 'Nom de role requis' });
    const color = COLOR_REGEX.test(req.body?.color) ? req.body.color : '#99AAB5';
    const permissions = sanitizePermissions(req.body?.permissions);
    if (!denyUnless(res, canGrantPermissions(member.context, 0, permissions), 'Vous ne pouvez pas accorder des permissions que vous ne possedez pas')) return;

    const roles = await listRoles(member.guildId);
    if (roles.length >= MAX_ROLES_PER_GUILD) {
      return res.status(422).json({ success: false, message: `Maximum ${MAX_ROLES_PER_GUILD} roles par serveur` });
    }

    const role = await createRole(member.guildId, { name, color, permissions });
    emitToGuild(member.guildId, 'guild:updated', { guildId: member.guildId });
    return res.status(201).json({ success: true, role });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
