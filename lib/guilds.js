import crypto from 'crypto';
import { query } from '@/lib/db';
import { withAvatarUrl, mediaUrl } from '@/lib/upload';
import { createNotification } from '@/lib/notifications';
import { buildMentionCandidates, extractMentionedIds } from '@/lib/guildMentions';
import { PERMISSIONS, ALL_PERMISSIONS, DEFAULT_EVERYONE_PERMISSIONS, hasPermission } from '@/lib/guildPermissions';

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_SLOWMODE_SECONDS = 6 * 60 * 60;
const MESSAGE_PAGE_SIZE = 50;

// ---------------------------------------------------------------------
// Contexte de permissions d'un membre
// ---------------------------------------------------------------------

// Renvoie null si l'utilisateur n'est pas membre du serveur. Sinon :
// { guild, isOwner, permissions (masque), roleIds, topPosition }
export async function getMemberContext(guildId, userId) {
  const rows = await query(
    `SELECT g.id, g.name, g.description, g.ownerId
     FROM guild g JOIN guildMember m ON m.guildId = g.id AND m.userId = ?
     WHERE g.id = ? LIMIT 1`,
    [userId, guildId]
  );
  if (rows.length === 0) return null;
  const guild = rows[0];

  const roles = await query(
    `SELECT r.id, r.permissions, r.position, r.isDefault
     FROM guildRole r
     LEFT JOIN guildMemberRole mr ON mr.roleId = r.id AND mr.userId = ?
     WHERE r.guildId = ? AND (r.isDefault = 1 OR mr.userId IS NOT NULL)`,
    [userId, guildId]
  );

  const isOwner = guild.ownerId === userId;
  let permissions = roles.reduce((mask, role) => mask | Number(role.permissions), 0);
  if (isOwner) permissions = ALL_PERMISSIONS;

  return {
    userId,
    guild,
    isOwner,
    permissions,
    roleIds: roles.map((role) => role.id),
    // Position du role le plus haut (le proprietaire est au-dessus de tous).
    topPosition: isOwner ? Infinity : Math.max(0, ...roles.map((role) => role.position))
  };
}

export function can(context, permission) {
  return hasPermission(context.permissions, permission);
}

// Un salon prive n'est visible que par les administrateurs, les roles
// autorises et les membres explicitement autorises.
export async function canViewChannel(context, channel, userId) {
  if (!channel.isPrivate) return true;
  if (can(context, PERMISSIONS.ADMINISTRATOR)) return true;

  const rows = await query(
    `SELECT 1 FROM guildChannelMember WHERE channelId = ? AND userId = ?
     UNION
     SELECT 1 FROM guildChannelRole WHERE channelId = ? AND roleId IN (${context.roleIds.map(() => '?').join(',') || 'NULL'})
     LIMIT 1`,
    [channel.id, userId, channel.id, ...context.roleIds]
  );
  return rows.length > 0;
}

// Ids des membres qui peuvent voir un salon (utilise pour cibler les
// evenements temps reel d'un salon prive).
export async function getChannelViewerIds(channel, guildOwnerId) {
  const members = await query('SELECT userId FROM guildMember WHERE guildId = ?', [channel.guildId]);
  if (!channel.isPrivate) return members.map((row) => row.userId);

  const rows = await query(
    `SELECT DISTINCT m.userId FROM guildMember m
     LEFT JOIN guildMemberRole mr ON mr.guildId = m.guildId AND mr.userId = m.userId
     LEFT JOIN guildRole r ON r.id = mr.roleId
     LEFT JOIN guildChannelRole cr ON cr.channelId = ? AND cr.roleId = mr.roleId
     LEFT JOIN guildChannelMember cm ON cm.channelId = ? AND cm.userId = m.userId
     WHERE m.guildId = ?
       AND (m.userId = ? OR cr.roleId IS NOT NULL OR cm.userId IS NOT NULL
            OR (r.permissions & ?) = ?)`,
    [channel.id, channel.id, channel.guildId, guildOwnerId, PERMISSIONS.ADMINISTRATOR, PERMISSIONS.ADMINISTRATOR]
  );
  return rows.map((row) => row.userId);
}

