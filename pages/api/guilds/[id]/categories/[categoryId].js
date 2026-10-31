import { allowMethods, requireMember, denyUnless, cleanName } from '@/lib/guildApi';
import { updateCategory, deleteCategory, can, emitToGuild } from '@/lib/guilds';
import { PERMISSIONS } from '@/lib/guildPermissions';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['PUT', 'DELETE'])) return;
  const member = await requireMember(req, res);
  if (!member) return;
  if (!denyUnless(res, can(member.context, PERMISSIONS.MANAGE_CHANNELS))) return;

  const categoryId = Number(req.query.categoryId);
  try {
    let done;
    if (req.method === 'PUT') {
      const name = cleanName(req.body?.name, 60);
      if (!name) return res.status(422).json({ success: false, message: 'Nom de categorie requis' });
      done = await updateCategory(member.guildId, categoryId, name);
    } else {
      done = await deleteCategory(member.guildId, categoryId);
    }
    if (!done) return res.status(404).json({ success: false, message: 'Categorie introuvable' });
    emitToGuild(member.guildId, 'guild:updated', { guildId: member.guildId });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
