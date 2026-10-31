import { allowMethods, requireMember, requireChannel, denyUnless } from '@/lib/guildApi';
import { setSlowmode, can, emitToGuild, MAX_SLOWMODE_SECONDS } from '@/lib/guilds';
import { PERMISSIONS } from '@/lib/guildPermissions';

// Mode lent : delai minimal (en secondes) entre deux messages d'un meme
// membre. 0 = desactive. Necessite la permission MANAGE_SLOWMODE.
export default async function handler(req, res) {
  if (!allowMethods(req, res, ['PUT'])) return;
  const member = await requireMember(req, res);
  if (!member) return;
  if (!denyUnless(res, can(member.context, PERMISSIONS.MANAGE_SLOWMODE))) return;
  const channel = await requireChannel(req, res, member);
  if (!channel) return;

  const seconds = Number(req.body?.seconds);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > MAX_SLOWMODE_SECONDS) {
    return res.status(422).json({ success: false, message: 'Duree invalide (0 a 6 heures)' });
  }

  try {
    await setSlowmode(channel.id, seconds);
    emitToGuild(member.guildId, 'guild:updated', { guildId: member.guildId });
    return res.status(200).json({ success: true, seconds });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
