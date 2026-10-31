import { query } from './db';
import { mediaUrl } from './upload';

// Journal d'activite personnel. logActivity() est volontairement "fire and
// forget" : une erreur de journalisation ne doit JAMAIS faire echouer l'action
// de l'utilisateur (publier, commenter, envoyer une invitation...).

export const ACTIVITY_CATEGORIES = {
  posts: ['post_create', 'post_edit', 'post_delete', 'post_share', 'story_create'],
  reactions: ['reaction'],
  comments: ['comment_create', 'comment_delete'],
  friends: [
    'friend_request_sent',
    'friend_request_accepted',
    'friend_request_declined',
    'friend_request_cancelled',
    'friend_request_received_accepted',
    'friend_removed',
    'user_block',
    'user_unblock'
  ],
  reels: ['reel_create', 'reel_delete'],
  other: ['group_create', 'group_join', 'collection_create', 'report_submit', 'login', 'profile_qr_scan']
};

export async function logActivity(userId, action, { targetType = null, targetId = null, meta = null } = {}) {
  try {
    if (!userId) return;
    const metaText = meta ? JSON.stringify(meta).slice(0, 500) : null;
    await query('INSERT INTO activityLog (userId, action, targetType, targetId, meta) VALUES (?, ?, ?, ?, ?)', [
      userId,
      action,
      targetType,
      targetId,
      metaText
    ]);
  } catch (error) {
    // journalisation best-effort
  }
}

// Petit extrait de texte pour memoriser de quoi parlait l'activite
// (utile meme si le contenu est supprime plus tard).
export function snippet(text, max = 90) {
  if (!text) return null;
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export async function listActivity(userId, { category = 'all', before = null, limit = 30 } = {}) {
  const params = [userId];
  let where = 'a.userId = ?';

  const actions = ACTIVITY_CATEGORIES[category];
  if (actions) {
    where += ` AND a.action IN (${actions.map(() => '?').join(', ')})`;
    params.push(...actions);
  }
  if (before) {
    where += ' AND a.id < ?';
    params.push(Number(before));
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 60);
  const rows = await query(
    `SELECT a.id, a.action, a.targetType, a.targetId, a.meta, a.createdAt
     FROM activityLog a WHERE ${where} ORDER BY a.id DESC LIMIT ${safeLimit + 1}`,
    params
  );

  const hasMore = rows.length > safeLimit;
  const page = rows.slice(0, safeLimit);

  // Enrichit avec l'autre personne concernee (invitation, blocage...).
  const otherIds = new Set();
  const parsed = page.map((row) => {
    let meta = null;
    try {
      meta = row.meta ? JSON.parse(row.meta) : null;
    } catch (error) {
      meta = null;
    }
    if (meta && meta.userId) otherIds.add(Number(meta.userId));
    return { ...row, meta };
  });

  let usersById = {};
  if (otherIds.size > 0) {
    const ids = [...otherIds];
    const users = await query(
      `SELECT id, firstName, lastName, avatarId FROM user WHERE id IN (${ids.map(() => '?').join(', ')})`,
      ids
    );
    usersById = Object.fromEntries(
      users.map((user) => [
        user.id,
        { id: user.id, firstName: user.firstName, lastName: user.lastName, avatar: mediaUrl(user.avatarId) }
      ])
    );
  }

  const items = parsed.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    meta: row.meta,
    otherUser: row.meta && row.meta.userId ? usersById[Number(row.meta.userId)] || null : null,
    createdAt: row.createdAt
  }));

  return { items, hasMore, nextCursor: items.length > 0 ? items[items.length - 1].id : null };
}
