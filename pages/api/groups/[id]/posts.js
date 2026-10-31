import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { query } from '@/lib/db';
import { parseUpload, getField, saveMediaFiles } from '@/lib/upload';
import { hydrateFullPosts, POST_SELECT, syncPostHashtags, syncPostMentions } from '@/lib/posts';
import { getGroupById, isActiveMember, canViewGroupContent } from '@/lib/groups';

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

  const groupId = Number(req.query.id);
  if (!Number.isInteger(groupId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  const group = await getGroupById(groupId);
  if (!group) {
    return res.status(404).json({ success: false, message: 'Groupe introuvable' });
  }

  if (req.method === 'GET') {
    const allowed = await canViewGroupContent(payload.id, groupId, group.visibility);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Acces reserve aux membres de ce groupe' });
    }

    const offset = Number(req.query.offset) || 0;
    const limit = Math.min(Number(req.query.limit) || 10, 20);

    const rawRows = await query(
      'SELECT id FROM post WHERE groupId = ? AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT ? OFFSET ?',
      [groupId, limit + 1, offset]
    );
    const hasMore = rawRows.length > limit;
    const ids = rawRows.slice(0, limit).map((row) => row.id);

    if (ids.length === 0) {
      return res.status(200).json({ success: true, posts: [], hasMore });
    }

    const placeholders = ids.map(() => '?').join(', ');
    const postRows = await query(`${POST_SELECT} WHERE p.id IN (${placeholders})`, ids);
    const orderedRows = ids.map((id) => postRows.find((row) => row.id === id)).filter(Boolean);
    const posts = await hydrateFullPosts(orderedRows, payload.id);

    return res.status(200).json({ success: true, posts, hasMore });
  }

  if (req.method === 'POST') {
    if (!(await isActiveMember(groupId, payload.id))) {
      return res.status(403).json({ success: false, message: 'Vous devez etre membre du groupe pour y publier' });
    }

    try {
      const { fields, files } = await parseUpload(req, ALLOWED_TYPES);

      const content = getField(fields, 'content').toString().trim();
      const mentionsRaw = getField(fields, 'mentions', '[]');

      if (!content && files.length === 0) {
        return res.status(422).json({ success: false, message: 'La publication ne peut pas etre vide' });
      }

      let mentionUserIds = [];
      try {
        mentionUserIds = JSON.parse(mentionsRaw)
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id));
      } catch (error) {
        mentionUserIds = [];
      }

      // La visibilite du post reste 'public' au sens du champ existant :
      // c'est l'appartenance au groupe (groupId) qui gouverne reellement
      // qui peut voir la publication (voir canViewPost dans lib/posts.js).
      const result = await query('INSERT INTO post (userId, content, visibility, groupId) VALUES (?, ?, ?, ?)', [
        payload.id,
        content || null,
        'public',
        groupId
      ]);
      const postId = result.insertId;

      if (files.length > 0) {
        const mediaIds = await saveMediaFiles(files, payload.id);
        const mediaValues = files.map((file, index) => [
          postId,
          mediaIds[index],
          file.mimetype.startsWith('video') ? 'video' : 'image',
          index
        ]);
        await query(
          `INSERT INTO postMedia (postId, mediaId, type, position) VALUES ${mediaValues.map(() => '(?, ?, ?, ?)').join(', ')}`,
          mediaValues.flat()
        );
      }

      await syncPostHashtags(postId, content);
      await syncPostMentions(postId, mentionUserIds, payload.id);

      const postRows = await query(`${POST_SELECT} WHERE p.id = ? LIMIT 1`, [postId]);
      const [hydrated] = await hydrateFullPosts(postRows, payload.id);

      await logActivity(payload.id, 'post_create', {
        targetType: 'post',
        targetId: postId,
        meta: { snippet: snippet(content), groupId }
      });

      return res.status(201).json({ success: true, post: hydrated });
    } catch (error) {
      return res.status(422).json({ success: false, message: error.message || 'Erreur lors de la publication' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
