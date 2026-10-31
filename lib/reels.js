import { query } from './db';
import { mediaUrl } from './upload';
import { REACTION_TYPES, extractHashtags } from './posts';

export const REEL_MAX_DURATION_SEC = 180;
export const REEL_MAX_FILE_BYTES = Number(process.env.REEL_MAX_FILE_BYTES) || 200 * 1024 * 1024;
export const REEL_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

function emptyReactionMap() {
  return REACTION_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {});
}

// ---------------------------------------------------------------------------
// Visibilite : un reel est visible par son auteur, ou si (public ET auteur
// non prive ou ami) ou si (amis ET ami). Les blocages (dans les deux sens) et
// les comptes bannis sont toujours exclus. Alias attendus : r = reel, u = user.
// ---------------------------------------------------------------------------
export function reelVisibilitySql(viewerId) {
  const friendOf = (alias) =>
    `EXISTS (SELECT 1 FROM friend ${alias} WHERE ${alias}.status = 'accepted' AND ((${alias}.requesterId = ? AND ${alias}.addresseeId = r.userId) OR (${alias}.requesterId = r.userId AND ${alias}.addresseeId = ?)))`;

  const clause = `
    u.bannedAt IS NULL AND r.deletedAt IS NULL
    AND NOT EXISTS (SELECT 1 FROM block b WHERE (b.blockerId = ? AND b.blockedId = r.userId) OR (b.blockerId = r.userId AND b.blockedId = ?))
    AND (
      r.userId = ?
      OR (r.visibility = 'public' AND (u.isPrivate = 0 OR ${friendOf('f1')}))
      OR (r.visibility = 'friends' AND ${friendOf('f2')})
    )`;
  return { clause, params: [viewerId, viewerId, viewerId, viewerId, viewerId, viewerId, viewerId] };
}

export const REEL_SELECT = `
  SELECT r.id, r.userId, r.mediaId, r.caption, r.visibility, r.durationSec, r.viewsCount, r.isEdited, r.createdAt,
         u.firstName AS authorFirstName, u.lastName AS authorLastName, u.avatarId AS authorAvatarId,
         ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS authorVerified
  FROM reel r
  JOIN user u ON u.id = r.userId
`;

export async function getVisibleReelRow(viewerId, reelId) {
  const vis = reelVisibilitySql(viewerId);
  const rows = await query(`${REEL_SELECT} WHERE r.id = ? AND ${vis.clause} LIMIT 1`, [reelId, ...vis.params]);
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Hashtags d'un reel (table `hashtag` partagee avec les publications)
// ---------------------------------------------------------------------------
export async function syncReelHashtags(reelId, caption) {
  await query('DELETE FROM reelHashtag WHERE reelId = ?', [reelId]);
  const tags = extractHashtags(caption);
  if (tags.length === 0) return;
  for (const tag of tags) {
    // eslint-disable-next-line no-await-in-loop
    await query('INSERT INTO hashtag (name) VALUES (?) ON DUPLICATE KEY UPDATE name = name', [tag]);
  }
  const rows = await query(`SELECT id FROM hashtag WHERE name IN (${tags.map(() => '?').join(', ')})`, tags);
  if (rows.length > 0) {
    await query(
      `INSERT IGNORE INTO reelHashtag (reelId, hashtagId) VALUES ${rows.map(() => '(?, ?)').join(', ')}`,
      rows.flatMap((row) => [reelId, row.id])
    );
  }
}

// ---------------------------------------------------------------------------
// Agregats et hydratation
// ---------------------------------------------------------------------------
export async function getReelAggregates(reelId, viewerId) {
  const reactionRows = await query('SELECT type, COUNT(*) AS count FROM reelReaction WHERE reelId = ? GROUP BY type', [reelId]);
  const commentRows = await query('SELECT COUNT(*) AS count FROM reelComment WHERE reelId = ? AND deletedAt IS NULL', [reelId]);
  const mine = viewerId
    ? await query('SELECT type FROM reelReaction WHERE reelId = ? AND userId = ? LIMIT 1', [reelId, viewerId])
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
    commentCount: Number(commentRows[0]?.count || 0),
    myReaction: mine[0] ? mine[0].type : null
  };
}

