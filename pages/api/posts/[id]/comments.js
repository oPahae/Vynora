import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { query } from '@/lib/db';
import { parseUpload, getField, saveMediaFile } from '@/lib/upload';
import { canViewPost } from '@/lib/posts';
import { hydrateComments, COMMENT_SELECT, syncCommentMentions } from '@/lib/comments';
import { createNotification } from '@/lib/notifications';

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
  'video/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
  'audio/wav'
];

function mediaTypeFromMime(mimetype) {
  if (mimetype.startsWith('video')) return 'video';
  if (mimetype.startsWith('audio')) return 'audio';
  return 'image';
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

  const postRows = await query('SELECT id, userId, visibility FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [
    postId
  ]);
  if (postRows.length === 0) {
    return res.status(404).json({ success: false, message: 'Publication introuvable' });
  }

  const allowed = await canViewPost(payload.id, postRows[0]);
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Action non autorisee' });
  }

  if (req.method === 'GET') {
    try {
      const offset = Number(req.query.offset) || 0;
      const limit = Math.min(Number(req.query.limit) || 10, 30);

      const rows = await query(
        `${COMMENT_SELECT} WHERE c.postId = ? AND c.parentId IS NULL AND c.deletedAt IS NULL
         ORDER BY c.createdAt DESC LIMIT ? OFFSET ?`,
        [postId, limit, offset]
      );

      const comments = await hydrateComments(rows, payload.id);
      return res.status(200).json({ success: true, comments });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { fields, files } = await parseUpload(req, ALLOWED_TYPES);

      const content = getField(fields, 'content').toString().trim();
      const parentIdRaw = getField(fields, 'parentId', '');
      const parentId = parentIdRaw ? Number(parentIdRaw) : null;

      if (!content && files.length === 0) {
        return res.status(422).json({ success: false, message: 'Le commentaire ne peut pas etre vide' });
      }

      if (parentId) {
        const parentRows = await query(
          'SELECT id FROM comment WHERE id = ? AND postId = ? AND deletedAt IS NULL LIMIT 1',
          [parentId, postId]
        );
        if (parentRows.length === 0) {
          return res.status(404).json({ success: false, message: 'Commentaire parent introuvable' });
        }
      }

      const mediaType = files.length > 0 ? mediaTypeFromMime(files[0].mimetype) : null;
      const mediaId = files.length > 0 ? await saveMediaFile(files[0], payload.id) : null;

      const result = await query(
        'INSERT INTO comment (postId, userId, parentId, content, mediaType, mediaId) VALUES (?, ?, ?, ?, ?, ?)',
        [postId, payload.id, parentId, content || null, mediaType, mediaId]
      );

      const commentId = result.insertId;

      const notifyUserId = parentId
        ? (await query('SELECT userId FROM comment WHERE id = ?', [parentId]))[0]?.userId
        : postRows[0].userId;

      if (notifyUserId && notifyUserId !== payload.id) {
        await createNotification({
          userId: notifyUserId,
          actorId: payload.id,
          type: parentId ? 'reply' : 'comment',
          targetType: 'comment',
          targetId: commentId,
          content: String(postId)
        });
      }

      // Mentions (@Prenom Nom) : liste d'ids envoyee par le client, verifiee
      // par rapport au texte reellement saisi.
      let mentionUserIds = [];
      try {
        mentionUserIds = JSON.parse(getField(fields, 'mentions', '[]').toString());
        if (!Array.isArray(mentionUserIds)) mentionUserIds = [];
      } catch (error) {
        mentionUserIds = [];
      }
      mentionUserIds = mentionUserIds.map(Number).filter((id) => Number.isInteger(id));
      if (mentionUserIds.length > 0 && content) {
        await syncCommentMentions(commentId, postRows[0], mentionUserIds, payload.id);
      }

      await logActivity(payload.id, 'comment_create', {
        targetType: 'comment',
        targetId: commentId,
        meta: { postId, isReply: Boolean(parentId), snippet: snippet(content) || (mediaType ? mediaType : null) }
      });

      const rows = await query(`${COMMENT_SELECT} WHERE c.id = ? LIMIT 1`, [commentId]);
      const [comment] = await hydrateComments(rows, payload.id);

      return res.status(201).json({ success: true, comment });
    } catch (error) {
      return res.status(422).json({ success: false, message: error.message || 'Erreur lors de la creation' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
