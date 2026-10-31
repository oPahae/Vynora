import { query } from './db';
import { mediaUrl } from './upload';

export const GROUP_ROLES = ['owner', 'admin', 'member'];
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;

function formatGroup(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    avatar: mediaUrl(row.avatarMediaId),
    cover: mediaUrl(row.coverMediaId),
    ownerId: row.ownerId,
    memberCount: row.memberCount !== undefined ? Number(row.memberCount) : undefined,
    createdAt: row.createdAt
  };
}

export async function createGroup(userId, { name, description, visibility, avatarMediaId, coverMediaId }) {
  const cleanName = (name || '').trim().slice(0, MAX_NAME_LENGTH);
  if (!cleanName) return { success: false, message: 'Le nom du groupe est requis' };
  if (!['public', 'private'].includes(visibility)) {
    return { success: false, message: 'Visibilite invalide' };
  }

  const result = await query(
    'INSERT INTO communityGroup (name, description, visibility, avatarMediaId, coverMediaId, ownerId) VALUES (?, ?, ?, ?, ?, ?)',
    [cleanName, (description || '').trim().slice(0, MAX_DESCRIPTION_LENGTH) || null, visibility, avatarMediaId || null, coverMediaId || null, userId]
  );
  const groupId = result.insertId;

  await query('INSERT INTO communityGroupMember (groupId, userId, role, status) VALUES (?, ?, ?, ?)', [
    groupId,
    userId,
    'owner',
    'active'
  ]);

  return { success: true, groupId };
}

export async function getGroupById(groupId) {
  const rows = await query(
    `SELECT g.*, (SELECT COUNT(*) FROM communityGroupMember m WHERE m.groupId = g.id AND m.status = 'active') as memberCount
     FROM communityGroup g WHERE g.id = ? LIMIT 1`,
    [groupId]
  );
  return formatGroup(rows[0]);
}

export async function getMembership(groupId, userId) {
  const rows = await query('SELECT role, status FROM communityGroupMember WHERE groupId = ? AND userId = ? LIMIT 1', [
    groupId,
    userId
  ]);
  return rows[0] || null;
}

export async function isActiveMember(groupId, userId) {
  const membership = await getMembership(groupId, userId);
  return Boolean(membership && membership.status === 'active');
}

export async function isAdminOrOwner(groupId, userId) {
  const membership = await getMembership(groupId, userId);
  return Boolean(membership && membership.status === 'active' && ['owner', 'admin'].includes(membership.role));
}

// Regle de visibilite d'un groupe et de son contenu (membres, publications) :
// - Un groupe public est visible par tous les utilisateurs authentifies.
// - Un groupe prive n'est visible en detail (membres, publications) que par
//   ses membres actifs ; les autres n'en voient que le nom/la description
//   de base (pour decider de demander a le rejoindre), jamais son contenu.
export async function canViewGroupContent(viewerId, groupId, groupVisibility = null) {
  const visibility = groupVisibility || (await query('SELECT visibility FROM communityGroup WHERE id = ? LIMIT 1', [groupId]))[0]?.visibility;
  if (visibility === 'public') return true;
  return isActiveMember(groupId, viewerId);
}

export async function joinGroup(userId, groupId) {
  const group = await getGroupById(groupId);
  if (!group) return { success: false, message: 'Groupe introuvable' };

  const existing = await getMembership(groupId, userId);
  if (existing) {
    if (existing.status === 'active') return { success: true, status: 'active' };
    if (existing.status === 'pending') return { success: true, status: 'pending' };
    if (existing.status === 'invited') {
      // On avait invite cette personne : rejoindre de son propre chef
      // vaut acceptation directe de l'invitation.
      await query("UPDATE communityGroupMember SET status = 'active' WHERE groupId = ? AND userId = ?", [
        groupId,
        userId
      ]);
      return { success: true, status: 'active' };
    }
  }

  const status = group.visibility === 'public' ? 'active' : 'pending';
  await query('INSERT INTO communityGroupMember (groupId, userId, role, status) VALUES (?, ?, ?, ?)', [
    groupId,
    userId,
    'member',
    status
  ]);

  return { success: true, status };
}

// Un admin/owner invite une personne dans le groupe (y compris un groupe
// prive, et meme si elle n'est pas amie avec l'invitant) : elle passe au
// statut 'invited' et doit accepter ou refuser elle-meme (voir
// acceptInvite / declineInvite) avant de devenir membre actif.
export async function inviteMember(groupId, actingUserId, targetUserId) {
  const isAllowed = await isAdminOrOwner(groupId, actingUserId);
  if (!isAllowed) return { success: false, message: "Action reservee aux administrateurs du groupe" };

  const group = await getGroupById(groupId);
  if (!group) return { success: false, message: 'Groupe introuvable' };

  const existing = await getMembership(groupId, targetUserId);
  if (existing && existing.status === 'active') {
    return { success: false, message: 'Cette personne est deja membre du groupe' };
  }
  if (existing && existing.status === 'invited') {
    return { success: false, message: 'Cette personne a deja ete invitee' };
  }

  if (existing) {
    // Elle avait deja une demande d'adhesion ('pending') en attente : on
    // la transforme en invitation, qu'elle doit toujours accepter.
    await query("UPDATE communityGroupMember SET status = 'invited', role = 'member' WHERE groupId = ? AND userId = ?", [
      groupId,
      targetUserId
    ]);
  } else {
    await query('INSERT INTO communityGroupMember (groupId, userId, role, status) VALUES (?, ?, ?, ?)', [
      groupId,
      targetUserId,
      'member',
      'invited'
    ]);
  }

  return { success: true, group };
}