export async function getChannel(channelId) {
  const rows = await query('SELECT * FROM guildChannel WHERE id = ? LIMIT 1', [channelId]);
  return rows[0] || null;
}

// ---------------------------------------------------------------------
// Serveurs
// ---------------------------------------------------------------------

export async function createGuild(ownerId, name, description) {
  const guildInsert = await query('INSERT INTO guild (name, description, ownerId) VALUES (?, ?, ?)', [
    name,
    description || null,
    ownerId
  ]);
  const guildId = guildInsert.insertId;

  await query('INSERT INTO guildMember (guildId, userId) VALUES (?, ?)', [guildId, ownerId]);
  await query(
    `INSERT INTO guildRole (guildId, name, color, position, permissions, isDefault)
     VALUES (?, '@everyone', '#99AAB5', 0, ?, 1)`,
    [guildId, DEFAULT_EVERYONE_PERMISSIONS]
  );

  const textCategory = await query('INSERT INTO guildCategory (guildId, name, position) VALUES (?, ?, 0)', [
    guildId,
    'Salons textuels'
  ]);
  const voiceCategory = await query('INSERT INTO guildCategory (guildId, name, position) VALUES (?, ?, 1)', [
    guildId,
    'Salons vocaux'
  ]);
  await query(
    "INSERT INTO guildChannel (guildId, categoryId, name, type, position) VALUES (?, ?, 'general', 'text', 0)",
    [guildId, textCategory.insertId]
  );
  await query(
    "INSERT INTO guildChannel (guildId, categoryId, name, type, position) VALUES (?, ?, 'Vocal', 'voice', 0)",
    [guildId, voiceCategory.insertId]
  );

  return guildId;
}

export async function listUserGuilds(userId) {
  return query(
    `SELECT g.id, g.name, g.description, g.ownerId
     FROM guild g JOIN guildMember m ON m.guildId = g.id AND m.userId = ?
     ORDER BY m.joinedAt ASC`,
    [userId]
  );
}

// Structure du serveur visible par l'utilisateur : categories + salons
// (les salons prives auxquels il n'a pas acces sont masques).
export async function getGuildOverview(guildId, userId) {
  const context = await getMemberContext(guildId, userId);
  if (!context) return null;

  const [categories, channels] = await Promise.all([
    query('SELECT id, name, position FROM guildCategory WHERE guildId = ? ORDER BY position ASC, id ASC', [guildId]),
    query(
      `SELECT id, guildId, categoryId, name, type, topic, position, isPrivate, slowmodeSeconds
       FROM guildChannel WHERE guildId = ? ORDER BY position ASC, id ASC`,
      [guildId]
    )
  ]);

  const visibleChannels = [];
  for (const channel of channels) {
    if (await canViewChannel(context, channel, userId)) {
      visibleChannels.push({ ...channel, isPrivate: Boolean(channel.isPrivate) });
    }
  }

  return {
    guild: context.guild,
    isOwner: context.isOwner,
    permissions: context.permissions,
    // Position du role le plus haut (valeur enorme pour le proprietaire) :
    // l'UI s'en sert pour griser les roles que l'on ne peut pas gerer.
    topPosition: context.isOwner ? 1000000000 : context.topPosition,
    categories,
    channels: visibleChannels
  };
}

// ---------------------------------------------------------------------
// Categories et salons
// ---------------------------------------------------------------------

