import { query } from './db';
import { getBlockStatus, getFriendRow } from './friends';
import { createNotification } from './notifications';
import { mediaUrl } from './upload';

export const REACTION_TYPES = ['like', 'dislike', 'haha', 'wow', 'grr', 'sad'];

export async function createProfileMediaPost(userId, mediaId, kind) {
  const result = await query('INSERT INTO post (userId, content, visibility, kind) VALUES (?, ?, ?, ?)', [
    userId,
    null,
    'public',
    kind
  ]);
  const postId = result.insertId;
  await query('INSERT INTO postMedia (postId, mediaId, type, position) VALUES (?, ?, ?, 0)', [
    postId,
    mediaId,
    'image'
  ]);
  return postId;
}


export async function canViewPost(viewerId, post) {
  if (viewerId === post.userId) return true;

  // Publication rattachee a un groupe : la visibilite depend de
  // l'appartenance au groupe (public = tout le monde, prive = membres
  // actifs uniquement), independamment du champ `visibility` du post.
  // Cette branche n'affecte jamais les publications sans groupe
  // (post.groupId absent), dont la logique ci-dessous reste inchangee.
  if (post.groupId) {
    const groupRows = await query('SELECT visibility FROM communityGroup WHERE id = ? LIMIT 1', [post.groupId]);
    if (!groupRows[0]) return false;
    if (groupRows[0].visibility === 'public') return true;
    const membershipRows = await query(
      "SELECT 1 FROM communityGroupMember WHERE groupId = ? AND userId = ? AND status = 'active' LIMIT 1",
      [post.groupId, viewerId]
    );
    return membershipRows.length > 0;
  }

  const { blockedByMe, blockingMe } = await getBlockStatus(viewerId, post.userId);
  if (blockedByMe || blockingMe) return false;

  if (post.visibility === 'public') {
    const ownerRows = await query('SELECT isPrivate FROM user WHERE id = ? LIMIT 1', [post.userId]);
    if (!ownerRows[0] || !ownerRows[0].isPrivate) return true;

    const friendRow = await getFriendRow(viewerId, post.userId);
    return Boolean(friendRow && friendRow.status === 'accepted');
  }
  if (post.visibility === 'private') return false;

  if (post.visibility === 'friends') {
    const friendRow = await getFriendRow(viewerId, post.userId);
    return Boolean(friendRow && friendRow.status === 'accepted');
  }

  if (post.visibility === 'exceptFor') {
    const rows = await query('SELECT 1 FROM postVisibilityUser WHERE postId = ? AND userId = ? LIMIT 1', [
      post.id,
      viewerId
    ]);
    return rows.length === 0;
  }

  if (post.visibility === 'onlyFor') {
    const rows = await query('SELECT 1 FROM postVisibilityUser WHERE postId = ? AND userId = ? LIMIT 1', [
      post.id,
      viewerId
    ]);
    return rows.length > 0;
  }

  return false;
}

function emptyReactionMap() {
  return REACTION_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {});
}

export async function getPostAggregates(postId, viewerId) {
  const reactionRows = await query('SELECT type, COUNT(*) as count FROM reaction WHERE postId = ? GROUP BY type', [
    postId
  ]);
  const commentCountRows = await query(
    'SELECT COUNT(*) as count FROM comment WHERE postId = ? AND deletedAt IS NULL',
    [postId]
  );
  const shareCountRows = await query(
    'SELECT COUNT(*) as count FROM post WHERE sharedPostId = ? AND deletedAt IS NULL',
    [postId]
  );
  const myReactionRows = viewerId
    ? await query('SELECT type FROM reaction WHERE postId = ? AND userId = ? LIMIT 1', [postId, viewerId])
    : [];

  const reactionsByType = emptyReactionMap();
  let totalReactions = 0;
  reactionRows.forEach((row) => {
    reactionsByType[row.type] = Number(row.count);
    totalReactions += Number(row.count);
  });

  return {
    reactionsByType,
    totalReactions,
    commentCount: commentCountRows[0] ? Number(commentCountRows[0].count) : 0,
    shareCount: shareCountRows[0] ? Number(shareCountRows[0].count) : 0,
    myReaction: myReactionRows[0] ? myReactionRows[0].type : null
  };
}

