import { query } from './db';

export async function getFriendRow(userIdA, userIdB) {
  const rows = await query(
    'SELECT * FROM friend WHERE (requesterId = ? AND addresseeId = ?) OR (requesterId = ? AND addresseeId = ?) LIMIT 1',
    [userIdA, userIdB, userIdB, userIdA]
  );
  return rows[0] || null;
}

export async function getBlockStatus(meId, otherId) {
  const rows = await query(
    'SELECT blockerId, blockedId FROM block WHERE (blockerId = ? AND blockedId = ?) OR (blockerId = ? AND blockedId = ?)',
    [meId, otherId, otherId, meId]
  );

  let blockedByMe = false;
  let blockingMe = false;

  rows.forEach((row) => {
    if (row.blockerId === meId) blockedByMe = true;
    if (row.blockerId === otherId) blockingMe = true;
  });

  return { blockedByMe, blockingMe };
}

export async function getRelationStatus(meId, otherId) {
  if (meId === otherId) return 'self';

  const { blockedByMe, blockingMe } = await getBlockStatus(meId, otherId);
  if (blockedByMe) return 'blockedByMe';
  if (blockingMe) return 'blockingMe';

  const friendRow = await getFriendRow(meId, otherId);
  if (!friendRow) return 'none';
  if (friendRow.status === 'accepted') return 'friends';
  if (friendRow.status === 'pending' && friendRow.requesterId === meId) return 'requestSent';
  if (friendRow.status === 'pending' && friendRow.requesterId === otherId) return 'requestReceived';

  return 'none';
}

export async function getMutualFriendsCount(meId, otherId) {
  if (meId === otherId) return 0;

  const rows = await query(
    `SELECT COUNT(*) as count FROM (
      SELECT CASE WHEN requesterId = ? THEN addresseeId ELSE requesterId END as friendId
      FROM friend WHERE status = 'accepted' AND (requesterId = ? OR addresseeId = ?)
    ) as a INNER JOIN (
      SELECT CASE WHEN requesterId = ? THEN addresseeId ELSE requesterId END as friendId
      FROM friend WHERE status = 'accepted' AND (requesterId = ? OR addresseeId = ?)
    ) as b ON a.friendId = b.friendId`,
    [meId, meId, meId, otherId, otherId, otherId]
  );

  return rows[0] ? Number(rows[0].count) : 0;
}

export async function getFriendsCount(userId) {
  const rows = await query(
    "SELECT COUNT(*) as count FROM friend WHERE status = 'accepted' AND (requesterId = ? OR addresseeId = ?)",
    [userId, userId]
  );
  return rows[0] ? Number(rows[0].count) : 0;
}

export async function getFriendsList(userId, limit) {
  const limitClause = Number.isInteger(limit) ? `LIMIT ${Number(limit)}` : '';
  const rows = await query(
    `SELECT u.id, u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified
     FROM friend f
     JOIN user u ON u.id = IF(f.requesterId = ?, f.addresseeId, f.requesterId)
     WHERE f.status = 'accepted' AND (f.requesterId = ? OR f.addresseeId = ?)
     ORDER BY u.firstName ASC
     ${limitClause}`,
    [userId, userId, userId]
  );
  return rows;
}
