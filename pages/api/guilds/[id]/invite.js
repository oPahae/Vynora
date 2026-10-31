import { allowMethods, requireMember, denyUnless } from '@/lib/guildApi';
import { createInvite, can } from '@/lib/guilds';
import { PERMISSIONS } from '@/lib/guildPermissions';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  const member = await requireMember(req, res);
  if (!member) return;
  if (!denyUnless(res, can(member.context, PERMISSIONS.CREATE_INVITE))) return;

  try {
    const code = await createInvite(member.guildId, member.userId);
    return res.status(201).json({ success: true, code });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