async function getRelationsBatch(viewerId, authorIds) {
  const result = {};
  authorIds.forEach((id) => {
    result[id] = id === viewerId ? 'self' : 'none';
  });
  const others = authorIds.filter((id) => id !== viewerId);
  if (others.length === 0) return result;
  const placeholders = others.map(() => '?').join(', ');
  const rows = await query(
    `SELECT requesterId, addresseeId, status FROM friend
     WHERE (requesterId = ? AND addresseeId IN (${placeholders})) OR (addresseeId = ? AND requesterId IN (${placeholders}))`,
    [viewerId, ...others, viewerId, ...others]
  );
  rows.forEach((row) => {
    const other = row.requesterId === viewerId ? row.addresseeId : row.requesterId;
    if (row.status === 'accepted') result[other] = 'friends';
    else result[other] = row.requesterId === viewerId ? 'requestSent' : 'requestReceived';
  });
  return result;
}

export async function hydrateReels(rows, viewerId, whyById = {}) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');

  const [hashtagRows, reactionRows, commentRows, myRows] = await Promise.all([
    query(
      `SELECT rh.reelId, h.name FROM reelHashtag rh JOIN hashtag h ON h.id = rh.hashtagId WHERE rh.reelId IN (${placeholders})`,
      ids
    ),
    query(`SELECT reelId, type, COUNT(*) AS count FROM reelReaction WHERE reelId IN (${placeholders}) GROUP BY reelId, type`, ids),
    query(
      `SELECT reelId, COUNT(*) AS count FROM reelComment WHERE reelId IN (${placeholders}) AND deletedAt IS NULL GROUP BY reelId`,
      ids
    ),
    query(`SELECT reelId, type FROM reelReaction WHERE reelId IN (${placeholders}) AND userId = ?`, [...ids, viewerId])
  ]);

  const relations = await getRelationsBatch(viewerId, [...new Set(rows.map((row) => row.userId))]);

  const tagsByReel = {};
  hashtagRows.forEach((row) => {
    (tagsByReel[row.reelId] = tagsByReel[row.reelId] || []).push(row.name);
  });
  const aggregates = {};
  ids.forEach((id) => {
    aggregates[id] = { reactionsByType: emptyReactionMap(), totalReactions: 0, commentCount: 0, myReaction: null };
  });
  reactionRows.forEach((row) => {
    aggregates[row.reelId].reactionsByType[row.type] = Number(row.count);
    aggregates[row.reelId].totalReactions += Number(row.count);
  });
  commentRows.forEach((row) => {
    aggregates[row.reelId].commentCount = Number(row.count);
  });
  myRows.forEach((row) => {
    aggregates[row.reelId].myReaction = row.type;
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    videoUrl: mediaUrl(row.mediaId),
    caption: row.caption,
    visibility: row.visibility,
    durationSec: row.durationSec === null ? null : Number(row.durationSec),
    viewsCount: row.viewsCount,
    isEdited: Boolean(row.isEdited),
    createdAt: row.createdAt,
    hashtags: tagsByReel[row.id] || [],
    author: {
      id: row.userId,
      firstName: row.authorFirstName,
      lastName: row.authorLastName,
      avatar: mediaUrl(row.authorAvatarId),
      verified: Boolean(row.authorVerified)
    },
    relation: relations[row.userId] || 'none',
    why: whyById[row.id] || null,
    ...aggregates[row.id]
  }));
}

// ---------------------------------------------------------------------------
// RECOMMANDATION "POUR VOUS"
//
// Systeme deterministe (aucune IA externe), en 4 temps :
//  1. Profil de gout : chaque interaction passee (temps de visionnage, boucles,
//     reactions, commentaires, ajouts en collection, "pas interesse", skips
//     rapides) produit un signal positif ou negatif reparti sur les hashtags
//     et l'auteur du reel. Les reactions a des publications avec hashtags
//     comptent aussi (signal plus faible).
//  2. Candidats : reels visibles recents, non masques, hors reels de l'utilisateur.
//  3. Score = interet(hashtags) + affinite auteur + proximite sociale +
//     qualite (taux de visionnage / likes / commentaires, lisse) + fraicheur +
//     popularite + duree preferee, puis penalite si deja vu.
//  4. Re-classement : jamais deux reels du meme auteur d'affilee, et ~20 % de
//     slots d'exploration (contenus recents peu vus) pour eviter la bulle.
// ---------------------------------------------------------------------------
const SIGNAL_WINDOW_DAYS = 90;
const REACTION_SIGNAL = { like: 2.5, haha: 2.5, wow: 2.5, grr: 1, sad: 1, dislike: -3 };

