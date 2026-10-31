import { allowMethods, requireMember } from '@/lib/guildApi';
import { listMembers } from '@/lib/guilds';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return;
  const member = await requireMember(req, res);
  if (!member) return;

  try {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
    return res.status(200).json({ success: true, members: await listMembers(member.guildId, q) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
