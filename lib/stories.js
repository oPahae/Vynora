import { query } from './db';
import { REACTION_TYPES } from './posts';
import { mediaUrl } from './upload';

function emptyReactionMap() {
  return REACTION_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {});
}

export async function getStoryFeedAuthorIds(viewerId) {
  const rows = await query(
    `SELECT CASE WHEN requesterId = ? THEN addresseeId ELSE requesterId END as friendId
     FROM friend WHERE status = 'accepted' AND (requesterId = ? OR addresseeId = ?)`,
    [viewerId, viewerId, viewerId]
  );

  const ids = rows.map((row) => row.friendId);
  ids.push(viewerId);
  return ids;
}

export async function canViewStory(viewerId, story) {
  if (story.userId === viewerId) return true;

  const rows = await query(
    `SELECT 1 FROM block WHERE (blockerId = ? AND blockedId = ?) OR (blockerId = ? AND blockedId = ?) LIMIT 1`,
    [viewerId, story.userId, story.userId, viewerId]
  );
  if (rows.length > 0) return false;

  const friendRows = await query(
    `SELECT 1 FROM friend WHERE status = 'accepted' AND
     ((requesterId = ? AND addresseeId = ?) OR (requesterId = ? AND addresseeId = ?)) LIMIT 1`,
    [viewerId, story.userId, story.userId, viewerId]
  );

  return friendRows.length > 0;
}

export async function getStoryAggregates(storyId, viewerId) {
  const reactionRows = await query('SELECT type, COUNT(*) as count FROM statusReaction WHERE statusId = ? GROUP BY type', [
    storyId
  ]);
  const viewCountRows = await query('SELECT COUNT(*) as count FROM statusView WHERE statusId = ?', [storyId]);
  const myReactionRows = viewerId
    ? await query('SELECT type FROM statusReaction WHERE statusId = ? AND userId = ? LIMIT 1', [storyId, viewerId])
    : [];
  const viewedRows = viewerId
    ? await query('SELECT 1 FROM statusView WHERE statusId = ? AND userId = ? LIMIT 1', [storyId, viewerId])
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
    viewsCount: viewCountRows[0] ? Number(viewCountRows[0].count) : 0,
    myReaction: myReactionRows[0] ? myReactionRows[0].type : null,
    viewed: viewedRows.length > 0
  };
}

export async function getStoryAggregatesBatch(storyIds, viewerId) {
  const result = {};
  storyIds.forEach((id) => {
    result[id] = { reactionsByType: emptyReactionMap(), totalReactions: 0, viewsCount: 0, myReaction: null, viewed: false };
  });

  if (storyIds.length === 0) return result;

  const placeholders = storyIds.map(() => '?').join(', ');

  const reactionRows = await query(
    `SELECT statusId, type, COUNT(*) as count FROM statusReaction WHERE statusId IN (${placeholders}) GROUP BY statusId, type`,
    storyIds
  );
  const viewCountRows = await query(
    `SELECT statusId, COUNT(*) as count FROM statusView WHERE statusId IN (${placeholders}) GROUP BY statusId`,
    storyIds
  );
  const myReactionRows = viewerId
    ? await query(`SELECT statusId, type FROM statusReaction WHERE statusId IN (${placeholders}) AND userId = ?`, [
        ...storyIds,
        viewerId
      ])
    : [];
  const viewedRows = viewerId
    ? await query(`SELECT statusId FROM statusView WHERE statusId IN (${placeholders}) AND userId = ?`, [
        ...storyIds,
        viewerId
      ])
    : [];

  reactionRows.forEach((row) => {
    result[row.statusId].reactionsByType[row.type] = Number(row.count);
    result[row.statusId].totalReactions += Number(row.count);
  });
  viewCountRows.forEach((row) => {
    result[row.statusId].viewsCount = Number(row.count);
  });
  myReactionRows.forEach((row) => {
    result[row.statusId].myReaction = row.type;
  });
  viewedRows.forEach((row) => {
    result[row.statusId].viewed = true;
  });

  return result;
}

export async function hydrateStories(storyRows, viewerId) {
  if (storyRows.length === 0) return [];

  const ids = storyRows.map((story) => story.id);
  const aggregatesByStory = await getStoryAggregatesBatch(ids, viewerId);

  return storyRows.map((story) => ({
    id: story.id,
    userId: story.userId,
    type: story.type,
    content: story.content,
    mediaUrl: mediaUrl(story.mediaId),
    backgroundColor: story.backgroundColor,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    author: {
      id: story.userId,
      firstName: story.firstName,
      lastName: story.lastName,
      avatar: mediaUrl(story.avatarId),
      verified: Boolean(story.verified)
    },
    ...aggregatesByStory[story.id]
  }));
}

export function groupStoriesByAuthor(stories, viewerId) {
  const groups = new Map();

  stories.forEach((story) => {
    if (!groups.has(story.userId)) {
      groups.set(story.userId, { author: story.author, stories: [] });
    }
    groups.get(story.userId).stories.push(story);
  });

  const result = Array.from(groups.values());

  result.sort((a, b) => {
    if (a.author.id === viewerId) return -1;
    if (b.author.id === viewerId) return 1;
    const aHasUnviewed = a.stories.some((story) => !story.viewed);
    const bHasUnviewed = b.stories.some((story) => !story.viewed);
    if (aHasUnviewed !== bHasUnviewed) return aHasUnviewed ? -1 : 1;
    return new Date(b.stories[0].createdAt) - new Date(a.stories[0].createdAt);
  });

  return result;
}

export const STORY_SELECT = `
  SELECT s.id, s.userId, s.type, s.content, s.mediaId, s.backgroundColor, s.createdAt, s.expiresAt,
         u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified
  FROM status s
  JOIN user u ON u.id = s.userId
`;