export async function getPostAggregatesBatch(postIds, viewerId) {
  const result = {};
  postIds.forEach((id) => {
    result[id] = {
      reactionsByType: emptyReactionMap(),
      totalReactions: 0,
      commentCount: 0,
      shareCount: 0,
      myReaction: null
    };
  });

  if (postIds.length === 0) return result;

  const placeholders = postIds.map(() => '?').join(', ');

  const reactionRows = await query(
    `SELECT postId, type, COUNT(*) as count FROM reaction WHERE postId IN (${placeholders}) GROUP BY postId, type`,
    postIds
  );
  const commentRows = await query(
    `SELECT postId, COUNT(*) as count FROM comment WHERE postId IN (${placeholders}) AND deletedAt IS NULL GROUP BY postId`,
    postIds
  );
  const shareRows = await query(
    `SELECT sharedPostId as postId, COUNT(*) as count FROM post
     WHERE sharedPostId IN (${placeholders}) AND deletedAt IS NULL GROUP BY sharedPostId`,
    postIds
  );
  const myReactionRows = viewerId
    ? await query(`SELECT postId, type FROM reaction WHERE postId IN (${placeholders}) AND userId = ?`, [
        ...postIds,
        viewerId
      ])
    : [];

  reactionRows.forEach((row) => {
    result[row.postId].reactionsByType[row.type] = Number(row.count);
    result[row.postId].totalReactions += Number(row.count);
  });
  commentRows.forEach((row) => {
    result[row.postId].commentCount = Number(row.count);
  });
  shareRows.forEach((row) => {
    result[row.postId].shareCount = Number(row.count);
  });
  myReactionRows.forEach((row) => {
    result[row.postId].myReaction = row.type;
  });

  return result;
}

export async function hydratePosts(postRows, viewerId) {
  if (postRows.length === 0) return [];

  const ids = postRows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');

  const mediaRows = await query(
    `SELECT id, postId, type, mediaId FROM postMedia WHERE postId IN (${placeholders}) ORDER BY position ASC`,
    ids
  );
  const hashtagRows = await query(
    `SELECT ph.postId, h.name FROM postHashtag ph JOIN hashtag h ON h.id = ph.hashtagId WHERE ph.postId IN (${placeholders})`,
    ids
  );
  const mentionRows = await query(
    `SELECT m.postId, u.id, u.firstName, u.lastName
     FROM mention m JOIN user u ON u.id = m.userId
     WHERE m.postId IN (${placeholders})`,
    ids
  );
  const aggregatesByPost = await getPostAggregatesBatch(ids, viewerId);

  const mediaByPost = {};
  mediaRows.forEach((media) => {
    if (!mediaByPost[media.postId]) mediaByPost[media.postId] = [];
    mediaByPost[media.postId].push({ id: media.id, type: media.type, url: mediaUrl(media.mediaId) });
  });

  const hashtagsByPost = {};
  hashtagRows.forEach((row) => {
    if (!hashtagsByPost[row.postId]) hashtagsByPost[row.postId] = [];
    hashtagsByPost[row.postId].push(row.name);
  });

  const mentionsByPost = {};
  mentionRows.forEach((row) => {
    if (!mentionsByPost[row.postId]) mentionsByPost[row.postId] = [];
    mentionsByPost[row.postId].push({ id: row.id, firstName: row.firstName, lastName: row.lastName });
  });

  const groupIds = [...new Set(postRows.filter((post) => post.groupId).map((post) => post.groupId))];
  let groupsById = {};
  if (groupIds.length > 0) {
    const groupPlaceholders = groupIds.map(() => '?').join(', ');
    const groupRows = await query(`SELECT id, name, avatarMediaId FROM communityGroup WHERE id IN (${groupPlaceholders})`, groupIds);
    groupsById = Object.fromEntries(
      groupRows.map((row) => [row.id, { id: row.id, name: row.name, avatar: mediaUrl(row.avatarMediaId) }])
    );
  }

  // Boosts actifs (uniquement si leur proprietaire a toujours un premium actif).
  const boostByPost = {};
  if (postRows.length > 0) {
    const boostRows = await query(
      `SELECT b.postId, MAX(b.endsAt) AS endsAt FROM postBoost b
       JOIN user bu ON bu.id = b.userId AND ((bu.premiumUntil IS NOT NULL AND bu.premiumUntil > NOW()) OR bu.role = 'admin')
       WHERE b.postId IN (${postRows.map(() => '?').join(', ')}) AND b.endsAt > NOW() GROUP BY b.postId`,
      postRows.map((post) => post.id)
    );
    boostRows.forEach((row) => {
      boostByPost[row.postId] = row.endsAt;
    });
  }

  return postRows.map((post) => ({
    id: post.id,
    userId: post.userId,
    content: post.content,
    visibility: post.visibility,
    kind: post.kind || 'standard',
    sharedPostId: post.sharedPostId,
    isEdited: Boolean(post.isEdited),
    viewsCount: post.viewsCount,
    location: post.location || null,
    groupId: post.groupId || null,
    group: post.groupId ? groupsById[post.groupId] || null : null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: {
      id: post.authorId,
      firstName: post.authorFirstName,
      lastName: post.authorLastName,
      avatar: mediaUrl(post.authorAvatarId),
      verified: Boolean(post.authorVerified)
    },
    boostedUntil: boostByPost[post.id] || null,
    media: mediaByPost[post.id] || [],
    hashtags: hashtagsByPost[post.id] || [],
    mentions: mentionsByPost[post.id] || [],
    ...aggregatesByPost[post.id]
  }));
}

