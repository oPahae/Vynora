import { query } from './db';
import { mediaUrl } from './upload';

function like(q) {
  return `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function person(row, prefix = '') {
  return {
    id: row[`${prefix}userId`],
    firstName: row[`${prefix}firstName`],
    lastName: row[`${prefix}lastName`],
    avatar: mediaUrl(row[`${prefix}avatarId`]),
    banned: Boolean(row[`${prefix}bannedAt`])
  };
}

export async function getOverview() {
  const [counts] = await query(`
    SELECT
      (SELECT COUNT(*) FROM user) AS users,
      (SELECT COUNT(*) FROM user WHERE bannedAt IS NOT NULL) AS bannedUsers,
      (SELECT COUNT(*) FROM user WHERE role = 'admin') AS admins,
      (SELECT COUNT(*) FROM user WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS newUsers7d,
      (SELECT COUNT(*) FROM post WHERE deletedAt IS NULL) AS posts,
      (SELECT COUNT(*) FROM post WHERE deletedAt IS NULL AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS posts7d,
      (SELECT COUNT(*) FROM comment WHERE deletedAt IS NULL) + (SELECT COUNT(*) FROM reelComment WHERE deletedAt IS NULL) AS comments,
      (SELECT COUNT(*) FROM reel WHERE deletedAt IS NULL) AS reels,
      (SELECT COUNT(*) FROM communityGroup) AS groups_,
      (SELECT COUNT(*) FROM guild) AS servers,
      (SELECT COUNT(DISTINCT CONCAT(targetType, ':', targetId)) FROM report WHERE status = 'pending') AS pendingReports,
      (SELECT COUNT(*) FROM report) AS totalReports,
      (SELECT COUNT(*) FROM banAppeal WHERE status = 'pending') AS pendingAppeals,
      (SELECT COUNT(*) FROM user WHERE premiumUntil IS NOT NULL AND premiumUntil > NOW()) AS premiumUsers
  `);

  const signups = await query(
    `SELECT DATE(createdAt) AS day, COUNT(*) AS count FROM user
     WHERE createdAt >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) GROUP BY DATE(createdAt)`
  );
  const postsPerDay = await query(
    `SELECT DATE(createdAt) AS day, COUNT(*) AS count FROM post
     WHERE deletedAt IS NULL AND createdAt >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) GROUP BY DATE(createdAt)`
  );

  // 14 jours continus (jours vides = 0).
  const days = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    days.push(date.toISOString().slice(0, 10));
  }
  const toSeries = (rows) => {
    const map = Object.fromEntries(rows.map((row) => [String(row.day).slice(0, 10), Number(row.count)]));
    return days.map((day) => ({ day, count: map[day] || 0 }));
  };

  return {
    counts: {
      users: Number(counts.users),
      bannedUsers: Number(counts.bannedUsers),
      admins: Number(counts.admins),
      newUsers7d: Number(counts.newUsers7d),
      posts: Number(counts.posts),
      posts7d: Number(counts.posts7d),
      comments: Number(counts.comments),
      reels: Number(counts.reels),
      groups: Number(counts.groups_),
      servers: Number(counts.servers),
      pendingReports: Number(counts.pendingReports),
      totalReports: Number(counts.totalReports),
      pendingAppeals: Number(counts.pendingAppeals),
      premiumUsers: Number(counts.premiumUsers)
    },
    signups: toSeries(signups),
    postsPerDay: toSeries(postsPerDay)
  };
}

// --- Listes de contenus -------------------------------------------------------
// Chaque lecteur recoit { q, offset, limit, filter } et renvoie { items, hasMore }.
const READERS = {
  users: async ({ q, offset, limit, filter }) => {
    const where = ['1=1'];
    const params = [];
    if (q) {
      where.push("(CONCAT(firstName, ' ', lastName) LIKE ? OR email LIKE ? OR id = ?)");
      params.push(like(q), like(q), Number(q) || 0);
    }
    if (filter === 'banned') where.push('bannedAt IS NOT NULL');
    if (filter === 'admin') where.push("role = 'admin'");
    const rows = await query(
      `SELECT id, firstName, lastName, email, avatarId, role, bannedAt, banReason, premiumUntil, createdAt, lastSeenAt,
              (SELECT COUNT(*) FROM post p WHERE p.userId = user.id AND p.deletedAt IS NULL) AS postsCount,
              (SELECT COUNT(*) FROM report r WHERE r.targetUserId = user.id) AS reportsAgainst
       FROM user WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ${limit + 1} OFFSET ${offset}`,
      params
    );
    return rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      avatar: mediaUrl(row.avatarId),
      role: row.role,
      banned: Boolean(row.bannedAt),
      bannedAt: row.bannedAt,
      banReason: row.banReason,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
      premium: Boolean(row.premiumUntil && new Date(String(row.premiumUntil).replace(' ', 'T')).getTime() > Date.now()),
      premiumUntil: row.premiumUntil,
      postsCount: Number(row.postsCount),
      reportsAgainst: Number(row.reportsAgainst)
    }));
  },

  posts: async ({ q, offset, limit }) => {
    const params = [];
    let where = 'p.deletedAt IS NULL';
    if (q) {
      where += " AND (p.content LIKE ? OR CONCAT(u.firstName, ' ', u.lastName) LIKE ? OR p.id = ?)";
      params.push(like(q), like(q), Number(q) || 0);
    }
    const rows = await query(
      `SELECT p.id, p.content, p.visibility, p.createdAt, p.groupId, p.userId, u.firstName, u.lastName, u.avatarId, u.bannedAt,
              (SELECT COUNT(*) FROM postMedia pm WHERE pm.postId = p.id) AS mediaCount
       FROM post p JOIN user u ON u.id = p.userId
       WHERE ${where} ORDER BY p.id DESC LIMIT ${limit + 1} OFFSET ${offset}`,
      params
    );
    return rows.map((row) => ({
      id: row.id,
      text: row.content,
      mediaCount: Number(row.mediaCount),
      visibility: row.visibility,
      groupId: row.groupId,
      createdAt: row.createdAt,
      author: person(row),
      href: `/post/${row.id}`
    }));
  },

  comments: async ({ q, offset, limit }) => {
    const params = [];
    let where = 'c.deletedAt IS NULL';
    if (q) {
      where += " AND (c.content LIKE ? OR CONCAT(u.firstName, ' ', u.lastName) LIKE ?)";
      params.push(like(q), like(q));
    }
    const rows = await query(
      `SELECT c.id, c.content, c.mediaType, c.postId, c.createdAt, c.userId, u.firstName, u.lastName, u.avatarId, u.bannedAt
       FROM comment c JOIN user u ON u.id = c.userId
       WHERE ${where} ORDER BY c.id DESC LIMIT ${limit + 1} OFFSET ${offset}`,
      params
    );
    return rows.map((row) => ({
      id: row.id,
      text: row.content || (row.mediaType ? `[${row.mediaType}]` : ''),
      createdAt: row.createdAt,
      author: person(row),
      href: `/post/${row.postId}`
    }));
  },

  reels: async ({ q, offset, limit }) => {
    const params = [];
    let where = 'r.deletedAt IS NULL';
    if (q) {
      where += " AND (r.caption LIKE ? OR CONCAT(u.firstName, ' ', u.lastName) LIKE ?)";
      params.push(like(q), like(q));
    }
    const rows = await query(
      `SELECT r.id, r.caption, r.mediaId, r.visibility, r.viewsCount, r.createdAt, r.userId, u.firstName, u.lastName, u.avatarId, u.bannedAt
       FROM reel r JOIN user u ON u.id = r.userId
       WHERE ${where} ORDER BY r.id DESC LIMIT ${limit + 1} OFFSET ${offset}`,
      params
    );
    return rows.map((row) => ({
      id: row.id,
      text: row.caption,
      videoUrl: mediaUrl(row.mediaId),
      visibility: row.visibility,
      views: row.viewsCount,
      createdAt: row.createdAt,
      author: person(row),
      href: `/reels?id=${row.id}`
    }));
  },

  reelComments: async ({ q, offset, limit }) => {
    const params = [];
    let where = 'c.deletedAt IS NULL';
    if (q) {
      where += " AND (c.content LIKE ? OR CONCAT(u.firstName, ' ', u.lastName) LIKE ?)";
      params.push(like(q), like(q));
    }
    const rows = await query(
      `SELECT c.id, c.content, c.reelId, c.createdAt, c.userId, u.firstName, u.lastName, u.avatarId, u.bannedAt
       FROM reelComment c JOIN user u ON u.id = c.userId
       WHERE ${where} ORDER BY c.id DESC LIMIT ${limit + 1} OFFSET ${offset}`,
      params
    );
    return rows.map((row) => ({
      id: row.id,
      text: row.content,
      createdAt: row.createdAt,
      author: person(row),
      href: `/reels?id=${row.reelId}`
    }));
  },

  groups: async ({ q, offset, limit }) => {
    const params = [];
    let where = '1=1';
    if (q) {
      where += ' AND (g.name LIKE ? OR g.description LIKE ?)';
      params.push(like(q), like(q));
    }
    const rows = await query(
      `SELECT g.id, g.name, g.description, g.visibility, g.createdAt, g.ownerId AS userId, u.firstName, u.lastName, u.avatarId, u.bannedAt,
              (SELECT COUNT(*) FROM communityGroupMember m WHERE m.groupId = g.id AND m.status = 'active') AS members
       FROM communityGroup g JOIN user u ON u.id = g.ownerId
       WHERE ${where} ORDER BY g.id DESC LIMIT ${limit + 1} OFFSET ${offset}`,
      params
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.name,
      text: row.description,
      visibility: row.visibility,
      members: Number(row.members),
      createdAt: row.createdAt,
      author: person(row),
      href: `/groups/${row.id}`
    }));
  },

  servers: async ({ q, offset, limit }) => {
    const params = [];
    let where = '1=1';
    if (q) {
      where += ' AND g.name LIKE ?';
      params.push(like(q));
    }
    const rows = await query(
      `SELECT g.id, g.name, g.createdAt, g.ownerId AS userId, u.firstName, u.lastName, u.avatarId, u.bannedAt,
              (SELECT COUNT(*) FROM guildMember m WHERE m.guildId = g.id) AS members
       FROM guild g JOIN user u ON u.id = g.ownerId
       WHERE ${where} ORDER BY g.id DESC LIMIT ${limit + 1} OFFSET ${offset}`,
      params
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.name,
      members: Number(row.members),
      createdAt: row.createdAt,
      author: person(row),
      href: `/servers/${row.id}`
    }));
  }
};

export const ADMIN_LIST_TYPES = Object.keys(READERS);

export async function listContent(type, { q = '', offset = 0, limit = 20, filter = 'all' } = {}) {
  const reader = READERS[type];
  if (!reader) return null;
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const rows = await reader({ q: (q || '').toString().trim().slice(0, 100), offset: safeOffset, limit: safeLimit, filter });
  return { items: rows.slice(0, safeLimit), hasMore: rows.length > safeLimit };
}

// --- Signalements -----------------------------------------------------------
export async function listReportGroups(status = 'pending', offset = 0, limit = 20) {
  const safeStatus = ['pending', 'resolved', 'dismissed'].includes(status) ? status : 'pending';
  const rows = await query(
    `SELECT r.targetType, r.targetId, MAX(r.targetUserId) AS targetUserId, COUNT(*) AS reportCount,
            MAX(r.createdAt) AS lastAt, GROUP_CONCAT(r.reason) AS reasons, MAX(r.snapshot) AS snapshot,
            MAX(r.action) AS action, MAX(r.resolvedAt) AS resolvedAt
     FROM report r WHERE r.status = ?
     GROUP BY r.targetType, r.targetId
     ORDER BY ${safeStatus === 'pending' ? 'reportCount DESC, lastAt DESC' : 'resolvedAt DESC'}
     LIMIT ${limit + 1} OFFSET ${offset}`,
    [safeStatus]
  );

  const page = rows.slice(0, limit);
  const ownerIds = [...new Set(page.map((row) => row.targetUserId).filter(Boolean))];
  let owners = {};
  if (ownerIds.length > 0) {
    const users = await query(
      `SELECT id, firstName, lastName, avatarId, bannedAt FROM user WHERE id IN (${ownerIds.map(() => '?').join(', ')})`,
      ownerIds
    );
    owners = Object.fromEntries(
      users.map((user) => [
        user.id,
        { id: user.id, firstName: user.firstName, lastName: user.lastName, avatar: mediaUrl(user.avatarId), banned: Boolean(user.bannedAt) }
      ])
    );
  }

  const items = [];
  for (const row of page) {
    const reasonCounts = {};
    String(row.reasons || '')
      .split(',')
      .filter(Boolean)
      .forEach((reason) => {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
    // eslint-disable-next-line no-await-in-loop
    const live = await getTargetLiveState(row.targetType, row.targetId);
    items.push({
      targetType: row.targetType,
      targetId: row.targetId,
      reportCount: Number(row.reportCount),
      reasons: reasonCounts,
      snapshot: row.snapshot,
      lastAt: row.lastAt,
      action: row.action,
      resolvedAt: row.resolvedAt,
      owner: row.targetUserId ? owners[row.targetUserId] || null : null,
      exists: live.exists,
      href: live.href
    });
  }

  return { items, hasMore: rows.length > limit };
}

export async function getTargetLiveState(type, id) {
  const probes = {
    user: ['SELECT id FROM user WHERE id = ?', `/profile/${id}`],
    post: ['SELECT id FROM post WHERE id = ? AND deletedAt IS NULL', `/post/${id}`],
    comment: ['SELECT postId AS id FROM comment WHERE id = ? AND deletedAt IS NULL', null],
    reel: ['SELECT id FROM reel WHERE id = ? AND deletedAt IS NULL', `/reels?id=${id}`],
    reelComment: ['SELECT reelId AS id FROM reelComment WHERE id = ? AND deletedAt IS NULL', null],
    group: ['SELECT id FROM communityGroup WHERE id = ?', `/groups/${id}`]
  };
  const probe = probes[type];
  if (!probe) return { exists: false, href: null };
  const rows = await query(probe[0], [id]);
  if (!rows[0]) return { exists: false, href: null };
  let href = probe[1];
  if (type === 'comment') href = `/post/${rows[0].id}`;
  if (type === 'reelComment') href = `/reels?id=${rows[0].id}`;
  return { exists: true, href };
}

export async function getReportDetail(targetType, targetId) {
  const rows = await query(
    `SELECT r.id, r.reason, r.details, r.status, r.createdAt, u.id AS reporterId, u.firstName, u.lastName, u.avatarId
     FROM report r JOIN user u ON u.id = r.reporterId
     WHERE r.targetType = ? AND r.targetId = ? ORDER BY r.id DESC LIMIT 50`,
    [targetType, targetId]
  );
  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.createdAt,
    reporter: { id: row.reporterId, firstName: row.firstName, lastName: row.lastName, avatar: mediaUrl(row.avatarId) }
  }));
}

export async function listAudit(offset = 0, limit = 30) {
  const rows = await query(
    `SELECT a.id, a.action, a.targetType, a.targetId, a.details, a.createdAt, u.id AS adminId, u.firstName, u.lastName, u.avatarId
     FROM adminAudit a JOIN user u ON u.id = a.adminId
     ORDER BY a.id DESC LIMIT ${limit + 1} OFFSET ${offset}`
  );
  return {
    items: rows.slice(0, limit).map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      details: row.details,
      createdAt: row.createdAt,
      admin: { id: row.adminId, firstName: row.firstName, lastName: row.lastName, avatar: mediaUrl(row.avatarId) }
    })),
    hasMore: rows.length > limit
  };
}
