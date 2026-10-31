import { getUserFromRequest } from '@/lib/auth';
import { logActivity, snippet } from '@/lib/activity';
import { query } from '@/lib/db';
import { canViewPost, hydrateFullPosts, POST_SELECT } from '@/lib/posts';
import { createNotification } from '@/lib/notifications';

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

  const sourceId = Number(req.query.id);
  if (!Number.isInteger(sourceId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const sourceRows = await query('SELECT * FROM post WHERE id = ? AND deletedAt IS NULL LIMIT 1', [sourceId]);
    if (sourceRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Publication introuvable' });
    }

    const source = sourceRows[0];
    const allowed = await canViewPost(payload.id, source);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Vous ne pouvez pas partager cette publication' });
    }

    const content = (req.body?.content || '').toString().trim();
    const visibility = (req.body?.visibility || 'public').toString();
    const visibilityUserIds = Array.isArray(req.body?.visibilityUserIds)
      ? req.body.visibilityUserIds.map((id) => Number(id)).filter((id) => Number.isInteger(id))
      : [];

    if (!VALID_VISIBILITIES.includes(visibility)) {
      return res.status(422).json({ success: false, message: 'Visibilite invalide' });
    }

    const rootId = source.sharedPostId || source.id;

    const result = await query('INSERT INTO post (userId, content, visibility, sharedPostId) VALUES (?, ?, ?, ?)', [
      payload.id,
      content || null,
      visibility,
      rootId
    ]);

    const postId = result.insertId;

    if ((visibility === 'exceptFor' || visibility === 'onlyFor') && visibilityUserIds.length > 0) {
      const visValues = visibilityUserIds.map((userId) => [postId, userId]);
      await query(
        `INSERT INTO postVisibilityUser (postId, userId) VALUES ${visValues.map(() => '(?, ?)').join(', ')}`,
        visValues.flat()
      );
    }

    if (source.userId !== payload.id) {
      await createNotification({ userId: source.userId, actorId: payload.id, type: 'share', targetType: 'post', targetId: rootId });
    }

    await logActivity(payload.id, 'post_share', { targetType: 'post', targetId: rootId });

    const postRows = await query(`${POST_SELECT} WHERE p.id = ? LIMIT 1`, [postId]);
    const [hydrated] = await hydrateFullPosts(postRows, payload.id);

    return res.status(201).json({ success: true, post: hydrated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur lors du partage' });
  }
}
