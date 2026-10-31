import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { query } from '@/lib/db';
import { parseUpload, getField, saveMediaFiles } from '@/lib/upload';
import { hydrateFullPosts, canViewPost, POST_SELECT, syncPostHashtags, syncPostMentions } from '@/lib/posts';
import { isAdminOrOwner } from '@/lib/groups';

export const config = {
  api: {
    bodyParser: false
  }
};

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/ogg'
];

const VALID_VISIBILITIES = ['public', 'friends', 'private', 'exceptFor', 'onlyFor'];

async function fetchRawPost(postId) {
  const rows = await query('SELECT * FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [postId]);
  return rows[0] || null;
}

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const postId = Number(req.query.id);
  if (!Number.isInteger(postId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  if (req.method === 'GET') {
    try {
      const post = await fetchRawPost(postId);
      if (!post) {
        return res.status(404).json({ success: false, message: 'Publication introuvable' });
      }

      const allowed = await canViewPost(payload.id, post);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Vous ne pouvez pas voir cette publication' });
      }

      const postRows = await query(`${POST_SELECT} WHERE p.id = ? LIMIT 1`, [postId]);
      const [hydrated] = await hydrateFullPosts(postRows, payload.id);

      await logActivity(payload.id, 'post_edit', { targetType: 'post', targetId: postId, meta: { snippet: snippet(content) } });

      return res.status(200).json({ success: true, post: hydrated });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const existing = await fetchRawPost(postId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Publication introuvable' });
      }
      if (existing.userId !== payload.id) {
        return res.status(403).json({ success: false, message: 'Action non autorisee' });
      }

      const { fields, files } = await parseUpload(req, ALLOWED_TYPES);

      const content = getField(fields, 'content').toString().trim();
      const visibility = getField(fields, 'visibility', existing.visibility).toString();
      const visibilityUserIdsRaw = getField(fields, 'visibilityUserIds', '[]');
      const removeMediaIdsRaw = getField(fields, 'removeMediaIds', '[]');
      const mentionsRaw = getField(fields, 'mentions', '[]');
      const location = getField(fields, 'location', existing.location || '').toString().trim().slice(0, 150) || null;

      if (!VALID_VISIBILITIES.includes(visibility)) {
        return res.status(422).json({ success: false, message: 'Visibilite invalide' });
      }

      let visibilityUserIds = [];
      try {
        visibilityUserIds = JSON.parse(visibilityUserIdsRaw)
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id));
      } catch (parseError) {
        visibilityUserIds = [];
      }

      let removeMediaIds = [];
      try {
        removeMediaIds = JSON.parse(removeMediaIdsRaw)
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id));
      } catch (parseError) {
        removeMediaIds = [];
      }

      let mentionUserIds = [];
      try {
        mentionUserIds = JSON.parse(mentionsRaw)
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id));
      } catch (parseError) {
        mentionUserIds = [];
      }

      await query('UPDATE post SET content = ?, visibility = ?, location = ?, isEdited = 1, updatedAt = NOW() WHERE id = ?', [
        content || null,
        visibility,
        location,
        postId
      ]);

      if (removeMediaIds.length > 0) {
        const placeholders = removeMediaIds.map(() => '?').join(', ');
        await query(`DELETE FROM postMedia WHERE postId = ? AND id IN (${placeholders})`, [
          postId,
          ...removeMediaIds
        ]);
      }

      if (files.length > 0) {
        const existingCountRows = await query('SELECT COUNT(*) as count FROM postMedia WHERE postId = ?', [postId]);
        const startPosition = existingCountRows[0] ? Number(existingCountRows[0].count) : 0;
        const mediaIds = await saveMediaFiles(files, payload.id);
        const mediaValues = files.map((file, index) => [
          postId,
          mediaIds[index],
          file.mimetype.startsWith('video') ? 'video' : 'image',
          startPosition + index
        ]);
        await query(
          `INSERT INTO postMedia (postId, mediaId, type, position) VALUES ${mediaValues
            .map(() => '(?, ?, ?, ?)')
            .join(', ')}`,
          mediaValues.flat()
        );
      }

      await query('DELETE FROM postVisibilityUser WHERE postId = ?', [postId]);
      if ((visibility === 'exceptFor' || visibility === 'onlyFor') && visibilityUserIds.length > 0) {
        const visValues = visibilityUserIds.map((userId) => [postId, userId]);
        await query(
          `INSERT INTO postVisibilityUser (postId, userId) VALUES ${visValues.map(() => '(?, ?)').join(', ')}`,
          visValues.flat()
        );
      }

      await syncPostHashtags(postId, content);
      await syncPostMentions(postId, mentionUserIds, payload.id);

      const postRows = await query(`${POST_SELECT} WHERE p.id = ? LIMIT 1`, [postId]);
      const [hydrated] = await hydrateFullPosts(postRows, payload.id);

      return res.status(200).json({ success: true, post: hydrated });
    } catch (error) {
      return res.status(422).json({ success: false, message: error.message || 'Erreur lors de la modification' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const existing = await fetchRawPost(postId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Publication introuvable' });
      }
      if (existing.userId !== payload.id) {
        // Un admin/owner du groupe peut supprimer une publication du
        // groupe meme s'il n'en est pas l'auteur (moderation), sans
        // affecter les permissions de suppression des publications
        // "normales" (hors groupe), inchangees ci-dessus.
        const canModerate = existing.groupId && (await isAdminOrOwner(existing.groupId, payload.id));
        if (!canModerate) {
          return res.status(403).json({ success: false, message: 'Action non autorisee' });
        }
      }

      await query('UPDATE post SET deletedAt = NOW() WHERE id = ?', [postId]);
      await logActivity(payload.id, 'post_delete', { targetType: 'post', targetId: postId, meta: { snippet: snippet(existing.content) } });
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