async function nextPosition(table, whereSql, params) {
  const rows = await query(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM ${table} WHERE ${whereSql}`, params);
  return rows[0].next;
}

export async function createCategory(guildId, name) {
  const position = await nextPosition('guildCategory', 'guildId = ?', [guildId]);
  const result = await query('INSERT INTO guildCategory (guildId, name, position) VALUES (?, ?, ?)', [
    guildId,
    name,
    position
  ]);
  return { id: result.insertId, name, position };
}

export async function updateCategory(guildId, categoryId, name) {
  const result = await query('UPDATE guildCategory SET name = ? WHERE id = ? AND guildId = ?', [name, categoryId, guildId]);
  return result.affectedRows > 0;
}

export async function deleteCategory(guildId, categoryId) {
  // Les salons de la categorie sont conserves (categoryId -> NULL).
  const result = await query('DELETE FROM guildCategory WHERE id = ? AND guildId = ?', [categoryId, guildId]);
  return result.affectedRows > 0;
}

export async function createChannel(guildId, { name, type, categoryId, topic, isPrivate, roleIds, userIds }) {
  if (categoryId) {
    const cat = await query('SELECT id FROM guildCategory WHERE id = ? AND guildId = ?', [categoryId, guildId]);
    if (cat.length === 0) return { error: 'Categorie introuvable' };
  }
  const position = await nextPosition('guildChannel', 'guildId = ? AND categoryId <=> ?', [guildId, categoryId || null]);
  const result = await query(
    'INSERT INTO guildChannel (guildId, categoryId, name, type, topic, position, isPrivate) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [guildId, categoryId || null, name, type, topic || null, position, isPrivate ? 1 : 0]
  );
  const channelId = result.insertId;
  if (isPrivate) await setChannelAccess(guildId, channelId, roleIds || [], userIds || []);
  return { channel: await getChannel(channelId) };
}

// Remplace la liste des roles et membres autorises d'un salon prive.
// Seuls les ids appartenant bien au serveur sont retenus.
export async function setChannelAccess(guildId, channelId, roleIds, userIds) {
  await query('DELETE FROM guildChannelRole WHERE channelId = ?', [channelId]);
  await query('DELETE FROM guildChannelMember WHERE channelId = ?', [channelId]);

  if (roleIds.length > 0) {
    const valid = await query(
      `SELECT id FROM guildRole WHERE guildId = ? AND isDefault = 0 AND id IN (${roleIds.map(() => '?').join(',')})`,
      [guildId, ...roleIds]
    );
    for (const row of valid) await query('INSERT INTO guildChannelRole (channelId, roleId) VALUES (?, ?)', [channelId, row.id]);
  }
  if (userIds.length > 0) {
    const valid = await query(
      `SELECT userId FROM guildMember WHERE guildId = ? AND userId IN (${userIds.map(() => '?').join(',')})`,
      [guildId, ...userIds]
    );
    for (const row of valid) {
      await query('INSERT INTO guildChannelMember (channelId, userId) VALUES (?, ?)', [channelId, row.userId]);
    }
  }
}

export async function getChannelAccess(channelId) {
  const [roles, users] = await Promise.all([
    query('SELECT roleId FROM guildChannelRole WHERE channelId = ?', [channelId]),
    query('SELECT userId FROM guildChannelMember WHERE channelId = ?', [channelId])
  ]);
  return { roleIds: roles.map((row) => row.roleId), userIds: users.map((row) => row.userId) };
}

export async function updateChannel(channel, changes) {
  const fields = [];
  const params = [];
  if (changes.name !== undefined) {
    fields.push('name = ?');
    params.push(changes.name);
  }
  if (changes.topic !== undefined) {
    fields.push('topic = ?');
    params.push(changes.topic || null);
  }
  if (changes.categoryId !== undefined) {
    fields.push('categoryId = ?');
    params.push(changes.categoryId || null);
  }
  if (changes.isPrivate !== undefined) {
    fields.push('isPrivate = ?');
    params.push(changes.isPrivate ? 1 : 0);
  }
  if (fields.length > 0) {
    await query(`UPDATE guildChannel SET ${fields.join(', ')} WHERE id = ?`, [...params, channel.id]);
  }
  if (changes.roleIds !== undefined || changes.userIds !== undefined) {
    const current = await getChannelAccess(channel.id);
    await setChannelAccess(channel.guildId, channel.id, changes.roleIds ?? current.roleIds, changes.userIds ?? current.userIds);
  }
  return getChannel(channel.id);
}

export async function deleteChannel(channelId) {
  await query('DELETE FROM guildChannel WHERE id = ?', [channelId]);
}

export async function setSlowmode(channelId, seconds) {
  await query('UPDATE guildChannel SET slowmodeSeconds = ? WHERE id = ?', [seconds, channelId]);
}

// ---------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------

function formatMessage(row) {
  const [user] = withAvatarUrl([{ id: row.senderId, firstName: row.firstName, lastName: row.lastName, avatarId: row.avatarId, verified: row.verified }]);
  return {
    id: row.id,
    channelId: row.channelId,
    guildId: row.guildId,
    content: row.content,
    type: row.type || 'text',
    fileUrl: row.mediaId ? mediaUrl(row.mediaId) : null,
    fileName: row.fileName || null,
    createdAt: row.createdAt,
    sender: user
  };
}

const MESSAGE_SELECT = `
  SELECT m.id, m.channelId, m.guildId, m.senderId, m.content, m.type, m.mediaId, m.fileName, m.createdAt,
         u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified
  FROM guildMessage m JOIN user u ON u.id = m.senderId`;

export async function listMessages(channelId, beforeId) {
  const rows = await query(
    `${MESSAGE_SELECT}
     WHERE m.channelId = ? AND m.deletedAt IS NULL ${beforeId ? 'AND m.id < ?' : ''}
     ORDER BY m.id DESC LIMIT ${MESSAGE_PAGE_SIZE}`,
    beforeId ? [channelId, beforeId] : [channelId]
  );
  return { messages: rows.reverse().map(formatMessage), hasMore: rows.length === MESSAGE_PAGE_SIZE };
}

// Secondes restantes avant que l'utilisateur puisse reposter (mode lent).
export async function getSlowmodeRemaining(channel, userId) {
  if (!channel.slowmodeSeconds) return 0;
  const rows = await query(
    `SELECT GREATEST(0, ? - TIMESTAMPDIFF(SECOND, MAX(createdAt), NOW())) AS remaining
     FROM guildMessage WHERE channelId = ? AND senderId = ? AND deletedAt IS NULL`,
    [channel.slowmodeSeconds, channel.id, userId]
  );
  return Number(rows[0]?.remaining || 0);
}

export async function createMessage(channel, senderId, content, media) {
  const result = await query(
    'INSERT INTO guildMessage (guildId, channelId, senderId, content, type, mediaId, fileName) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      channel.guildId,
      channel.id,
      senderId,
      content || '',
      media ? media.type : 'text',
      media ? media.mediaId : null,
      media ? media.fileName : null
    ]
  );
  const rows = await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [result.insertId]);
  return formatMessage(rows[0]);
}

// Cibles de mention possibles (@membre / @role) pour un serveur donne.
export async function getMentionCandidates(guildId) {
  const [members, roles] = await Promise.all([
    query('SELECT u.id, u.firstName, u.lastName FROM user u JOIN guildMember m ON m.userId = u.id WHERE m.guildId = ?', [guildId]),
    listRoles(guildId)
  ]);
  return buildMentionCandidates(members, roles);
}

export { extractMentionedIds };

// Notifie (et cree une notification pour) chaque membre mentionne dans le
// message qui peut effectivement voir le salon (respecte les salons
// prives) et qui n'est pas l'auteur du message.
// Notifie (et cree une notification pour) chaque membre mentionne dans le
// message (directement, ou via un role mentionne) qui peut effectivement
// voir le salon (respecte les salons prives) et qui n'est pas l'auteur.
export async function notifyMentions(channel, message, mentioned) {
  const userIds = new Set(mentioned.userIds);
  if (mentioned.roleIds.size > 0) {
    const roleIdList = [...mentioned.roleIds];
    const rows = await query(
      `SELECT DISTINCT userId FROM guildMemberRole WHERE guildId = ? AND roleId IN (${roleIdList.map(() => '?').join(',')})`,
      [channel.guildId, ...roleIdList]
    );
    rows.forEach((row) => userIds.add(row.userId));
  }
  if (userIds.size === 0) return;

  for (const userId of userIds) {
    if (userId === message.sender.id) continue;
    // canViewChannel ne verifie que les roles/membres explicitement
    // autorises pour un salon prive ; un membre mentionne mais sans acces
    // explicite ne sera pas notifie, ce qui reste sur.
    const memberContext = await getMemberContext(channel.guildId, userId);
    if (!memberContext) continue;
    if (channel.isPrivate && !(await canViewChannel(memberContext, channel, userId))) continue;

    await createNotification({
      userId,
      actorId: message.sender.id,
      type: 'mention',
      targetType: 'guildMessage',
      targetId: message.id,
      content: JSON.stringify({ guildId: channel.guildId, channelName: channel.name })
    });
  }
}

export async function deleteMessage(messageId) {
  await query('UPDATE guildMessage SET deletedAt = NOW() WHERE id = ?', [messageId]);
}

export async function getMessage(messageId) {
  const rows = await query('SELECT id, guildId, channelId, senderId FROM guildMessage WHERE id = ? AND deletedAt IS NULL', [
    messageId
  ]);
  return rows[0] || null;
}

// ---------------------------------------------------------------------
// Membres
// ---------------------------------------------------------------------

// Liste des membres avec leurs roles, tries par role le plus haut puis par
// nom. `search` filtre par nom (insensible a la casse).
export async function listMembers(guildId, search) {
  const members = await query(
    `SELECT u.id, u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified, m.joinedAt, g.ownerId
     FROM guildMember m JOIN user u ON u.id = m.userId JOIN guild g ON g.id = m.guildId
     WHERE m.guildId = ?`,
    [guildId]
  );
  const memberRoles = await query(
    `SELECT mr.userId, r.id, r.name, r.color, r.position
     FROM guildMemberRole mr JOIN guildRole r ON r.id = mr.roleId WHERE mr.guildId = ?`,
    [guildId]
  );

  const rolesByUser = new Map();
  memberRoles.forEach((row) => {
    if (!rolesByUser.has(row.userId)) rolesByUser.set(row.userId, []);
    rolesByUser.get(row.userId).push({ id: row.id, name: row.name, color: row.color, position: row.position });
  });

  const term = (search || '').trim().toLowerCase();
  const result = withAvatarUrl(members)
    .filter((member) => !term || `${member.firstName} ${member.lastName}`.toLowerCase().includes(term))
    .map((member) => {
      const roles = (rolesByUser.get(member.id) || []).sort((a, b) => b.position - a.position);
      return { ...member, isOwner: member.id === member.ownerId, roles, topRole: roles[0] || null };
    });

  result.sort((a, b) => {
    const posA = a.isOwner ? Infinity : a.topRole ? a.topRole.position : -1;
    const posB = b.isOwner ? Infinity : b.topRole ? b.topRole.position : -1;
    if (posA !== posB) return posB - posA;
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  });
  return result;
}

// ---------------------------------------------------------------------
// Invitations et depart
// ---------------------------------------------------------------------

export async function createInvite(guildId, userId) {
  const code = crypto.randomBytes(8).toString('base64url').slice(0, 10);
  await query(
    `INSERT INTO guildInvite (code, guildId, createdBy, expiresAt) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [code, guildId, userId]
  );
  return code;
}

