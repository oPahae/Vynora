import { getUserFromRequest } from '@/lib/auth';
import { parseUpload, getField, saveMediaFiles } from '@/lib/upload';
import { getDraftById, updateDraft, deleteDraft, isValidVisibility } from '@/lib/drafts';

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

  const draftId = Number(req.query.id);
  if (!Number.isInteger(draftId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  if (req.method === 'GET') {
    const draft = await getDraftById(payload.id, draftId);
    if (!draft) return res.status(404).json({ success: false, message: 'Brouillon introuvable' });
    return res.status(200).json({ success: true, draft });
  }

  if (req.method === 'PUT') {
    try {
      const { fields, files } = await parseUpload(req, ALLOWED_TYPES);

      const content = getField(fields, 'content').toString().trim();
      const visibility = getField(fields, 'visibility', 'public').toString();
      const visibilityUserIdsRaw = getField(fields, 'visibilityUserIds', '[]');
      const replaceMedia = getField(fields, 'replaceMedia', 'false') === 'true';

      if (!isValidVisibility(visibility)) {
        return res.status(422).json({ success: false, message: 'Visibilite invalide' });
      }

      let visibilityUserIds = [];
      try {
        visibilityUserIds = JSON.parse(visibilityUserIdsRaw)
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id));
      } catch (error) {
        visibilityUserIds = [];
      }

      let mediaIds;
      let mediaTypes;
      if (replaceMedia) {
        mediaIds = files.length > 0 ? await saveMediaFiles(files, payload.id) : [];
        mediaTypes = files.map((file) => (file.mimetype.startsWith('video') ? 'video' : 'image'));
      }

      const result = await updateDraft(payload.id, draftId, {
        content,
        visibility,
        visibilityUserIds,
        mediaIds,
        mediaTypes,
        replaceMedia
      });

      if (!result.success) {
        return res.status(404).json(result);
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(422).json({ success: false, message: error.message || 'Erreur lors de la mise a jour' });
    }
  }

  if (req.method === 'DELETE') {
    await deleteDraft(payload.id, draftId);
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
