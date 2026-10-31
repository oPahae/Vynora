import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { parseUpload, saveMediaFile, mediaUrl } from '@/lib/upload';
import { isAdminOrOwner } from '@/lib/groups';

export const config = {
  api: {
    bodyParser: false
  }
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const groupId = Number(req.query.id);
  if (!Number.isInteger(groupId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  if (!(await isAdminOrOwner(groupId, payload.id))) {
    return res.status(403).json({ success: false, message: 'Action non autorisee' });
  }

  try {
    const { files } = await parseUpload(req, ALLOWED_TYPES);
    if (files.length === 0) {
      return res.status(422).json({ success: false, message: 'Aucun fichier recu' });
    }

    const mediaId = await saveMediaFile(files[0], payload.id);
    await query('UPDATE communityGroup SET avatarMediaId = ? WHERE id = ?', [mediaId, groupId]);

    return res.status(200).json({ success: true, avatar: mediaUrl(mediaId) });
  } catch (error) {
    return res.status(422).json({ success: false, message: error.message || "Erreur lors de l'upload" });
  }
}