// Renvoie { guildId } ou { error }.
export async function joinWithInvite(userId, code) {
  const rows = await query(
    `SELECT code, guildId, maxUses, uses FROM guildInvite
     WHERE code = ? AND (expiresAt IS NULL OR expiresAt > NOW()) LIMIT 1`,
    [code]
  );
  if (rows.length === 0) return { error: 'Invitation invalide ou expiree' };
  const invite = rows[0];
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return { error: 'Invitation invalide ou expiree' };

  const existing = await query('SELECT 1 FROM guildMember WHERE guildId = ? AND userId = ?', [invite.guildId, userId]);
  if (existing.length === 0) {
    await query('INSERT INTO guildMember (guildId, userId) VALUES (?, ?)', [invite.guildId, userId]);
    await query('UPDATE guildInvite SET uses = uses + 1 WHERE code = ?', [code]);
  }
  return { guildId: invite.guildId, alreadyMember: existing.length > 0 };
}

export async function removeMember(guildId, userId) {
  await query('DELETE FROM guildMemberRole WHERE guildId = ? AND userId = ?', [guildId, userId]);
  await query('DELETE FROM guildChannelMember WHERE userId = ? AND channelId IN (SELECT id FROM guildChannel WHERE guildId = ?)', [
    userId,
    guildId
  ]);
  await query('DELETE FROM guildMember WHERE guildId = ? AND userId = ?', [guildId, userId]);
}

