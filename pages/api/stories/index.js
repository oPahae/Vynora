import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { query } from '@/lib/db';
import { parseUpload, getField, saveMediaFile } from '@/lib/upload';
import {
  getStoryFeedAuthorIds,
  hydrateStories,
  groupStoriesByAuthor,
  STORY_SELECT
} from '@/lib/stories';

export const config = {
  api: {
    bodyParser: false
  }
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/ogg'];
const VALID_STORY_TYPES = ['text', 'image', 'video'];

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  if (req.method === 'GET') {
    try {
      const authorIds = await getStoryFeedAuthorIds(payload.id);
      if (authorIds.length === 0) {
        return res.status(200).json({ success: true, groups: [] });
      }

      const placeholders = authorIds.map(() => '?').join(', ');
      const rows = await query(
        `${STORY_SELECT}
         WHERE s.userId IN (${placeholders}) AND s.expiresAt > NOW()
           AND s.userId NOT IN (
             SELECT blockedId FROM block WHERE blockerId = ?
             UNION
             SELECT blockerId FROM block WHERE blockedId = ?
           )
         ORDER BY s.createdAt ASC`,
        [...authorIds, payload.id, payload.id]
      );

      const stories = await hydrateStories(rows, payload.id);
      const groups = groupStoriesByAuthor(stories, payload.id);

      return res.status(200).json({ success: true, groups });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { fields, files } = await parseUpload(req, ALLOWED_TYPES);

      const type = getField(fields, 'type', 'text').toString();
      const content = getField(fields, 'content').toString().trim();
      const backgroundColor = getField(fields, 'backgroundColor', '#5B5FEF').toString();

      if (!VALID_STORY_TYPES.includes(type)) {
        return res.status(422).json({ success: false, message: 'Type de story invalide' });
      }

      if (type === 'text' && !content) {
        return res.status(422).json({ success: false, message: 'Le texte de la story est requis' });
      }

      if ((type === 'image' || type === 'video') && files.length === 0) {
        return res.status(422).json({ success: false, message: 'Un media est requis pour ce type de story' });
      }

      const mediaId = files.length > 0 ? await saveMediaFile(files[0], payload.id) : null;

      const result = await query(
        'INSERT INTO status (userId, type, content, mediaId, backgroundColor, expiresAt) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
        [payload.id, type, content || null, mediaId, type === 'text' ? backgroundColor : null]
      );

      const rows = await query(`${STORY_SELECT} WHERE s.id = ? LIMIT 1`, [result.insertId]);
      const [story] = await hydrateStories(rows, payload.id);

      await logActivity(payload.id, 'story_create', { targetType: 'story', targetId: result.insertId, meta: { type, snippet: snippet(content) } });

      return res.status(201).json({ success: true, story });
    } catch (error) {
      return res.status(422).json({ success: false, message: error.message || 'Erreur lors de la creation' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