function squash(value, scale) {
  return Math.tanh(value / scale);
}

async function buildTasteProfile(viewerId) {
  const [views, reactions, comments, collected, hidden] = await Promise.all([
    query(
      `SELECT v.reelId, v.maxRatio, v.loops, v.skipped, v.durationMs, r.userId AS authorId, r.durationSec
       FROM reelView v JOIN reel r ON r.id = v.reelId
       WHERE v.userId = ? AND v.updatedAt > DATE_SUB(NOW(), INTERVAL ${SIGNAL_WINDOW_DAYS} DAY)
       ORDER BY v.updatedAt DESC LIMIT 400`,
      [viewerId]
    ),
    query(
      `SELECT rr.reelId, rr.type, r.userId AS authorId FROM reelReaction rr JOIN reel r ON r.id = rr.reelId
       WHERE rr.userId = ? AND rr.createdAt > DATE_SUB(NOW(), INTERVAL ${SIGNAL_WINDOW_DAYS} DAY) LIMIT 300`,
      [viewerId]
    ),
    query(
      `SELECT DISTINCT c.reelId, r.userId AS authorId FROM reelComment c JOIN reel r ON r.id = c.reelId
       WHERE c.userId = ? AND c.deletedAt IS NULL AND c.createdAt > DATE_SUB(NOW(), INTERVAL ${SIGNAL_WINDOW_DAYS} DAY) LIMIT 200`,
      [viewerId]
    ),
    query(
      `SELECT ci.itemId AS reelId, r.userId AS authorId FROM collectionItem ci
       JOIN collection c ON c.id = ci.collectionId JOIN reel r ON r.id = ci.itemId
       WHERE ci.itemType = 'reel' AND c.userId = ? LIMIT 200`,
      [viewerId]
    ),
    query(
      `SELECT h.reelId, r.userId AS authorId FROM reelHidden h JOIN reel r ON r.id = h.reelId WHERE h.userId = ? LIMIT 200`,
      [viewerId]
    )
  ]);

  // signal brut par reel
  const perReel = new Map();
  const authorOf = new Map();
  const add = (reelId, authorId, value) => {
    perReel.set(reelId, (perReel.get(reelId) || 0) + value);
    authorOf.set(reelId, authorId);
  };

  const seen = new Map(); // reelId -> { ratio, skipped }
  const bucketStats = { short: { sum: 0, n: 0 }, mid: { sum: 0, n: 0 }, long: { sum: 0, n: 0 } };

  views.forEach((row) => {
    const ratio = Math.min(Number(row.maxRatio) || 0, 1.2);
    const loops = Math.min(row.loops || 0, 3);
    let value = ratio * 1.2 + loops * 0.6;
    if (row.skipped && ratio < 0.25) value = -0.8;
    add(row.reelId, row.authorId, value);
    seen.set(row.reelId, { ratio, skipped: Boolean(row.skipped) });

    const seconds = Number(row.durationSec) || Number(row.durationMs) / 1000 || 0;
    const bucket = seconds < 20 ? 'short' : seconds < 60 ? 'mid' : 'long';
    bucketStats[bucket].sum += Math.min(ratio, 1);
    bucketStats[bucket].n += 1;
  });
  reactions.forEach((row) => add(row.reelId, row.authorId, REACTION_SIGNAL[row.type] ?? 1));
  comments.forEach((row) => add(row.reelId, row.authorId, 2));
  collected.forEach((row) => add(row.reelId, row.authorId, 3));
  hidden.forEach((row) => add(row.reelId, row.authorId, -4));

  const tagWeight = new Map();
  const authorWeight = new Map();
  const reelIds = [...perReel.keys()];

  if (reelIds.length > 0) {
    const tagRows = await query(
      `SELECT rh.reelId, h.name FROM reelHashtag rh JOIN hashtag h ON h.id = rh.hashtagId
       WHERE rh.reelId IN (${reelIds.map(() => '?').join(', ')})`,
      reelIds
    );
    const tagsByReel = {};
    tagRows.forEach((row) => {
      (tagsByReel[row.reelId] = tagsByReel[row.reelId] || []).push(row.name);
    });
    perReel.forEach((value, reelId) => {
      const tags = tagsByReel[reelId] || [];
      tags.forEach((tag) => tagWeight.set(tag, (tagWeight.get(tag) || 0) + value / Math.sqrt(tags.length)));
      const author = authorOf.get(reelId);
      authorWeight.set(author, (authorWeight.get(author) || 0) + value);
    });
  }

  // Signal plus faible : hashtags des publications auxquelles l'utilisateur a reagi.
  const postTagRows = await query(
    `SELECT h.name, COUNT(*) AS n FROM reaction rc
     JOIN postHashtag ph ON ph.postId = rc.postId JOIN hashtag h ON h.id = ph.hashtagId
     WHERE rc.userId = ? AND rc.type <> 'dislike' AND rc.createdAt > DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY h.name ORDER BY n DESC LIMIT 60`,
    [viewerId]
  );
  postTagRows.forEach((row) => tagWeight.set(row.name, (tagWeight.get(row.name) || 0) + 0.5 * Number(row.n)));

  const bucketFit = {};
  Object.entries(bucketStats).forEach(([bucket, stat]) => {
    bucketFit[bucket] = stat.n >= 3 ? stat.sum / stat.n : 0.5;
  });

  return { tagWeight, authorWeight, seen, bucketFit, hasHistory: perReel.size > 0 };
}

