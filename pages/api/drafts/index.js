import { getUserFromRequest } from '@/lib/auth';
import { parseUpload, getField, saveMediaFiles } from '@/lib/upload';
import { createDraft, getDrafts, isValidVisibility } from '@/lib/drafts';

export const config = {
  api: {
    bodyParser: false
  }
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/ogg'];

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  if (req.method === 'GET') {
    const offset = Number(req.query.offset) || 0;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const { drafts, hasMore } = await getDrafts(payload.id, offset, limit);
    return res.status(200).json({ success: true, drafts, hasMore });
  }

  if (req.method === 'POST') {
    try {
      const { fields, files } = await parseUpload(req, ALLOWED_TYPES);

      const content = getField(fields, 'content').toString().trim();
      const visibility = getField(fields, 'visibility', 'public').toString();
      const visibilityUserIdsRaw = getField(fields, 'visibilityUserIds', '[]');

      if (!isValidVisibility(visibility)) {
        return res.status(422).json({ success: false, message: 'Visibilite invalide' });
      }
      if (!content && files.length === 0) {
        return res.status(422).json({ success: false, message: 'Le brouillon ne peut pas etre totalement vide' });
      }

      let visibilityUserIds = [];
      try {
        visibilityUserIds = JSON.parse(visibilityUserIdsRaw)
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id));
      } catch (error) {
        visibilityUserIds = [];
      }

      let mediaIds = [];
      let mediaTypes = [];
      if (files.length > 0) {
        mediaIds = await saveMediaFiles(files, payload.id);
        mediaTypes = files.map((file) => (file.mimetype.startsWith('video') ? 'video' : 'image'));
      }

      const result = await createDraft(payload.id, {
        content,
        visibility,
        visibilityUserIds,
        mediaIds,
        mediaTypes
      });

      if (!result.success) {
        return res.status(422).json(result);
      }

      return res.status(201).json({ success: true, draftId: result.draftId });
    } catch (error) {
      return res.status(422).json({ success: false, message: error.message || 'Erreur lors de la sauvegarde' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
