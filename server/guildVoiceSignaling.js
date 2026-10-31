// Signalisation des salons vocaux de serveur (WebRTC en maillage complet).
//
// Comme pour les appels 1-a-1 (voir callSignaling.js), le serveur ne
// transporte jamais l'audio/video : chaque paire de participants d'un
// meme salon vocal negocie sa propre connexion pair-a-pair. Avec N
// participants cela fait N*(N-1)/2 connexions : une approche simple et
// suffisante pour de petits salons (jusqu'a une demi-douzaine de
// personnes), mais qui ne remplace pas un serveur media (SFU) pour de
// grands salons.
//
// Convention de negociation : quand quelqu'un rejoint un salon deja
// occupe, c'est TOUJOURS le nouvel arrivant qui envoie l'offre a chaque
// participant deja present (jamais l'inverse). Cela evite toute ambiguite
// sur qui initie quoi.
//
// Evenements client -> serveur : voice:join, voice:leave, voice:signal,
//   voice:state, voice:mute-user, voice:list
// Evenements serveur -> client : voice:peers, voice:peer-joined,
//   voice:peer-left, voice:signal, voice:peer-state, voice:force-muted,
//   voice:occupants
//
// `voice:occupants` est diffuse a toute la salle `guild:<id>` a chaque
// arrivee/depart : il permet d'afficher, sous chaque salon vocal de la
// colonne des salons, la liste des personnes deja connectees (meme pour
// ceux qui n'ont pas rejoint le salon). `voice:list` (avec accuse de
// reception) renvoie l'etat courant de tous les salons vocaux d'un
// serveur au moment ou l'on ouvre la page.

const mysql = require('mysql2/promise');

// Duplique volontairement les bits de lib/guildPermissions.js (fichier ES
// module, non importable directement depuis ce script CommonJS execute par
// `node server.js`). Garder les deux synchronises si la liste change.
const PERMISSIONS = {
  ADMINISTRATOR: 1 << 0,
  CONNECT: 1 << 8,
  SPEAK: 1 << 9,
  VIDEO: 1 << 10,
  SCREEN_SHARE: 1 << 11,
  MUTE_MEMBERS: 1 << 12
};

function hasPermission(mask, permission) {
  if (mask & PERMISSIONS.ADMINISTRATOR) return true;
  return (mask & permission) === permission;
}

const MAX_SIGNAL_SIZE = 100 * 1000;

let pool;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 3,
      queueLimit: 0
    });
  }
  return pool;
}

// Verifie que le salon est vocal, appartient bien au serveur attendu, et
// calcule le masque de permissions effectif de l'utilisateur dessus.
async function getVoiceAccess(userId, channelId) {
  const [channelRows] = await getPool().execute(
    "SELECT id, guildId, isPrivate FROM guildChannel WHERE id = ? AND type = 'voice' LIMIT 1",
    [channelId]
  );
  if (channelRows.length === 0) return null;
  const channel = channelRows[0];

  const [roleRows] = await getPool().execute(
    `SELECT g.ownerId, r.permissions, r.id as roleId
     FROM guild g
     JOIN guildMember m ON m.guildId = g.id AND m.userId = ?
     LEFT JOIN guildRole r ON r.guildId = g.id
     LEFT JOIN guildMemberRole mr ON mr.roleId = r.id AND mr.userId = ?
     WHERE g.id = ? AND (r.isDefault = 1 OR mr.userId IS NOT NULL)`,
    [userId, userId, channel.guildId]
  );
  if (roleRows.length === 0) return null; // pas membre du serveur

  const isOwner = roleRows[0].ownerId === userId;
  let permissions = roleRows.reduce((mask, row) => mask | Number(row.permissions || 0), 0);
  if (isOwner) permissions = PERMISSIONS.ADMINISTRATOR;

  if (channel.isPrivate && !hasPermission(permissions, PERMISSIONS.ADMINISTRATOR)) {
    const roleIds = roleRows.map((row) => row.roleId).filter(Boolean);
    const [accessRows] = await getPool().execute(
      `SELECT 1 FROM guildChannelMember WHERE channelId = ? AND userId = ?
       UNION
       SELECT 1 FROM guildChannelRole WHERE channelId = ? AND roleId IN (${roleIds.length ? roleIds.map(() => '?').join(',') : 'NULL'})
       LIMIT 1`,
      [channelId, userId, channelId, ...roleIds]
    );
    if (accessRows.length === 0) return null;
  }

  return { guildId: channel.guildId, permissions, isOwner, isPrivate: Boolean(channel.isPrivate) };
}