async function getSocialGraph(viewerId) {
  const rows = await query(
    `SELECT IF(requesterId = ?, addresseeId, requesterId) AS friendId FROM friend
     WHERE status = 'accepted' AND (requesterId = ? OR addresseeId = ?)`,
    [viewerId, viewerId, viewerId]
  );
  const friends = new Set(rows.map((row) => row.friendId));
  const secondDegree = new Set();
  if (friends.size > 0) {
    const ids = [...friends].slice(0, 300);
    const placeholders = ids.map(() => '?').join(', ');
    const second = await query(
      `SELECT requesterId, addresseeId FROM friend
       WHERE status = 'accepted' AND (requesterId IN (${placeholders}) OR addresseeId IN (${placeholders})) LIMIT 4000`,
      [...ids, ...ids]
    );
    second.forEach((row) => {
      [row.requesterId, row.addresseeId].forEach((id) => {
        if (id !== viewerId && !friends.has(id)) secondDegree.add(id);
      });
    });
  }
  return { friends, secondDegree };
}

export async function getRecommendedReels(viewerId, { exclude = [], limit = 6 } = {}) {
  const vis = reelVisibilitySql(viewerId);
  const excludeIds = exclude.filter((id) => Number.isInteger(id)).slice(-300);
  const excludeClause = excludeIds.length > 0 ? `AND r.id NOT IN (${excludeIds.map(() => '?').join(', ')})` : '';

  const [profile, graph, candidates] = await Promise.all([
    buildTasteProfile(viewerId),
    getSocialGraph(viewerId),
    query(
      `${REEL_SELECT}
       WHERE ${vis.clause} AND r.userId <> ? ${excludeClause}
         AND NOT EXISTS (SELECT 1 FROM reelHidden hd WHERE hd.reelId = r.id AND hd.userId = ?)
         AND r.createdAt > DATE_SUB(NOW(), INTERVAL 60 DAY)
       ORDER BY r.createdAt DESC LIMIT 300`,
      [...vis.params, viewerId, ...excludeIds, viewerId]
    )
  ]);

  if (candidates.length === 0) return [];

  const ids = candidates.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  const [tagRows, statRows, likeRows, commentRows] = await Promise.all([
    query(`SELECT rh.reelId, h.name FROM reelHashtag rh JOIN hashtag h ON h.id = rh.hashtagId WHERE rh.reelId IN (${placeholders})`, ids),
    query(
      `SELECT reelId, COUNT(*) AS views, AVG(maxRatio) AS avgRatio FROM reelView WHERE reelId IN (${placeholders}) GROUP BY reelId`,
      ids
    ),
    query(
      `SELECT reelId, SUM(type <> 'dislike') AS likes, SUM(type = 'dislike') AS dislikes FROM reelReaction WHERE reelId IN (${placeholders}) GROUP BY reelId`,
      ids
    ),
    query(`SELECT reelId, COUNT(*) AS n FROM reelComment WHERE reelId IN (${placeholders}) AND deletedAt IS NULL GROUP BY reelId`, ids)
  ]);

  const tagsByReel = {};
  tagRows.forEach((row) => {
    (tagsByReel[row.reelId] = tagsByReel[row.reelId] || []).push(row.name);
  });
  const stats = {};
  statRows.forEach((row) => {
    stats[row.reelId] = { views: Number(row.views), avgRatio: Number(row.avgRatio) || 0 };
  });
  const likes = {};
  likeRows.forEach((row) => {
    likes[row.reelId] = { likes: Number(row.likes) || 0, dislikes: Number(row.dislikes) || 0 };
  });
  const commentsCount = {};
  commentRows.forEach((row) => {
    commentsCount[row.reelId] = Number(row.n);
  });

  const now = Date.now();
  const scored = candidates.map((row) => {
    const tags = tagsByReel[row.id] || [];
    const stat = stats[row.id] || { views: 0, avgRatio: 0 };
    const lk = likes[row.id] || { likes: 0, dislikes: 0 };
    const cm = commentsCount[row.id] || 0;
    const views = stat.views;

    // interet pour les hashtags
    let tagSum = 0;
    let bestTag = null;
    let bestTagWeight = 0;
    tags.forEach((tag) => {
      const weight = profile.tagWeight.get(tag) || 0;
      tagSum += weight;
      if (weight > bestTagWeight) {
        bestTagWeight = weight;
        bestTag = tag;
      }
    });
    const topic = squash(tagSum, 4);
    const authorAffinity = squash(profile.authorWeight.get(row.userId) || 0, 5);

    const social = graph.friends.has(row.userId) ? 1 : graph.secondDegree.has(row.userId) ? 0.5 : 0;

    // qualite lissee (priors pour ne pas sur-noter un reel peu vu)
    const completion = (stat.avgRatio * views + 0.5 * 5) / (views + 5);
    const likeRate = (lk.likes + 1) / (views + 10);
    const commentRate = (cm + 0.2) / (views + 10);
    const dislikePenalty = Math.min(0.4, (lk.dislikes / (views + 5)) * 2);
    const quality = Math.max(0, Math.min(1, 0.5 * Math.min(completion, 1) + 0.3 * Math.min(1, likeRate * 5) + 0.2 * Math.min(1, commentRate * 15) - dislikePenalty));
    const popularity = Math.min(1, Math.log10(1 + views + 3 * lk.likes + 5 * cm) / 3);

    const ageHours = Math.max(0, (now - new Date(String(row.createdAt).replace(' ', 'T')).getTime()) / 3600000);
    const freshness = Math.exp(-ageHours / 48);

    const seconds = Number(row.durationSec) || 0;
    const bucket = seconds < 20 ? 'short' : seconds < 60 ? 'mid' : 'long';
    const durationFit = profile.bucketFit[bucket];

    let score = 0.3 * topic + 0.18 * authorAffinity + 0.12 * social + 0.16 * quality + 0.12 * freshness + 0.04 * popularity + 0.08 * durationFit;

    // cold start : petit coup de pouce aux contenus neufs peu exposes
    const isFreshAndUnseen = ageHours < 36 && views < 15;
    if (isFreshAndUnseen) score += 0.06;

    // deja vu : fortement penalise (mais pas exclu, pour ne jamais tomber a court)
    const seenInfo = profile.seen.get(row.id);
    if (seenInfo) score *= seenInfo.skipped && seenInfo.ratio < 0.25 ? 0.15 : seenInfo.ratio >= 0.85 ? 0.2 : 0.4;

    let why = null;
    if (bestTag && bestTagWeight >= 1.5 && topic >= 0.2) why = { kind: 'tag', tag: bestTag };
    else if (graph.friends.has(row.userId)) why = { kind: 'friend' };
    else if (authorAffinity >= 0.25) why = { kind: 'author' };
    else if (isFreshAndUnseen) why = { kind: 'new' };
    else if (popularity >= 0.55) why = { kind: 'trending' };

    return { row, score, tags, why, isExplore: isFreshAndUnseen && !seenInfo };
  });

  scored.sort((a, b) => b.score - a.score);

  // Re-classement : diversite d'auteur + exploration.
  const picked = [];
  const pool = [...scored];
  while (picked.length < limit && pool.length > 0) {
    const last = picked[picked.length - 1];
    const explore = picked.length % 5 === 4 && Math.random() < 0.6;
    let index;
    if (explore) {
      const exploreIdx = pool.findIndex((item, i) => i < 40 && item.isExplore && (!last || item.row.userId !== last.row.userId));
      index = exploreIdx >= 0 ? exploreIdx : -1;
    } else {
      index = -1;
    }
    if (index < 0) {
      index = pool.findIndex((item) => !last || item.row.userId !== last.row.userId);
      if (index < 0) index = 0;
    }
    const [item] = pool.splice(index, 1);
    if (explore && item.isExplore && !item.why) item.why = { kind: 'new' };
    picked.push(item);
  }

  const whyById = Object.fromEntries(picked.map((item) => [item.row.id, item.why]));
  return hydrateReels(picked.map((item) => item.row), viewerId, whyById);
}

