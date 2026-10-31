import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { query } from '@/lib/db';
import { parseUpload, getField, saveMediaFiles } from '@/lib/upload';
import { hydrateFullPosts, POST_SELECT, syncPostHashtags, syncPostMentions } from '@/lib/posts';

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
    const { fields, files } = await parseUpload(req, ALLOWED_TYPES);

    const content = getField(fields, 'content').toString().trim();
    const visibility = getField(fields, 'visibility', 'public').toString();
    const visibilityUserIdsRaw = getField(fields, 'visibilityUserIds', '[]');
    const mentionsRaw = getField(fields, 'mentions', '[]');
    const location = getField(fields, 'location', '').toString().trim().slice(0, 150) || null;

    if (!VALID_VISIBILITIES.includes(visibility)) {
      return res.status(422).json({ success: false, message: 'Visibilite invalide' });
    }

    if (!content && files.length === 0) {
      return res
        .status(422)
        .json({ success: false, message: 'Une publication doit contenir du texte ou un media' });
    }

    let visibilityUserIds = [];
    try {
      visibilityUserIds = JSON.parse(visibilityUserIdsRaw)
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id));
    } catch (parseError) {
      visibilityUserIds = [];
    }

    let mentionUserIds = [];
    try {
      mentionUserIds = JSON.parse(mentionsRaw)
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id));
    } catch (parseError) {
      mentionUserIds = [];
    }

    const result = await query('INSERT INTO post (userId, content, visibility, location) VALUES (?, ?, ?, ?)', [
      payload.id,
      content || null,
      visibility,
      location
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
        `INSERT INTO postMedia (postId, mediaId, type, position) VALUES ${mediaValues
          .map(() => '(?, ?, ?, ?)')
          .join(', ')}`,
        mediaValues.flat()
      );
    }

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

    await logActivity(payload.id, 'post_create', {
      targetType: 'post',
      targetId: postId,
      meta: { snippet: snippet(content), visibility, media: files.length }
    });

    return res.status(201).json({ success: true, post: hydrated });
  } catch (error) {
    return res.status(422).json({ success: false, message: error.message || 'Erreur lors de la creation' });
  }
}
