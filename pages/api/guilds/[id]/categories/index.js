import { allowMethods, requireMember, denyUnless, cleanName } from '@/lib/guildApi';
import { createCategory, can, emitToGuild } from '@/lib/guilds';
import { PERMISSIONS } from '@/lib/guildPermissions';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const member = await requireMember(req, res);
  if (!member) return;
  if (!denyUnless(res, can(member.context, PERMISSIONS.MANAGE_CHANNELS))) return;

  const name = cleanName(req.body?.name, 60);
  if (!name) return res.status(422).json({ success: false, message: 'Nom de categorie requis' });

  try {
    const category = await createCategory(member.guildId, name);
    emitToGuild(member.guildId, 'guild:updated', { guildId: member.guildId });
    return res.status(201).json({ success: true, category });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