export async function deleteGuild(guildId) {
  await query('DELETE FROM guild WHERE id = ?', [guildId]);
}

// ---------------------------------------------------------------------
// Temps reel
// ---------------------------------------------------------------------

// Notifie les clients d'un serveur (structure modifiee, nouveau membre...).
export function emitToGuild(guildId, event, payload) {
  if (global.io) global.io.to(`guild:${guildId}`).emit(event, payload);
}

// Emet un evenement de salon : a toute la salle du serveur pour un salon
// public, uniquement aux membres autorises pour un salon prive.
export async function emitToChannel(channel, event, payload) {
  if (!global.io) return;
  if (!channel.isPrivate) {
    global.io.to(`guild:${channel.guildId}`).emit(event, payload);
    return;
  }
  const guild = await query('SELECT ownerId FROM guild WHERE id = ?', [channel.guildId]);
  const viewerIds = await getChannelViewerIds(channel, guild[0]?.ownerId);
  viewerIds.forEach((id) => global.io.to(`user:${id}`).emit(event, payload));
}

// ---------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------
// Regles de hierarchie (comme Discord) : un membre ne peut modifier,
// supprimer, deplacer ou attribuer que des roles STRICTEMENT plus bas que
// son propre role le plus haut (le proprietaire n'a aucune limite), et ne
// peut accorder que des permissions qu'il possede lui-meme.

