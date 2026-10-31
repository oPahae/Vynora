import { allowMethods, requireUser, cleanName } from '@/lib/guildApi';
import { createGuild, listUserGuilds } from '@/lib/guilds';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST'])) return;
  const userId = await requireUser(req, res);
  if (!userId) return;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ success: true, guilds: await listUserGuilds(userId) });
    }
    const name = cleanName(req.body?.name, 80);
    if (name.length < 2) return res.status(422).json({ success: false, message: 'Le nom doit contenir au moins 2 caracteres' });
    const guildId = await createGuild(userId, name, cleanName(req.body?.description, 300));
    return res.status(201).json({ success: true, guildId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