// L'utilisateur invite accepte l'invitation : il devient membre actif.
export async function acceptGroupInvite(groupId, userId) {
  const membership = await getMembership(groupId, userId);
  if (!membership || membership.status !== 'invited') {
    return { success: false, message: 'Aucune invitation en attente pour ce groupe' };
  }
  await query("UPDATE communityGroupMember SET status = 'active' WHERE groupId = ? AND userId = ?", [groupId, userId]);
  return { success: true };
}

// L'utilisateur invite refuse l'invitation : elle est simplement supprimee.
export async function declineGroupInvite(groupId, userId) {
  const membership = await getMembership(groupId, userId);
  if (!membership || membership.status !== 'invited') {
    return { success: false, message: 'Aucune invitation en attente pour ce groupe' };
  }
  await query("DELETE FROM communityGroupMember WHERE groupId = ? AND userId = ? AND status = 'invited'", [
    groupId,
    userId
  ]);
  return { success: true };
}

// Liste des invitations de groupe en attente pour un utilisateur (toutes
// groupes confondus), utilisee par l'onglet "Invitations" de la page
// Groupes.
export async function listMyGroupInvitations(userId, offset, limit) {
  const rows = await query(
    `SELECT g.*, (SELECT COUNT(*) FROM communityGroupMember m2 WHERE m2.groupId = g.id AND m2.status = 'active') as memberCount
     FROM communityGroup g
     JOIN communityGroupMember m ON m.groupId = g.id
     WHERE m.userId = ? AND m.status = 'invited'
     ORDER BY m.joinedAt DESC
     LIMIT ? OFFSET ?`,
    [userId, limit + 1, offset]
  );
  const hasMore = rows.length > limit;
  return { groups: rows.slice(0, limit).map(formatGroup), hasMore };
}

export async function leaveGroup(userId, groupId) {
  const membership = await getMembership(groupId, userId);
  if (!membership) return { success: false, message: "Vous n'etes pas membre de ce groupe" };
  if (membership.role === 'owner') {
    return {
      success: false,
      message: 'Le proprietaire ne peut pas quitter le groupe. Supprimez le groupe si vous souhaitez y mettre fin.'
    };
  }

  await query('DELETE FROM communityGroupMember WHERE groupId = ? AND userId = ?', [groupId, userId]);
  return { success: true };
}

export async function getGroupMembers(groupId, status = 'active') {
  const rows = await query(
    `SELECT u.id, u.firstName, u.lastName, u.avatarId, ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS verified, m.role, m.joinedAt
     FROM communityGroupMember m
     JOIN user u ON u.id = m.userId
     WHERE m.groupId = ? AND m.status = ?
     ORDER BY FIELD(m.role, 'owner', 'admin', 'member'), m.joinedAt ASC`,
    [groupId, status]
  );
  return rows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    avatar: mediaUrl(row.avatarId),
    verified: Boolean(row.verified),
    role: row.role,
    joinedAt: row.joinedAt
  }));
}

// Reserve aux admins/owner (verification a faire par l'appelant) : liste
// des demandes d'adhesion en attente pour un groupe prive.
export async function getPendingRequests(groupId) {
  return getGroupMembers(groupId, 'pending');
}

export async function approveJoinRequest(groupId, actingUserId, targetUserId) {
  if (!(await isAdminOrOwner(groupId, actingUserId))) {
    return { success: false, message: 'Action non autorisee' };
  }
  await query("UPDATE communityGroupMember SET status = 'active' WHERE groupId = ? AND userId = ? AND status = 'pending'", [
    groupId,
    targetUserId
  ]);
  return { success: true };
}

export async function rejectJoinRequest(groupId, actingUserId, targetUserId) {
  if (!(await isAdminOrOwner(groupId, actingUserId))) {
    return { success: false, message: 'Action non autorisee' };
  }
  await query("DELETE FROM communityGroupMember WHERE groupId = ? AND userId = ? AND status = 'pending'", [
    groupId,
    targetUserId
  ]);
  return { success: true };
}