export const MAX_ROLES_PER_GUILD = 50;

export async function listRoles(guildId) {
  const rows = await query(
    `SELECT r.id, r.name, r.color, r.position, r.permissions, r.isDefault,
            (SELECT COUNT(*) FROM guildMemberRole mr WHERE mr.roleId = r.id) AS memberCount
     FROM guildRole r WHERE r.guildId = ? ORDER BY r.isDefault ASC, r.position DESC, r.id ASC`,
    [guildId]
  );
  return rows.map((row) => ({
    ...row,
    permissions: Number(row.permissions),
    isDefault: Boolean(row.isDefault),
    memberCount: Number(row.memberCount)
  }));
}

export async function getRole(guildId, roleId) {
  const rows = await query('SELECT * FROM guildRole WHERE id = ? AND guildId = ? LIMIT 1', [roleId, guildId]);
  return rows[0] ? { ...rows[0], permissions: Number(rows[0].permissions), isDefault: Boolean(rows[0].isDefault) } : null;
}

// Un role est gerable si le membre est proprietaire ou si le role est plus
// bas que son role le plus haut. @everyone n'est jamais deplace/supprime.
export function canManageRole(context, role) {
  if (!can(context, PERMISSIONS.MANAGE_ROLES)) return false;
  if (context.isOwner) return true;
  if (role.isDefault) return false;
  return role.position < context.topPosition;
}

// Verifie que `context` a le droit d'accorder/retirer les bits modifies.
export function canGrantPermissions(context, oldMask, newMask) {
  const changed = (oldMask ^ newMask) >>> 0;
  return Object.values(PERMISSIONS).every((bit) => !(changed & bit) || hasPermission(context.permissions, bit));
}