export async function attachSharedPosts(posts, viewerId) {
  const sharedIds = [...new Set(posts.filter((post) => post.sharedPostId).map((post) => post.sharedPostId))];
  if (sharedIds.length === 0) return posts;

  const placeholders = sharedIds.map(() => '?').join(', ');
  const rawRows = await query(`SELECT * FROM post WHERE id IN (${placeholders})`, sharedIds);
  const rawById = {};
  rawRows.forEach((row) => {
    rawById[row.id] = row;
  });

  const visibleIds = [];
  for (const id of sharedIds) {
    const row = rawById[id];
    if (row && !row.deletedAt && (await canViewPost(viewerId, row))) {
      visibleIds.push(id);
    }
  }

  const hydratedById = {};
  if (visibleIds.length > 0) {
    const hydPlaceholders = visibleIds.map(() => '?').join(', ');
    const hydRows = await query(`${POST_SELECT} WHERE p.id IN (${hydPlaceholders})`, visibleIds);
    const hydrated = await hydratePosts(hydRows, viewerId);
    hydrated.forEach((post) => {
      hydratedById[post.id] = post;
    });
  }

  return posts.map((post) => {
    if (!post.sharedPostId) return post;
    return { ...post, sharedPost: hydratedById[post.sharedPostId] || null };
  });
}

export async function hydrateFullPosts(postRows, viewerId) {
  const posts = await hydratePosts(postRows, viewerId);
  return attachSharedPosts(posts, viewerId);
}

export function extractHashtags(content) {
  if (!content) return [];
  const matches = content.match(/#[\p{L}0-9_]{2,50}/gu) || [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

export async function syncPostHashtags(postId, content) {
  await query('DELETE FROM postHashtag WHERE postId = ?', [postId]);
  const tags = extractHashtags(content);
  if (tags.length === 0) return;

  for (const tag of tags) {
    await query('INSERT INTO hashtag (name) VALUES (?) ON DUPLICATE KEY UPDATE name = name', [tag]);
  }

  const hashtagRows = await query(
    `SELECT id, name FROM hashtag WHERE name IN (${tags.map(() => '?').join(', ')})`,
    tags
  );

  const values = hashtagRows.map((row) => [postId, row.id]);
  if (values.length > 0) {
    await query(
      `INSERT INTO postHashtag (postId, hashtagId) VALUES ${values.map(() => '(?, ?)').join(', ')}`,
      values.flat()
    );
  }
}

export async function syncPostMentions(postId, userIds, actorId) {
  await query('DELETE FROM mention WHERE postId = ?', [postId]);
  const uniqueIds = [...new Set(userIds.filter((id) => Number.isInteger(id) && id !== actorId))];
  if (uniqueIds.length === 0) return;

  const values = uniqueIds.map((userId) => [postId, userId]);
  await query(
    `INSERT INTO mention (postId, userId) VALUES ${values.map(() => '(?, ?)').join(', ')}`,
    values.flat()
  );

  for (const userId of uniqueIds) {
    await createNotification({ userId, actorId, type: 'mention', targetType: 'post', targetId: postId });
  }
}

export const POST_SELECT = `
  SELECT p.id, p.userId, p.content, p.visibility, p.kind, p.sharedPostId, p.isEdited, p.viewsCount, p.createdAt, p.updatedAt,
         p.groupId, p.location,
         u.id as authorId, u.firstName as authorFirstName, u.lastName as authorLastName, u.avatarId as authorAvatarId,
         ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS authorVerified
  FROM post p
  JOIN user u ON u.id = p.userId AND u.bannedAt IS NULL
`;