// Exclusion d'un membre. L'owner peut exclure n'importe qui (sauf
// lui-meme) ; un admin ne peut exclure que des membres simples (pas un
// autre admin, ni l'owner) - evite qu'un admin ecarte un pair.
export async function removeMember(groupId, actingUserId, targetUserId) {
  if (actingUserId === targetUserId) {
    return { success: false, message: 'Utilisez "Quitter le groupe" pour vous retirer vous-meme' };
  }

  const [actingMembership, targetMembership] = await Promise.all([
    getMembership(groupId, actingUserId),
    getMembership(groupId, targetUserId)
  ]);

  if (!actingMembership || actingMembership.status !== 'active' || !['owner', 'admin'].includes(actingMembership.role)) {
    return { success: false, message: 'Action non autorisee' };
  }
  if (!targetMembership) return { success: false, message: 'Ce membre ne fait pas partie du groupe' };
  if (targetMembership.role === 'owner') {
    return { success: false, message: 'Le proprietaire ne peut pas etre exclu' };
  }
  if (actingMembership.role === 'admin' && targetMembership.role === 'admin') {
    return { success: false, message: "Un admin ne peut pas exclure un autre admin" };
  }

  await query('DELETE FROM communityGroupMember WHERE groupId = ? AND userId = ?', [groupId, targetUserId]);
  return { success: true };
}

// Promotion/retrogradation d'un membre entre 'member' et 'admin'.
// Reservee au proprietaire (transfert de propriete non pris en charge).
export async function setMemberRole(groupId, actingUserId, targetUserId, newRole) {
  if (!['admin', 'member'].includes(newRole)) {
    return { success: false, message: 'Role invalide' };
  }
  const actingMembership = await getMembership(groupId, actingUserId);
  if (!actingMembership || actingMembership.role !== 'owner') {
    return { success: false, message: 'Seul le proprietaire peut modifier les roles' };
  }
  const targetMembership = await getMembership(groupId, targetUserId);
  if (!targetMembership || targetMembership.status !== 'active' || targetMembership.role === 'owner') {
    return { success: false, message: 'Membre invalide' };
  }

  await query('UPDATE communityGroupMember SET role = ? WHERE groupId = ? AND userId = ?', [newRole, groupId, targetUserId]);
  return { success: true };
}

export async function updateGroup(groupId, userId, { name, description, visibility, avatarMediaId, coverMediaId }) {
  if (!(await isAdminOrOwner(groupId, userId))) {
    return { success: false, message: 'Action non autorisee' };
  }
  if (visibility && !['public', 'private'].includes(visibility)) {
    return { success: false, message: 'Visibilite invalide' };
  }

  const current = await getGroupById(groupId);
  if (!current) return { success: false, message: 'Groupe introuvable' };

  await query(
    'UPDATE communityGroup SET name = ?, description = ?, visibility = ?, avatarMediaId = COALESCE(?, avatarMediaId), coverMediaId = COALESCE(?, coverMediaId) WHERE id = ?',
    [
      (name || current.name).trim().slice(0, MAX_NAME_LENGTH),
      description !== undefined ? (description || '').trim().slice(0, MAX_DESCRIPTION_LENGTH) || null : current.description,
      visibility || current.visibility,
      avatarMediaId || null,
      coverMediaId || null,
      groupId
    ]
  );
  return { success: true };
}

export async function deleteGroup(groupId, userId) {
  const membership = await getMembership(groupId, userId);
  if (!membership || membership.role !== 'owner') {
    return { success: false, message: 'Seul le proprietaire peut supprimer le groupe' };
  }
  // ON DELETE CASCADE sur communityGroupMember et post.groupId nettoie
  // automatiquement les membres et publications du groupe.
  await query('DELETE FROM communityGroup WHERE id = ?', [groupId]);
  return { success: true };
}

export async function listMyGroups(userId, offset, limit) {
  const rows = await query(
    `SELECT g.*, (SELECT COUNT(*) FROM communityGroupMember m2 WHERE m2.groupId = g.id AND m2.status = 'active') as memberCount
     FROM communityGroup g
     JOIN communityGroupMember m ON m.groupId = g.id
     WHERE m.userId = ? AND m.status = 'active'
     ORDER BY g.updatedAt DESC
     LIMIT ? OFFSET ?`,
    [userId, limit + 1, offset]
  );
  const hasMore = rows.length > limit;
  return { groups: rows.slice(0, limit).map(formatGroup), hasMore };
}

export async function discoverGroups(userId, offset, limit) {
  const rows = await query(
    `SELECT g.*, (SELECT COUNT(*) FROM communityGroupMember m2 WHERE m2.groupId = g.id AND m2.status = 'active') as memberCount
     FROM communityGroup g
     WHERE g.visibility = 'public'
       AND g.id NOT IN (SELECT groupId FROM communityGroupMember WHERE userId = ?)
     ORDER BY memberCount DESC, g.createdAt DESC
     LIMIT ? OFFSET ?`,
    [userId, limit + 1, offset]
  );
  const hasMore = rows.length > limit;
  return { groups: rows.slice(0, limit).map(formatGroup), hasMore };
}