export function sanitizePermissions(value) {
  const mask = Number(value);
  if (!Number.isInteger(mask) || mask < 0) return 0;
  return mask & ALL_PERMISSIONS;
}

export async function createRole(guildId, { name, color, permissions }) {
  // Le nouveau role se place tout en bas (au-dessus de @everyone) : il est
  // donc toujours plus bas que le role de celui qui le cree.
  await query('UPDATE guildRole SET position = position + 1 WHERE guildId = ? AND isDefault = 0', [guildId]);
  const result = await query(
    'INSERT INTO guildRole (guildId, name, color, position, permissions, isDefault) VALUES (?, ?, ?, 1, ?, 0)',
    [guildId, name, color, permissions]
  );
  return getRole(guildId, result.insertId);
}

export async function updateRole(roleId, { name, color, permissions }) {
  const fields = [];
  const params = [];
  if (name !== undefined) {
    fields.push('name = ?');
    params.push(name);
  }
  if (color !== undefined) {
    fields.push('color = ?');
    params.push(color);
  }
  if (permissions !== undefined) {
    fields.push('permissions = ?');
    params.push(permissions);
  }
  if (fields.length > 0) await query(`UPDATE guildRole SET ${fields.join(', ')} WHERE id = ?`, [...params, roleId]);
}

export async function deleteRole(roleId) {
  await query('DELETE FROM guildRole WHERE id = ?', [roleId]);
}

// Deplace un role d'un cran ('up' = plus haut). Renvoie false si le
// deplacement est impossible ou interdit par la hierarchie.
export async function moveRole(guildId, context, roleId, direction) {
  const roles = (await listRoles(guildId)).filter((role) => !role.isDefault); // du plus haut au plus bas
  const index = roles.findIndex((role) => role.id === roleId);
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= roles.length) return false;
  if (!context.isOwner && roles[swapIndex].position >= context.topPosition) return false;

  [roles[index], roles[swapIndex]] = [roles[swapIndex], roles[index]];
  // Renumerotation dense : le premier de la liste a la plus grande position.
  for (let i = 0; i < roles.length; i += 1) {
    await query('UPDATE guildRole SET position = ? WHERE id = ?', [roles.length - i, roles[i].id]);
  }
  return true;
}

// ---------------------------------------------------------------------
// Roles d'un membre / expulsion
// ---------------------------------------------------------------------

export async function getMemberRoleIds(guildId, userId) {
  const rows = await query('SELECT roleId FROM guildMemberRole WHERE guildId = ? AND userId = ?', [guildId, userId]);
  return rows.map((row) => row.roleId);
}

// Remplace les roles (hors @everyone) d'un membre. Renvoie { error } si la
// hierarchie l'interdit.
export async function setMemberRoles(guildId, actorContext, targetContext, roleIds) {
  const allRoles = await listRoles(guildId);
  const assignable = new Map(allRoles.filter((role) => !role.isDefault).map((role) => [role.id, role]));
  const wanted = [...new Set(roleIds)].filter((id) => assignable.has(id));
  const current = await getMemberRoleIds(guildId, targetContext.userId);

  const changed = [...wanted.filter((id) => !current.includes(id)), ...current.filter((id) => !wanted.includes(id))];
  for (const id of changed) {
    const role = assignable.get(id);
    if (role && !canManageRole(actorContext, role)) {
      return { error: `Vous ne pouvez pas modifier le role "${role.name}" (hierarchie)` };
    }
  }

  for (const id of current.filter((roleId) => !wanted.includes(roleId))) {
    await query('DELETE FROM guildMemberRole WHERE guildId = ? AND userId = ? AND roleId = ?', [guildId, targetContext.userId, id]);
  }
  for (const id of wanted.filter((roleId) => !current.includes(roleId))) {
    await query('INSERT INTO guildMemberRole (guildId, userId, roleId) VALUES (?, ?, ?)', [guildId, targetContext.userId, id]);
  }
  return { roleIds: wanted };
}