// Flux chronologique d'un sous-ensemble (amis, un auteur).
export async function getChronologicalReels(viewerId, { mode, userId, before, limit = 8 } = {}) {
  const vis = reelVisibilitySql(viewerId);
  const where = [vis.clause];
  const params = [...vis.params];

  if (mode === 'friends') {
    where.push(
      `r.userId <> ? AND EXISTS (SELECT 1 FROM friend fr WHERE fr.status = 'accepted' AND ((fr.requesterId = ? AND fr.addresseeId = r.userId) OR (fr.requesterId = r.userId AND fr.addresseeId = ?)))`
    );
    params.push(viewerId, viewerId, viewerId);
  }
  if (mode === 'user') {
    where.push('r.userId = ?');
    params.push(userId);
  }
  if (before) {
    where.push('r.id < ?');
    params.push(Number(before));
  }

  const rows = await query(`${REEL_SELECT} WHERE ${where.join(' AND ')} ORDER BY r.id DESC LIMIT ${limit + 1}`, params);
  const page = rows.slice(0, limit);
  return {
    reels: await hydrateReels(page, viewerId),
    hasMore: rows.length > limit,
    nextCursor: page.length > 0 ? page[page.length - 1].id : null
  };
}

// ---------------------------------------------------------------------------
// Commentaires de reels (avec reponses)
// ---------------------------------------------------------------------------
export const REEL_COMMENT_SELECT = `
  SELECT c.id, c.reelId, c.parentId, c.content, c.isEdited, c.createdAt,
         u.id AS authorId, u.firstName AS authorFirstName, u.lastName AS authorLastName, u.avatarId AS authorAvatarId,
         ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS authorVerified
  FROM reelComment c
  JOIN user u ON u.id = c.userId AND u.bannedAt IS NULL
`;

