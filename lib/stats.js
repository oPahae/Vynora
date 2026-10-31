import { query } from './db';
import { getFriendsCount } from './friends';

const ENGAGEMENT_WEEKS = 8;

export async function getUserStats(userId) {
  const [postsRows, reactionsRows, commentsRows, sharesRows, viewsRows, friendsCount] = await Promise.all([
    query("SELECT COUNT(*) as count FROM post WHERE userId = ? AND deletedAt IS NULL AND kind = 'standard'", [userId]),
    query(
      `SELECT COUNT(*) as count FROM reaction r JOIN post p ON p.id = r.postId WHERE p.userId = ? AND p.deletedAt IS NULL`,
      [userId]
    ),
    query(
      `SELECT COUNT(*) as count FROM comment c JOIN post p ON p.id = c.postId WHERE p.userId = ? AND p.deletedAt IS NULL AND c.deletedAt IS NULL`,
      [userId]
    ),
    query(
      `SELECT COUNT(*) as count FROM post shared JOIN post original ON original.id = shared.sharedPostId
       WHERE original.userId = ? AND shared.deletedAt IS NULL`,
      [userId]
    ),
    query("SELECT COALESCE(SUM(viewsCount), 0) as total FROM post WHERE userId = ? AND deletedAt IS NULL AND kind = 'standard'", [
      userId
    ]),
    getFriendsCount(userId)
  ]);

  return {
    postsCount: Number(postsRows[0].count),
    reactionsReceived: Number(reactionsRows[0].count),
    commentsReceived: Number(commentsRows[0].count),
    sharesReceived: Number(sharesRows[0].count),
    viewsReceived: Number(viewsRows[0].total),
    friendsCount
  };
}

// Evolution de l'engagement (reactions + commentaires recus) semaine par
// semaine, sur les ENGAGEMENT_WEEKS dernieres semaines. Donnees reelles
// uniquement : une semaine sans interaction vaut 0, jamais une valeur
// inventee.
export async function getEngagementTrend(userId) {
  const reactionRows = await query(
    `SELECT YEARWEEK(r.createdAt, 3) as yw, COUNT(*) as count
     FROM reaction r JOIN post p ON p.id = r.postId
     WHERE p.userId = ? AND p.deletedAt IS NULL
       AND r.createdAt > DATE_SUB(NOW(), INTERVAL ${ENGAGEMENT_WEEKS} WEEK)
     GROUP BY yw`,
    [userId]
  );
  const commentRows = await query(
    `SELECT YEARWEEK(c.createdAt, 3) as yw, COUNT(*) as count
     FROM comment c JOIN post p ON p.id = c.postId
     WHERE p.userId = ? AND p.deletedAt IS NULL AND c.deletedAt IS NULL
       AND c.createdAt > DATE_SUB(NOW(), INTERVAL ${ENGAGEMENT_WEEKS} WEEK)
     GROUP BY yw`,
    [userId]
  );

  const byWeek = new Map();
  reactionRows.forEach((row) => byWeek.set(row.yw, (byWeek.get(row.yw) || 0) + Number(row.count)));
  commentRows.forEach((row) => byWeek.set(row.yw, (byWeek.get(row.yw) || 0) + Number(row.count)));

  // Construit les ENGAGEMENT_WEEKS derniers points, y compris les semaines
  // a 0, dans l'ordre chronologique (voir buildWeekBuckets).
  const buckets = buildWeekBuckets(ENGAGEMENT_WEEKS);
  return buckets.map((bucket) => ({ ...bucket, count: byWeek.get(bucket.yearWeek) || 0 }));
}

function buildWeekBuckets(weeks) {
  const buckets = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7);
    const yearWeek = getIsoYearWeek(date);
    buckets.push({ yearWeek, date: date.toISOString(), label: formatWeekLabel(date) });
  }
  return buckets;
}

// Reproduit le mode 3 de MySQL YEARWEEK() (semaine ISO, lundi premier jour)
// cote JavaScript pour construire les cles de bucket.
function getIsoYearWeek(date) {
  const target = new Date(date.getTime());
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return Number(`${target.getFullYear()}${String(week).padStart(2, '0')}`);
}

function formatWeekLabel(date) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
