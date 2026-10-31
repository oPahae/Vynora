import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { parseUpload, saveMediaFile, mediaUrl } from '@/lib/upload';
import { createProfileMediaPost } from '@/lib/posts';

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

  try {
    const { files } = await parseUpload(req, ALLOWED_TYPES);
    if (files.length === 0) {
      return res.status(422).json({ success: false, message: 'Aucun fichier recu' });
    }

    const mediaId = await saveMediaFile(files[0], payload.id);
    const postId = await createProfileMediaPost(payload.id, mediaId, 'avatar');
    await query('UPDATE user SET avatarId = ?, avatarPostId = ? WHERE id = ?', [mediaId, postId, payload.id]);

    return res.status(200).json({ success: true, avatar: mediaUrl(mediaId), postId });
  } catch (error) {
    return res.status(422).json({ success: false, message: error.message || 'Erreur lors de l\'upload' });
  }
}
