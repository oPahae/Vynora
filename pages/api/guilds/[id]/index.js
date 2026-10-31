import { allowMethods, requireMember, denyUnless } from '@/lib/guildApi';
import { getGuildOverview, deleteGuild, emitToGuild } from '@/lib/guilds';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'DELETE'])) return;
  const member = await requireMember(req, res);
  if (!member) return;

  try {
    if (req.method === 'GET') {
      const overview = await getGuildOverview(member.guildId, member.userId);
      return res.status(200).json({ success: true, ...overview });
    }
    if (!denyUnless(res, member.context.isOwner, 'Seul le proprietaire peut supprimer le serveur')) return;
    emitToGuild(member.guildId, 'guild:deleted', { guildId: member.guildId });
    await deleteGuild(member.guildId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