export async function getReelCommentAggregates(commentId, viewerId) {
  const reactionRows = await query('SELECT type, COUNT(*) AS count FROM reelCommentReaction WHERE commentId = ? GROUP BY type', [commentId]);
  const replyRows = await query('SELECT COUNT(*) AS count FROM reelComment WHERE parentId = ? AND deletedAt IS NULL', [commentId]);
  const mine = viewerId
    ? await query('SELECT type FROM reelCommentReaction WHERE commentId = ? AND userId = ? LIMIT 1', [commentId, viewerId])
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
    replyCount: Number(replyRows[0]?.count || 0),
    myReaction: mine[0] ? mine[0].type : null
  };
}

export async function hydrateReelComments(rows, viewerId) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  const [reactionRows, replyRows, myRows] = await Promise.all([
    query(`SELECT commentId, type, COUNT(*) AS count FROM reelCommentReaction WHERE commentId IN (${placeholders}) GROUP BY commentId, type`, ids),
    query(`SELECT parentId, COUNT(*) AS count FROM reelComment WHERE parentId IN (${placeholders}) AND deletedAt IS NULL GROUP BY parentId`, ids),
    query(`SELECT commentId, type FROM reelCommentReaction WHERE commentId IN (${placeholders}) AND userId = ?`, [...ids, viewerId])
  ]);

  const agg = {};
  ids.forEach((id) => {
    agg[id] = { reactionsByType: emptyReactionMap(), totalReactions: 0, replyCount: 0, myReaction: null };
  });
  reactionRows.forEach((row) => {
    agg[row.commentId].reactionsByType[row.type] = Number(row.count);
    agg[row.commentId].totalReactions += Number(row.count);
  });
  replyRows.forEach((row) => {
    agg[row.parentId].replyCount = Number(row.count);
  });
  myRows.forEach((row) => {
    agg[row.commentId].myReaction = row.type;
  });

  return rows.map((row) => ({
    id: row.id,
    reelId: row.reelId,
    parentId: row.parentId,
    content: row.content,
    isEdited: Boolean(row.isEdited),
    createdAt: row.createdAt,
    author: {
      id: row.authorId,
      firstName: row.authorFirstName,
      lastName: row.authorLastName,
      avatar: mediaUrl(row.authorAvatarId),
      verified: Boolean(row.authorVerified)
    },
    ...agg[row.id]
  }));
}
