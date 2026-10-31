import { allowMethods, requireUser } from '@/lib/guildApi';
import { joinWithInvite, emitToGuild } from '@/lib/guilds';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const userId = await requireUser(req, res);
  if (!userId) return;

  const code = (req.body?.code || '').toString().trim().replace(/^.*\//, '');
  if (!/^[A-Za-z0-9_-]{10}$/.test(code)) {
    return res.status(422).json({ success: false, message: 'Code d\'invitation invalide' });
  }
  try {
    const result = await joinWithInvite(userId, code);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    if (!result.alreadyMember) emitToGuild(result.guildId, 'guild:members-changed', { guildId: result.guildId });
    return res.status(200).json({ success: true, guildId: result.guildId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
