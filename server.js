const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const createCallSignaling = require('./server/callSignaling');
const createGuildVoiceSignaling = require('./server/guildVoiceSignaling');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((pair) => {
    const index = pair.indexOf('=');
    if (index === -1) return;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

app.prepare().then(async () => {
  const { jwtVerify } = await import('jose');
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(process.env.JWT_SECRET);

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    path: '/api/socket',
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  const onlineUsers = new Map();
  const registerCallHandlers = createCallSignaling(io);
  const registerGuildVoiceHandlers = createGuildVoiceSignaling(io);

  // Pool minimaliste, independant de lib/db.js (ESM, non chargeable
  // directement depuis ce fichier CommonJS execute par `node server.js`
  // sans transpilation), utilise uniquement pour lire le reglage de
  // confidentialite "afficher mon statut en ligne" a la connexion.
  const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
  });

  async function fetchShowOnlineStatus(userId) {
    try {
      const [rows] = await dbPool.execute('SELECT showOnlineStatus FROM user WHERE id = ? LIMIT 1', [userId]);
      return rows[0] ? Boolean(rows[0].showOnlineStatus) : true;
    } catch (error) {
      return true;
    }
  }

  // Reglage "afficher mon statut en ligne" pour chaque utilisateur
  // actuellement connecte (au moins un onglet ouvert). Determine a chaque
  // connexion, symetrique : si false, l'utilisateur est invisible pour
  // les autres ET ne recoit lui-meme aucun statut des autres.
  const visibilityByUser = new Map();

  // N'emet un evenement de presence qu'aux utilisateurs connectes qui ont
  // eux-memes garde le reglage actif (regle symetrique).
  function broadcastPresenceToVisibleUsers(subjectUserId, online) {
    for (const [recipientId] of onlineUsers) {
      if (recipientId === subjectUserId) continue;
      if (visibilityByUser.get(recipientId) === true) {
        io.to(`user:${recipientId}`).emit('presence:update', { userId: subjectUserId, online });
      }
    }
  }

  // Utilise par l'administration : coupe immediatement toutes les connexions
  // temps reel d'un utilisateur qui vient d'etre banni ou supprime.
  global.disconnectUserSockets = (userId) => {
    try {
      io.in(`user:${userId}`).disconnectSockets(true);
    } catch (error) {
      // sans consequence : la session sera refusee a la prochaine requete
    }
  };

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = cookies.authToken;
      if (!token) {
        next(new Error('unauthorized'));
        return;
      }
      const { payload } = await jwtVerify(token, secretKey);
      // Un compte banni ou supprime ne peut plus ouvrir de connexion temps reel.
      const [statusRows] = await dbPool.execute('SELECT bannedAt FROM user WHERE id = ? LIMIT 1', [payload.id]);
      if (!statusRows[0] || statusRows[0].bannedAt) {
        next(new Error('unauthorized'));
        return;
      }
      socket.userId = payload.id;
      next();
    } catch (error) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket;
    socket.join(`user:${userId}`);

    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    const isVisible = await fetchShowOnlineStatus(userId);
    socket.data.presenceVisible = isVisible;
    visibilityByUser.set(userId, isVisible);

    if (isVisible) {
      // Ne voit les statuts des autres que si son propre statut est
      // visible (reglage symetrique).
      const visibleOnlineIds = Array.from(onlineUsers.keys()).filter(
        (id) => id !== userId && visibilityByUser.get(id) === true
      );
      socket.emit('presence:list', visibleOnlineIds);
      broadcastPresenceToVisibleUsers(userId, true);
    } else {
      socket.emit('presence:list', []);
    }

    socket.on('conversation:join', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Serveurs (communautes) : la salle `guild:<id>` recoit la structure et
    // les messages des salons publics. L'appartenance est verifiee en base.
    socket.on('guild:join', async (guildId) => {
      const id = Number(guildId);
      if (!Number.isInteger(id)) return;
      try {
        const [rows] = await dbPool.execute('SELECT 1 FROM guildMember WHERE guildId = ? AND userId = ? LIMIT 1', [id, userId]);
        if (rows.length > 0) socket.join(`guild:${id}`);
      } catch (error) {
        // Ignore : le client reessaiera au prochain chargement.
      }
    });

    socket.on('guild:leave', (guildId) => {
      socket.leave(`guild:${Number(guildId)}`);
    });

    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId, userId });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', { conversationId, userId });
    });

    // Appels audio/video : signalisation WebRTC (voir server/callSignaling.js)
    registerCallHandlers(socket);
    registerGuildVoiceHandlers(socket);

    socket.on('disconnect', () => {
      const set = onlineUsers.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          onlineUsers.delete(userId);
          visibilityByUser.delete(userId);
          if (socket.data.presenceVisible) {
            broadcastPresenceToVisibleUsers(userId, false);
          }
        }
      }
    });
  });

  global.io = io;

  httpServer.listen(port, () => {
    console.log(`Serveur pret sur http://${hostname}:${port}`);
  });
});