async function isGuildMember(userId, guildId) {
  const [rows] = await getPool().execute('SELECT 1 FROM guildMember WHERE guildId = ? AND userId = ? LIMIT 1', [guildId, userId]);
  return rows.length > 0;
}

async function getUserInfo(userId) {
  const [rows] = await getPool().execute('SELECT id, firstName, lastName, avatarId FROM user WHERE id = ? LIMIT 1', [userId]);
  if (rows.length === 0) return null;
  const row = rows[0];
  return { id: row.id, firstName: row.firstName, lastName: row.lastName, avatar: row.avatarId ? `/api/media/${row.avatarId}` : null };
}

function voiceRoom(channelId) {
  return `voice:${channelId}`;
}

module.exports = function createGuildVoiceSignaling(io) {
  // channelId -> Map<socketId, { userId, user, muted, camera, screen, permissions }>
  const rooms = new Map();
  // channelId -> guildId (renseigne des qu'un salon a un participant)
  const roomGuild = new Map();
  // Salons vocaux prives : leurs occupants ne sont jamais annonces a tout
  // le serveur (seuls les membres du salon se voient entre eux).
  const privateRooms = new Set();

  // Liste dedoublonnee (par utilisateur : deux onglets = une seule entree)
  // des personnes presentes dans un salon vocal.
  function occupantsOf(channelId) {
    const participants = rooms.get(channelId);
    if (!participants) return [];
    const seen = new Set();
    const users = [];
    participants.forEach((p) => {
      if (seen.has(p.userId)) return;
      seen.add(p.userId);
      users.push({ userId: p.userId, firstName: p.user.firstName, lastName: p.user.lastName, avatar: p.user.avatar, muted: p.muted });
    });
    return users;
  }

  function broadcastOccupants(channelId) {
    const guildId = roomGuild.get(channelId);
    if (!guildId || privateRooms.has(channelId)) return;
    io.to(`guild:${guildId}`).emit('voice:occupants', { guildId, channelId, users: occupantsOf(channelId) });
  }

  function roomFor(channelId) {
    if (!rooms.has(channelId)) rooms.set(channelId, new Map());
    return rooms.get(channelId);
  }

  function leaveVoice(socket, channelId, reason) {
    const participants = rooms.get(channelId);
    if (!participants || !participants.has(socket.id)) return;
    participants.delete(socket.id);
    const isEmpty = participants.size === 0;
    if (isEmpty) rooms.delete(channelId);
    socket.leave(voiceRoom(channelId));
    io.to(voiceRoom(channelId)).emit('voice:peer-left', { channelId, socketId: socket.id, reason });
    broadcastOccupants(channelId);
    if (isEmpty) {
      roomGuild.delete(channelId);
      privateRooms.delete(channelId);
    }
  }

  return function register(socket) {
    const userId = socket.userId;

    socket.on('voice:join', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const channelId = Number(payload && payload.channelId);
      const wantsCamera = Boolean(payload && payload.camera);
      if (!Number.isInteger(channelId)) return reply({ ok: false, reason: 'invalid' });

      try {
        const access = await getVoiceAccess(userId, channelId);
        if (!access || !hasPermission(access.permissions, PERMISSIONS.CONNECT)) {
          return reply({ ok: false, reason: 'not_allowed' });
        }
        if (wantsCamera && !hasPermission(access.permissions, PERMISSIONS.VIDEO)) {
          return reply({ ok: false, reason: 'not_allowed' });
        }

        const user = await getUserInfo(userId);
        if (!user) return reply({ ok: false, reason: 'invalid' });

        // Une socket ne peut etre que dans un seul salon vocal a la fois.
        const previousChannelId = socket.data.voiceChannelId;
        if (Number.isInteger(previousChannelId) && previousChannelId !== channelId) {
          leaveVoice(socket, previousChannelId, 'switched');
        }

        const participants = roomFor(channelId);
        roomGuild.set(channelId, access.guildId);
        if (access.isPrivate) privateRooms.add(channelId);
        else privateRooms.delete(channelId);
        const existingPeers = [...participants.entries()].map(([socketId, p]) => ({
          socketId,
          userId: p.userId,
          user: p.user,
          muted: p.muted,
          camera: p.camera,
          screen: p.screen
        }));

        const canSpeak = hasPermission(access.permissions, PERMISSIONS.SPEAK);
        const self = {
          userId,
          user,
          muted: !canSpeak,
          camera: false,
          screen: false,
          permissions: access.permissions
        };
        participants.set(socket.id, self);
        socket.join(voiceRoom(channelId));
        socket.data.voiceChannelId = channelId;

        socket.to(voiceRoom(channelId)).emit('voice:peer-joined', {
          channelId,
          socketId: socket.id,
          userId,
          user,
          muted: self.muted,
          camera: self.camera,
          screen: self.screen
        });
        broadcastOccupants(channelId);

        return reply({ ok: true, peers: existingPeers, canSpeak, canVideo: hasPermission(access.permissions, PERMISSIONS.VIDEO), canScreenShare: hasPermission(access.permissions, PERMISSIONS.SCREEN_SHARE), canMuteOthers: hasPermission(access.permissions, PERMISSIONS.MUTE_MEMBERS) });
      } catch (error) {
        console.error('voice:join', error);
        return reply({ ok: false, reason: 'error' });
      }
    });

    // Etat courant des salons vocaux d'un serveur (reserve aux membres).
    socket.on('voice:list', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const guildId = Number(payload && payload.guildId);
      if (!Number.isInteger(guildId)) return reply({ ok: false, occupants: {} });
      try {
        if (!(await isGuildMember(userId, guildId))) return reply({ ok: false, occupants: {} });
        const occupants = {};
        roomGuild.forEach((roomGuildId, channelId) => {
          if (roomGuildId === guildId && !privateRooms.has(channelId)) occupants[channelId] = occupantsOf(channelId);
        });
        return reply({ ok: true, occupants });
      } catch (error) {
        console.error('voice:list', error);
        return reply({ ok: false, occupants: {} });
      }
    });

    socket.on('voice:leave', (payload) => {
      const channelId = Number(payload && payload.channelId);
      if (Number.isInteger(channelId)) leaveVoice(socket, channelId, 'left');
      socket.data.voiceChannelId = null;
    });

    // Relais d'un message de negociation WebRTC vers un pair precis du
    // meme salon (offre / reponse / candidat ICE).
    socket.on('voice:signal', (payload) => {
      const channelId = Number(payload && payload.channelId);
      const targetSocketId = payload && payload.targetSocketId;
      if (!Number.isInteger(channelId) || typeof targetSocketId !== 'string' || !payload.data) return;

      const participants = rooms.get(channelId);
      if (!participants || !participants.has(socket.id) || !participants.has(targetSocketId)) return;

      let size = 0;
      try {
        size = JSON.stringify(payload.data).length;
      } catch (error) {
        return;
      }
      if (size > MAX_SIGNAL_SIZE) return;

      io.to(targetSocketId).emit('voice:signal', { channelId, from: socket.id, data: payload.data });
    });

    // Etat local (micro coupe, camera, partage d'ecran) : purement
    // informatif pour l'UI des autres participants.
    socket.on('voice:state', (payload) => {
      const channelId = Number(payload && payload.channelId);
      const state = payload && payload.state;
      if (!Number.isInteger(channelId) || !state) return;

      const participants = rooms.get(channelId);
      const self = participants && participants.get(socket.id);
      if (!self) return;

      self.muted = state.muted !== false;
      self.camera = state.camera === true;
      self.screen = state.screen === true;

      socket.to(voiceRoom(channelId)).emit('voice:peer-state', {
        channelId,
        socketId: socket.id,
        state: { muted: self.muted, camera: self.camera, screen: self.screen }
      });
      broadcastOccupants(channelId);
    });

    // Un moderateur (MUTE_MEMBERS) coupe le micro d'un autre participant.
    // Le client cible doit lui-meme couper sa piste et re-emettre son etat.
    socket.on('voice:mute-user', (payload) => {
      const channelId = Number(payload && payload.channelId);
      const targetSocketId = payload && payload.targetSocketId;
      if (!Number.isInteger(channelId) || typeof targetSocketId !== 'string') return;

      const participants = rooms.get(channelId);
      const self = participants && participants.get(socket.id);
      const target = participants && participants.get(targetSocketId);
      if (!self || !target || !hasPermission(self.permissions, PERMISSIONS.MUTE_MEMBERS)) return;

      io.to(targetSocketId).emit('voice:force-muted', { channelId, byUserId: userId });
    });

    socket.on('disconnect', () => {
      const channelId = socket.data.voiceChannelId;
      if (Number.isInteger(channelId)) leaveVoice(socket, channelId, 'disconnected');
    });
  };
};
