DROP DATABASE social_network;
CREATE DATABASE social_network CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE social_network;

CREATE TABLE media (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uploaderId INT UNSIGNED NOT NULL,
  mimetype VARCHAR(100) NOT NULL,
  data LONGBLOB NOT NULL,
  size INT UNSIGNED NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_media_uploader (uploaderId)
) ENGINE=InnoDB;

CREATE TABLE user (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  firstName VARCHAR(50) NOT NULL,
  lastName VARCHAR(50) NOT NULL,
  email VARCHAR(190) NOT NULL,
  emailVerifiedAt DATETIME DEFAULT NULL,
  deactivatedAt DATETIME DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  avatarId INT UNSIGNED DEFAULT NULL,
  coverId INT UNSIGNED DEFAULT NULL,
  avatarPostId INT UNSIGNED DEFAULT NULL,
  coverPostId INT UNSIGNED DEFAULT NULL,
  bio VARCHAR(500) DEFAULT NULL,
  work VARCHAR(150) DEFAULT NULL,
  education VARCHAR(150) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  country VARCHAR(100) DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  gender ENUM('male','female') DEFAULT NULL,
  birthDate DATE DEFAULT NULL,
  theme ENUM('light','dark') NOT NULL DEFAULT 'light',
  language VARCHAR(5) DEFAULT NULL,
  isPrivate TINYINT(1) NOT NULL DEFAULT 0,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  bannedAt DATETIME DEFAULT NULL,
  banReason VARCHAR(255) DEFAULT NULL,
  premiumUntil DATETIME DEFAULT NULL,
  socialLinks JSON DEFAULT NULL,
  musicMediaId INT UNSIGNED DEFAULT NULL,
  musicTitle VARCHAR(150) DEFAULT NULL,
  musicStartSec DECIMAL(6,2) NOT NULL DEFAULT 0,
  musicEndSec DECIMAL(6,2) DEFAULT NULL,
  lastSeenAt DATETIME DEFAULT NULL,
  showOnlineStatus TINYINT(1) NOT NULL DEFAULT 1,
  showReadReceipts TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_email (email),
  KEY idx_user_avatar (avatarId),
  KEY idx_user_cover (coverId),
  KEY idx_user_music (musicMediaId),
  CONSTRAINT fk_user_avatar FOREIGN KEY (avatarId) REFERENCES media(id) ON DELETE SET NULL,
  CONSTRAINT fk_user_cover FOREIGN KEY (coverId) REFERENCES media(id) ON DELETE SET NULL,
  CONSTRAINT fk_user_music FOREIGN KEY (musicMediaId) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE media
  ADD CONSTRAINT fk_media_uploader FOREIGN KEY (uploaderId) REFERENCES user(id) ON DELETE CASCADE;

CREATE TABLE friend (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  requesterId INT UNSIGNED NOT NULL,
  addresseeId INT UNSIGNED NOT NULL,
  status ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_friend_pair (requesterId, addresseeId),
  KEY idx_friend_addressee (addresseeId),
  CONSTRAINT fk_friend_requester FOREIGN KEY (requesterId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_friend_addressee FOREIGN KEY (addresseeId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE block (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  blockerId INT UNSIGNED NOT NULL,
  blockedId INT UNSIGNED NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_block_pair (blockerId, blockedId),
  KEY idx_block_blocked (blockedId),
  CONSTRAINT fk_block_blocker FOREIGN KEY (blockerId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_block_blocked FOREIGN KEY (blockedId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Groupes/communautes. Le nom `communityGroup` est utilise plutot que
-- `group`, mot reserve en SQL, pour eviter d'avoir a l'entourer de
-- backticks dans chaque requete du projet.
CREATE TABLE communityGroup (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  visibility ENUM('public','private') NOT NULL DEFAULT 'public',
  avatarMediaId INT UNSIGNED DEFAULT NULL,
  coverMediaId INT UNSIGNED DEFAULT NULL,
  ownerId INT UNSIGNED NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_communityGroup_owner (ownerId),
  CONSTRAINT fk_communityGroup_owner FOREIGN KEY (ownerId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_communityGroup_avatar FOREIGN KEY (avatarMediaId) REFERENCES media(id) ON DELETE SET NULL,
  CONSTRAINT fk_communityGroup_cover FOREIGN KEY (coverMediaId) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Membres d'un groupe. `status` distingue un membre actif d'une demande
-- d'adhesion en attente (groupe prive) ; `role` porte les permissions
-- (owner / admin / member).
CREATE TABLE communityGroupMember (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  groupId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  role ENUM('owner','admin','member') NOT NULL DEFAULT 'member',
  status ENUM('active','pending','invited') NOT NULL DEFAULT 'active',
  joinedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_communityGroupMember (groupId, userId),
  KEY idx_communityGroupMember_group_status (groupId, status),
  KEY idx_communityGroupMember_user (userId),
  CONSTRAINT fk_communityGroupMember_group FOREIGN KEY (groupId) REFERENCES communityGroup(id) ON DELETE CASCADE,
  CONSTRAINT fk_communityGroupMember_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE post (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  content TEXT DEFAULT NULL,
  visibility ENUM('public','friends','private','exceptFor','onlyFor') NOT NULL DEFAULT 'public',
  kind ENUM('standard','avatar','cover') NOT NULL DEFAULT 'standard',
  sharedPostId INT UNSIGNED DEFAULT NULL,
  viewsCount INT UNSIGNED NOT NULL DEFAULT 0,
  isEdited TINYINT(1) NOT NULL DEFAULT 0,
  groupId INT UNSIGNED DEFAULT NULL,
  location VARCHAR(150) DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deletedAt DATETIME DEFAULT NULL,
  KEY idx_post_user (userId),
  KEY idx_post_shared (sharedPostId),
  KEY idx_post_created (createdAt),
  KEY idx_post_group (groupId),
  CONSTRAINT fk_post_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_post_shared FOREIGN KEY (sharedPostId) REFERENCES post(id) ON DELETE SET NULL,
  CONSTRAINT fk_post_group FOREIGN KEY (groupId) REFERENCES communityGroup(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE user
  ADD KEY idx_user_avatarPost (avatarPostId),
  ADD KEY idx_user_coverPost (coverPostId),
  ADD CONSTRAINT fk_user_avatarPost FOREIGN KEY (avatarPostId) REFERENCES post(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_user_coverPost FOREIGN KEY (coverPostId) REFERENCES post(id) ON DELETE SET NULL;

CREATE TABLE postMedia (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  postId INT UNSIGNED NOT NULL,
  mediaId INT UNSIGNED NOT NULL,
  type ENUM('image','video') NOT NULL,
  position TINYINT UNSIGNED NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_postMedia_post (postId),
  KEY idx_postMedia_media (mediaId),
  CONSTRAINT fk_postMedia_post FOREIGN KEY (postId) REFERENCES post(id) ON DELETE CASCADE,
  CONSTRAINT fk_postMedia_media FOREIGN KEY (mediaId) REFERENCES media(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE postVisibilityUser (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  postId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_postVisibility (postId, userId),
  KEY idx_postVisibility_user (userId),
  CONSTRAINT fk_postVisibility_post FOREIGN KEY (postId) REFERENCES post(id) ON DELETE CASCADE,
  CONSTRAINT fk_postVisibility_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE postView (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  postId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_postView (postId, userId),
  KEY idx_postView_user (userId),
  CONSTRAINT fk_postView_post FOREIGN KEY (postId) REFERENCES post(id) ON DELETE CASCADE,
  CONSTRAINT fk_postView_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE hashtag (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hashtag_name (name)
) ENGINE=InnoDB;

CREATE TABLE postHashtag (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  postId INT UNSIGNED NOT NULL,
  hashtagId INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_postHashtag (postId, hashtagId),
  KEY idx_postHashtag_hashtag (hashtagId),
  CONSTRAINT fk_postHashtag_post FOREIGN KEY (postId) REFERENCES post(id) ON DELETE CASCADE,
  CONSTRAINT fk_postHashtag_hashtag FOREIGN KEY (hashtagId) REFERENCES hashtag(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE comment (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  postId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  parentId INT UNSIGNED DEFAULT NULL,
  content TEXT DEFAULT NULL,
  mediaType ENUM('image','video','audio') DEFAULT NULL,
  mediaId INT UNSIGNED DEFAULT NULL,
  isEdited TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deletedAt DATETIME DEFAULT NULL,
  KEY idx_comment_post (postId),
  KEY idx_comment_user (userId),
  KEY idx_comment_parent (parentId),
  KEY idx_comment_media (mediaId),
  CONSTRAINT fk_comment_post FOREIGN KEY (postId) REFERENCES post(id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_parent FOREIGN KEY (parentId) REFERENCES comment(id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_media FOREIGN KEY (mediaId) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE mention (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  postId INT UNSIGNED DEFAULT NULL,
  commentId INT UNSIGNED DEFAULT NULL,
  userId INT UNSIGNED NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_mention_post (postId),
  KEY idx_mention_comment (commentId),
  KEY idx_mention_user (userId),
  CONSTRAINT fk_mention_post FOREIGN KEY (postId) REFERENCES post(id) ON DELETE CASCADE,
  CONSTRAINT fk_mention_comment FOREIGN KEY (commentId) REFERENCES comment(id) ON DELETE CASCADE,
  CONSTRAINT fk_mention_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE reaction (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  postId INT UNSIGNED DEFAULT NULL,
  commentId INT UNSIGNED DEFAULT NULL,
  type ENUM('like','dislike','haha','wow','grr','sad') NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reaction_post (userId, postId),
  UNIQUE KEY uq_reaction_comment (userId, commentId),
  KEY idx_reaction_post (postId),
  KEY idx_reaction_comment (commentId),
  CONSTRAINT fk_reaction_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_reaction_post FOREIGN KEY (postId) REFERENCES post(id) ON DELETE CASCADE,
  CONSTRAINT fk_reaction_comment FOREIGN KEY (commentId) REFERENCES comment(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE status (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  type ENUM('text','image','video') NOT NULL,
  content TEXT DEFAULT NULL,
  mediaId INT UNSIGNED DEFAULT NULL,
  backgroundColor VARCHAR(20) DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiresAt DATETIME NOT NULL,
  KEY idx_status_user (userId),
  KEY idx_status_expires (expiresAt),
  KEY idx_status_media (mediaId),
  CONSTRAINT fk_status_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_status_media FOREIGN KEY (mediaId) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE statusView (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  statusId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_statusView (statusId, userId),
  KEY idx_statusView_user (userId),
  CONSTRAINT fk_statusView_status FOREIGN KEY (statusId) REFERENCES status(id) ON DELETE CASCADE,
  CONSTRAINT fk_statusView_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE statusReaction (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  statusId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  type ENUM('like','dislike','haha','wow','grr','sad') NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_statusReaction (statusId, userId),
  KEY idx_statusReaction_user (userId),
  CONSTRAINT fk_statusReaction_status FOREIGN KEY (statusId) REFERENCES status(id) ON DELETE CASCADE,
  CONSTRAINT fk_statusReaction_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE conversation (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  isGroup TINYINT(1) NOT NULL DEFAULT 0,
  name VARCHAR(150) DEFAULT NULL,
  avatarId INT UNSIGNED DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_conversation_avatar (avatarId),
  CONSTRAINT fk_conversation_avatar FOREIGN KEY (avatarId) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- If you already have an existing database created before this column was
-- added, run this once to upgrade it:
--   ALTER TABLE conversationParticipant ADD COLUMN archivedAt DATETIME DEFAULT NULL;

CREATE TABLE conversationParticipant (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversationId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  lastReadMessageId INT UNSIGNED DEFAULT NULL,
  joinedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  leftAt DATETIME DEFAULT NULL,
  archivedAt DATETIME DEFAULT NULL,
  clearedAt DATETIME DEFAULT NULL,
  UNIQUE KEY uq_conversationParticipant (conversationId, userId),
  KEY idx_conversationParticipant_user (userId),
  CONSTRAINT fk_conversationParticipant_conversation FOREIGN KEY (conversationId) REFERENCES conversation(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversationParticipant_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE message (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversationId INT UNSIGNED NOT NULL,
  senderId INT UNSIGNED NOT NULL,
  content TEXT DEFAULT NULL,
  type ENUM('text','image','video','audio','file') NOT NULL DEFAULT 'text',
  mediaId INT UNSIGNED DEFAULT NULL,
  fileName VARCHAR(255) DEFAULT NULL,
  replyToId INT UNSIGNED DEFAULT NULL,
  isEdited TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deletedForEveryone TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_message_conversation (conversationId),
  KEY idx_message_sender (senderId),
  KEY idx_message_replyTo (replyToId),
  KEY idx_message_media (mediaId),
  CONSTRAINT fk_message_conversation FOREIGN KEY (conversationId) REFERENCES conversation(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_sender FOREIGN KEY (senderId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_replyTo FOREIGN KEY (replyToId) REFERENCES message(id) ON DELETE SET NULL,
  CONSTRAINT fk_message_media FOREIGN KEY (mediaId) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE messageDeletion (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  messageId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  deletedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_messageDeletion (messageId, userId),
  KEY idx_messageDeletion_user (userId),
  CONSTRAINT fk_messageDeletion_message FOREIGN KEY (messageId) REFERENCES message(id) ON DELETE CASCADE,
  CONSTRAINT fk_messageDeletion_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE messageSeen (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  messageId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  seenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_messageSeen (messageId, userId),
  KEY idx_messageSeen_user (userId),
  CONSTRAINT fk_messageSeen_message FOREIGN KEY (messageId) REFERENCES message(id) ON DELETE CASCADE,
  CONSTRAINT fk_messageSeen_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE messageFavorite (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  messageId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_messageFavorite (messageId, userId),
  KEY idx_messageFavorite_user (userId),
  CONSTRAINT fk_messageFavorite_message FOREIGN KEY (messageId) REFERENCES message(id) ON DELETE CASCADE,
  CONSTRAINT fk_messageFavorite_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notification (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  actorId INT UNSIGNED NOT NULL,
  type ENUM('message','comment','reply','mention','like','share','status','friendRequest','friendAccept','groupInvite','groupRemoved','groupRoleChange','moderation','loginAlert','premiumPurchase','premiumWelcome') NOT NULL,
  targetType ENUM('post','comment','message','status','user','group','guildMessage','reel','reelComment') DEFAULT NULL,
  targetId INT UNSIGNED DEFAULT NULL,
  content VARCHAR(255) DEFAULT NULL,
  isRead TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notification_user (userId),
  KEY idx_notification_actor (actorId),
  KEY idx_notification_created (createdAt),
  CONSTRAINT fk_notification_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_actor FOREIGN KEY (actorId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE passwordReset (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  codeHash CHAR(64) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expiresAt DATETIME NOT NULL,
  usedAt DATETIME DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_passwordReset_user (userId, usedAt),
  KEY idx_passwordReset_expires (expiresAt),
  CONSTRAINT fk_passwordReset_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Verification d'adresse email par code a 6 chiffres, a l'inscription
-- (purpose = 'register', userId encore NULL car le compte n'existe pas
-- encore) et lors d'un changement d'email depuis les parametres du compte
-- (purpose = 'change_email').
CREATE TABLE emailVerification (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purpose ENUM('register', 'change_email') NOT NULL,
  userId INT UNSIGNED DEFAULT NULL,
  email VARCHAR(190) NOT NULL,
  codeHash CHAR(64) NOT NULL,
  payload TEXT DEFAULT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expiresAt DATETIME NOT NULL,
  usedAt DATETIME DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_emailVerification_lookup (purpose, email, usedAt),
  KEY idx_emailVerification_expires (expiresAt),
  CONSTRAINT fk_emailVerification_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Statut personnalise (distinct de la presence online/offline gerée par
-- Socket.IO et distinct des stories de la table `status`).
CREATE TABLE presenceStatus (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  emoji VARCHAR(16) DEFAULT NULL,
  label VARCHAR(80) NOT NULL,
  expiresAt DATETIME DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_presenceStatus_user (userId),
  CONSTRAINT fk_presenceStatus_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Publications enregistrees ("bookmarks").
CREATE TABLE savedPost (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  postId INT UNSIGNED NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_savedPost (userId, postId),
  KEY idx_savedPost_post (postId),
  KEY idx_savedPost_user_created (userId, createdAt),
  CONSTRAINT fk_savedPost_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_savedPost_post FOREIGN KEY (postId) REFERENCES post(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Publications epinglees sur le profil (limite applicative : 3 par utilisateur).
CREATE TABLE pinnedPost (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  postId INT UNSIGNED NOT NULL,
  position TINYINT UNSIGNED NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pinnedPost (userId, postId),
  KEY idx_pinnedPost_user_position (userId, position),
  CONSTRAINT fk_pinnedPost_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_pinnedPost_post FOREIGN KEY (postId) REFERENCES post(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Brouillons de publication.
CREATE TABLE postDraft (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  content TEXT DEFAULT NULL,
  visibility ENUM('public','friends','private','exceptFor','onlyFor') NOT NULL DEFAULT 'public',
  visibilityUserIds JSON DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_postDraft_user_updated (userId, updatedAt),
  CONSTRAINT fk_postDraft_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Medias attaches a un brouillon (reutilise la table `media` existante,
-- meme principe que `postMedia`).
CREATE TABLE draftMedia (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  draftId INT UNSIGNED NOT NULL,
  mediaId INT UNSIGNED NOT NULL,
  type ENUM('image','video') NOT NULL,
  position TINYINT UNSIGNED NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_draftMedia_draft (draftId),
  KEY idx_draftMedia_media (mediaId),
  CONSTRAINT fk_draftMedia_draft FOREIGN KEY (draftId) REFERENCES postDraft(id) ON DELETE CASCADE,
  CONSTRAINT fk_draftMedia_media FOREIGN KEY (mediaId) REFERENCES media(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Historique des recherches globales (recherches recentes + suppression).
CREATE TABLE searchHistory (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  queryText VARCHAR(150) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_searchHistory_user_created (userId, createdAt),
  CONSTRAINT fk_searchHistory_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Abonnements aux notifications push (Web Push).
CREATE TABLE pushSubscription (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  userAgent VARCHAR(255) DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pushSubscription_endpoint (endpoint(255)),
  KEY idx_pushSubscription_user (userId),
  CONSTRAINT fk_pushSubscription_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_reaction_post_type ON reaction (postId, type);
CREATE INDEX idx_user_names_search ON user (firstName, lastName);
CREATE INDEX idx_reaction_comment_type ON reaction (commentId, type);
CREATE INDEX idx_comment_post_deleted ON comment (postId, deletedAt);
CREATE INDEX idx_comment_parent_deleted ON comment (parentId, deletedAt);
CREATE INDEX idx_post_shared_deleted ON post (sharedPostId, deletedAt);
CREATE INDEX idx_post_user_deleted_created ON post (userId, deletedAt, createdAt);
CREATE INDEX idx_notification_user_read ON notification (userId, isRead);
CREATE INDEX idx_message_conversation_created ON message (conversationId, createdAt);
CREATE INDEX idx_status_reaction_status_type ON statusReaction (statusId, type);

-- =====================================================================
-- SERVEURS (communautes façon Discord)
-- =====================================================================
-- Tables prefixees `guild` pour ne pas les confondre avec les "groupes"
-- existants (groupes de publications / conversations de groupe).
-- Les permissions d'un role sont un masque de bits (voir
-- lib/guildPermissions.js). Le proprietaire (guild.ownerId) a
-- implicitement toutes les permissions.

CREATE TABLE guild (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(300) DEFAULT NULL,
  ownerId INT UNSIGNED NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_guild_owner (ownerId),
  CONSTRAINT fk_guild_owner FOREIGN KEY (ownerId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE guildMember (
  guildId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  joinedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guildId, userId),
  KEY idx_guildMember_user (userId),
  CONSTRAINT fk_guildMember_guild FOREIGN KEY (guildId) REFERENCES guild(id) ON DELETE CASCADE,
  CONSTRAINT fk_guildMember_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Un role "@everyone" (isDefault = 1) est cree avec chaque serveur : ses
-- permissions s'appliquent a tous les membres. `position` : plus elle est
-- grande, plus le role est haut dans la hierarchie.
CREATE TABLE guildRole (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guildId INT UNSIGNED NOT NULL,
  name VARCHAR(50) NOT NULL,
  color CHAR(7) NOT NULL DEFAULT '#99AAB5',
  position INT UNSIGNED NOT NULL DEFAULT 0,
  permissions INT UNSIGNED NOT NULL DEFAULT 0,
  isDefault TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_guildRole_guild (guildId, position),
  CONSTRAINT fk_guildRole_guild FOREIGN KEY (guildId) REFERENCES guild(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE guildMemberRole (
  guildId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  roleId INT UNSIGNED NOT NULL,
  PRIMARY KEY (userId, roleId),
  KEY idx_guildMemberRole_guild (guildId, roleId),
  CONSTRAINT fk_guildMemberRole_guild FOREIGN KEY (guildId) REFERENCES guild(id) ON DELETE CASCADE,
  CONSTRAINT fk_guildMemberRole_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_guildMemberRole_role FOREIGN KEY (roleId) REFERENCES guildRole(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE guildCategory (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guildId INT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_guildCategory_guild (guildId, position),
  CONSTRAINT fk_guildCategory_guild FOREIGN KEY (guildId) REFERENCES guild(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Salon textuel ou vocal. Un salon prive (isPrivate = 1) n'est visible que
-- par les administrateurs, les roles listes dans guildChannelRole et les
-- membres listes dans guildChannelMember. slowmodeSeconds : delai minimal
-- entre deux messages d'un meme membre (0 = desactive).
CREATE TABLE guildChannel (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guildId INT UNSIGNED NOT NULL,
  categoryId INT UNSIGNED DEFAULT NULL,
  name VARCHAR(60) NOT NULL,
  type ENUM('text', 'voice') NOT NULL DEFAULT 'text',
  topic VARCHAR(200) DEFAULT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  isPrivate TINYINT(1) NOT NULL DEFAULT 0,
  slowmodeSeconds INT UNSIGNED NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_guildChannel_guild (guildId, categoryId, position),
  CONSTRAINT fk_guildChannel_guild FOREIGN KEY (guildId) REFERENCES guild(id) ON DELETE CASCADE,
  CONSTRAINT fk_guildChannel_category FOREIGN KEY (categoryId) REFERENCES guildCategory(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE guildChannelRole (
  channelId INT UNSIGNED NOT NULL,
  roleId INT UNSIGNED NOT NULL,
  PRIMARY KEY (channelId, roleId),
  CONSTRAINT fk_guildChannelRole_channel FOREIGN KEY (channelId) REFERENCES guildChannel(id) ON DELETE CASCADE,
  CONSTRAINT fk_guildChannelRole_role FOREIGN KEY (roleId) REFERENCES guildRole(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE guildChannelMember (
  channelId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  PRIMARY KEY (channelId, userId),
  CONSTRAINT fk_guildChannelMember_channel FOREIGN KEY (channelId) REFERENCES guildChannel(id) ON DELETE CASCADE,
  CONSTRAINT fk_guildChannelMember_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE guildMessage (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guildId INT UNSIGNED NOT NULL,
  channelId INT UNSIGNED NOT NULL,
  senderId INT UNSIGNED NOT NULL,
  content TEXT DEFAULT NULL,
  type ENUM('text','image','video','audio','file') NOT NULL DEFAULT 'text',
  mediaId INT UNSIGNED DEFAULT NULL,
  fileName VARCHAR(255) DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deletedAt DATETIME DEFAULT NULL,
  KEY idx_guildMessage_channel (channelId, id),
  KEY idx_guildMessage_slowmode (channelId, senderId, createdAt),
  KEY idx_guildMessage_media (mediaId),
  CONSTRAINT fk_guildMessage_guild FOREIGN KEY (guildId) REFERENCES guild(id) ON DELETE CASCADE,
  CONSTRAINT fk_guildMessage_channel FOREIGN KEY (channelId) REFERENCES guildChannel(id) ON DELETE CASCADE,
  CONSTRAINT fk_guildMessage_sender FOREIGN KEY (senderId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_guildMessage_media FOREIGN KEY (mediaId) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE guildInvite (
  code CHAR(10) PRIMARY KEY,
  guildId INT UNSIGNED NOT NULL,
  createdBy INT UNSIGNED NOT NULL,
  expiresAt DATETIME DEFAULT NULL,
  maxUses INT UNSIGNED DEFAULT NULL,
  uses INT UNSIGNED NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_guildInvite_guild (guildId),
  CONSTRAINT fk_guildInvite_guild FOREIGN KEY (guildId) REFERENCES guild(id) ON DELETE CASCADE,
  CONSTRAINT fk_guildInvite_user FOREIGN KEY (createdBy) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 2) Reels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reel (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  mediaId INT UNSIGNED NOT NULL,
  caption VARCHAR(500) DEFAULT NULL,
  visibility ENUM('public','friends','private') NOT NULL DEFAULT 'public',
  durationSec DECIMAL(6,2) DEFAULT NULL,
  viewsCount INT UNSIGNED NOT NULL DEFAULT 0,
  isEdited TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deletedAt DATETIME DEFAULT NULL,
  KEY idx_reel_user (userId),
  KEY idx_reel_created (createdAt),
  KEY idx_reel_media (mediaId),
  CONSTRAINT fk_reel_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_reel_media FOREIGN KEY (mediaId) REFERENCES media(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reelHashtag (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reelId INT UNSIGNED NOT NULL,
  hashtagId INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_reelHashtag (reelId, hashtagId),
  KEY idx_reelHashtag_hashtag (hashtagId),
  CONSTRAINT fk_reelHashtag_reel FOREIGN KEY (reelId) REFERENCES reel(id) ON DELETE CASCADE,
  CONSTRAINT fk_reelHashtag_hashtag FOREIGN KEY (hashtagId) REFERENCES hashtag(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reelReaction (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reelId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  type ENUM('like','dislike','haha','wow','grr','sad') NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reelReaction (reelId, userId),
  KEY idx_reelReaction_user (userId),
  CONSTRAINT fk_reelReaction_reel FOREIGN KEY (reelId) REFERENCES reel(id) ON DELETE CASCADE,
  CONSTRAINT fk_reelReaction_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reelComment (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reelId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  parentId INT UNSIGNED DEFAULT NULL,
  content VARCHAR(1000) NOT NULL,
  isEdited TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deletedAt DATETIME DEFAULT NULL,
  KEY idx_reelComment_reel (reelId),
  KEY idx_reelComment_user (userId),
  KEY idx_reelComment_parent (parentId),
  CONSTRAINT fk_reelComment_reel FOREIGN KEY (reelId) REFERENCES reel(id) ON DELETE CASCADE,
  CONSTRAINT fk_reelComment_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_reelComment_parent FOREIGN KEY (parentId) REFERENCES reelComment(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reelCommentReaction (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  commentId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  type ENUM('like','dislike','haha','wow','grr','sad') NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reelCommentReaction (commentId, userId),
  KEY idx_reelCommentReaction_user (userId),
  CONSTRAINT fk_reelCommentReaction_comment FOREIGN KEY (commentId) REFERENCES reelComment(id) ON DELETE CASCADE,
  CONSTRAINT fk_reelCommentReaction_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Signal d'interet implicite : une ligne par (reel, utilisateur), mise a jour
-- a chaque visionnage. Alimente la recommandation (taux de visionnage, rewatch).
CREATE TABLE IF NOT EXISTS reelView (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reelId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  watchedMs INT UNSIGNED NOT NULL DEFAULT 0,
  durationMs INT UNSIGNED NOT NULL DEFAULT 0,
  maxRatio DECIMAL(5,2) NOT NULL DEFAULT 0,
  loops SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  skipped TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reelView (reelId, userId),
  KEY idx_reelView_user (userId, updatedAt),
  CONSTRAINT fk_reelView_reel FOREIGN KEY (reelId) REFERENCES reel(id) ON DELETE CASCADE,
  CONSTRAINT fk_reelView_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- "Ce contenu ne m'interesse pas" : retire le reel du flux et penalise
-- ses hashtags / son auteur dans la recommandation.
CREATE TABLE IF NOT EXISTS reelHidden (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reelId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reelHidden (reelId, userId),
  KEY idx_reelHidden_user (userId),
  CONSTRAINT fk_reelHidden_reel FOREIGN KEY (reelId) REFERENCES reel(id) ON DELETE CASCADE,
  CONSTRAINT fk_reelHidden_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 3) Collections : dossiers (imbriquables) et playlists (ordonnees)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  parentId INT UNSIGNED DEFAULT NULL,
  kind ENUM('folder','playlist') NOT NULL DEFAULT 'playlist',
  name VARCHAR(100) NOT NULL,
  description VARCHAR(300) DEFAULT NULL,
  color VARCHAR(20) NOT NULL DEFAULT 'violet',
  visibility ENUM('private','friends','public') NOT NULL DEFAULT 'private',
  position INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_collection_user (userId, parentId),
  CONSTRAINT fk_collection_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_collection_parent FOREIGN KEY (parentId) REFERENCES collection(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS collectionItem (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  collectionId INT UNSIGNED NOT NULL,
  itemType ENUM('post','reel') NOT NULL,
  itemId INT UNSIGNED NOT NULL,
  position INT NOT NULL DEFAULT 0,
  addedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_collectionItem (collectionId, itemType, itemId),
  KEY idx_collectionItem_item (itemType, itemId),
  CONSTRAINT fk_collectionItem_collection FOREIGN KEY (collectionId) REFERENCES collection(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 4) Signalements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporterId INT UNSIGNED NOT NULL,
  targetType ENUM('user','post','comment','reel','reelComment','group') NOT NULL,
  targetId INT UNSIGNED NOT NULL,
  targetUserId INT UNSIGNED DEFAULT NULL,
  reason ENUM('spam','harassment','hate','violence','nudity','misinformation','scam','impersonation','other') NOT NULL,
  details VARCHAR(500) DEFAULT NULL,
  snapshot VARCHAR(400) DEFAULT NULL,
  status ENUM('pending','resolved','dismissed') NOT NULL DEFAULT 'pending',
  action VARCHAR(40) DEFAULT NULL,
  resolvedBy INT UNSIGNED DEFAULT NULL,
  resolvedAt DATETIME DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_report (reporterId, targetType, targetId),
  KEY idx_report_status (status, createdAt),
  KEY idx_report_target (targetType, targetId),
  CONSTRAINT fk_report_reporter FOREIGN KEY (reporterId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 5) Journal d'activite utilisateur et journal d'audit administrateur
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activityLog (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  action VARCHAR(40) NOT NULL,
  targetType VARCHAR(20) DEFAULT NULL,
  targetId INT UNSIGNED DEFAULT NULL,
  meta VARCHAR(500) DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_activityLog_user (userId, createdAt),
  CONSTRAINT fk_activityLog_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS adminAudit (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  adminId INT UNSIGNED NOT NULL,
  action VARCHAR(50) NOT NULL,
  targetType VARCHAR(20) DEFAULT NULL,
  targetId INT UNSIGNED DEFAULT NULL,
  details VARCHAR(500) DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_adminAudit_created (createdAt),
  KEY idx_adminAudit_admin (adminId),
  CONSTRAINT fk_adminAudit_admin FOREIGN KEY (adminId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS deletedAccount (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  deletedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_deletedAccount_email (email)
) ENGINE=InnoDB;

-- Appareils connus d'un utilisateur (identifies par un cookie d'appareil).
CREATE TABLE IF NOT EXISTS loginDevice (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  deviceKey CHAR(64) NOT NULL,
  label VARCHAR(120) NOT NULL,
  ip VARCHAR(64) DEFAULT NULL,
  city VARCHAR(100) DEFAULT NULL,
  region VARCHAR(100) DEFAULT NULL,
  country VARCHAR(100) DEFAULT NULL,
  firstSeenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastSeenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_loginDevice (userId, deviceKey),
  CONSTRAINT fk_loginDevice_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Parametres globaux modifiables depuis l'administration (prix premium...).
CREATE TABLE IF NOT EXISTS appSetting (
  settingKey VARCHAR(60) PRIMARY KEY,
  settingValue VARCHAR(255) NOT NULL,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  provider VARCHAR(20) NOT NULL DEFAULT 'paypal',
  orderId VARCHAR(64) NOT NULL,
  captureId VARCHAR(64) DEFAULT NULL,
  status ENUM('created','completed','failed') NOT NULL DEFAULT 'created',
  amountMad DECIMAL(10,2) NOT NULL,
  chargeAmount DECIMAL(10,2) NOT NULL,
  chargeCurrency CHAR(3) NOT NULL,
  premiumDays INT NOT NULL DEFAULT 0,
  payerEmail VARCHAR(255) DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt DATETIME DEFAULT NULL,
  UNIQUE KEY uq_payment_order (orderId),
  KEY idx_payment_user (userId),
  CONSTRAINT fk_payment_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profileVisit (
  profileId INT UNSIGNED NOT NULL,
  visitorId INT UNSIGNED NOT NULL,
  firstVisitedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastVisitedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  visitCount INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (profileId, visitorId),
  KEY idx_profileVisit_last (profileId, lastVisitedAt),
  CONSTRAINT fk_profileVisit_profile FOREIGN KEY (profileId) REFERENCES user(id) ON DELETE CASCADE,
  CONSTRAINT fk_profileVisit_visitor FOREIGN KEY (visitorId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS postBoost (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  postId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  startsAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  endsAt DATETIME NOT NULL,
  KEY idx_postBoost_post (postId, endsAt),
  KEY idx_postBoost_user (userId, endsAt),
  CONSTRAINT fk_postBoost_post FOREIGN KEY (postId) REFERENCES post(id) ON DELETE CASCADE,
  CONSTRAINT fk_postBoost_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Demandes de revision d'un bannissement. Le resultat est envoye par email.
CREATE TABLE IF NOT EXISTS banAppeal (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  message VARCHAR(1000) NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  adminNote VARCHAR(255) DEFAULT NULL,
  reviewedBy INT UNSIGNED DEFAULT NULL,
  reviewedAt DATETIME DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_banAppeal_status (status, createdAt),
  KEY idx_banAppeal_user (userId, createdAt),
  CONSTRAINT fk_banAppeal_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Chaque bannissement est historise : motif saisi, qui l'a prononce et, le cas
-- echeant, le contenu signale a l'origine (publication, reel, commentaire...).
CREATE TABLE IF NOT EXISTS banRecord (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  adminId INT UNSIGNED DEFAULT NULL,
  sourceType VARCHAR(20) DEFAULT NULL,
  sourceId INT UNSIGNED DEFAULT NULL,
  sourceSnapshot VARCHAR(400) DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_banRecord_user (userId, createdAt),
  CONSTRAINT fk_banRecord_user FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB;
