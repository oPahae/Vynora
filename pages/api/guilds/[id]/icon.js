import { allowMethods, requireMember, denyUnless } from '@/lib/guildApi';
import { can, emitToGuild } from '@/lib/guilds';
import { PERMISSIONS } from '@/lib/guildPermissions';
import { parseUpload, saveMediaFile, mediaUrl } from '@/lib/upload';
import { query } from '@/lib/db';

export const config = {
  api: {
    bodyParser: false
  }
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_ICON_BYTES = 8 * 1024 * 1024;

// Image du serveur : reservee au proprietaire, aux administrateurs du serveur
// et aux roles disposant de la permission "Gerer le serveur".
export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST', 'DELETE'])) return;
  const member = await requireMember(req, res);
  if (!member) return;
  if (!denyUnless(res, can(member.context, PERMISSIONS.MANAGE_GUILD), "Vous n'avez pas la permission de modifier l'image du serveur")) return;

  try {
    if (req.method === 'DELETE') {
      await query('UPDATE guild SET iconId = NULL WHERE id = ?', [member.guildId]);
      emitToGuild(member.guildId, 'guild:updated', { guildId: member.guildId });
      return res.status(200).json({ success: true, icon: null });
    }

    const { files } = await parseUpload(req, ALLOWED_TYPES, { maxFileSize: MAX_ICON_BYTES });
    if (files.length === 0) return res.status(422).json({ success: false, message: 'Aucun fichier recu' });

    const mediaId = await saveMediaFile(files[0], member.userId);
    await query('UPDATE guild SET iconId = ? WHERE id = ?', [mediaId, member.guildId]);
    emitToGuild(member.guildId, 'guild:updated', { guildId: member.guildId });
    return res.status(200).json({ success: true, icon: mediaUrl(mediaId) });
  } catch (error) {
    return res.status(422).json({ success: false, message: error.message || "Erreur lors de l'upload" });
  }
}
