// Signalisation des appels audio/video (WebRTC) via Socket.IO.
//
// Le serveur ne transporte JAMAIS le flux audio/video : les navigateurs
// communiquent en pair-a-pair. Ici on ne fait que :
//   - verifier qui a le droit d'appeler qui (conversation privee, pas de blocage),
//   - faire sonner le destinataire (sur tous ses onglets),
//   - relayer les messages de negociation WebRTC (offre / reponse / candidats ICE),
//   - garder un etat minimal des appels en cours (occupe, expiration, deconnexion).
//
// Evenements client -> serveur : call:invite, call:accept, call:decline,
//   call:end, call:signal, call:state
// Evenements serveur -> client : call:incoming, call:accepted, call:handled,
//   call:ended, call:signal, call:peer-state

const crypto = require('crypto');
const mysql = require('mysql2/promise');
const webpush = require('web-push');
const { tr } = require('../lib/i18n/server');
const { isSupportedLocale } = require('../lib/i18n/config');

const RING_TIMEOUT_MS = 45 * 1000;
// Destinataire hors ligne : on laisse plus de temps pour voir la notification et ouvrir l'app.
const OFFLINE_RING_TIMEOUT_MS = 60 * 1000;

const PUSH_READY = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (PUSH_READY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL || 'admin@example.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
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

// Les deux utilisateurs doivent partager une conversation privee (non groupe)
// dont ils sont encore participants, et aucun ne doit avoir bloque l'autre.
async function canCall(callerId, calleeId, conversationId) {
  const [rows] = await getPool().execute(
    `SELECT 1
       FROM conversation c
       JOIN conversationParticipant p1 ON p1.conversationId = c.id AND p1.userId = ? AND p1.leftAt IS NULL
       JOIN conversationParticipant p2 ON p2.conversationId = c.id AND p2.userId = ? AND p2.leftAt IS NULL
      WHERE c.id = ? AND c.isGroup = 0
        AND NOT EXISTS (
          SELECT 1 FROM block b
           WHERE (b.blockerId = ? AND b.blockedId = ?) OR (b.blockerId = ? AND b.blockedId = ?)
        )
      LIMIT 1`,
    [callerId, calleeId, conversationId, callerId, calleeId, calleeId, callerId]
  );
  return rows.length > 0;
}

async function getUserInfo(userId) {
  const [rows] = await getPool().execute(
    'SELECT id, firstName, lastName, avatarId FROM user WHERE id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    avatar: row.avatarId ? `/api/media/${row.avatarId}` : null
  };
}

// Notification push vers tous les appareils d'un utilisateur (appel entrant /
// appel manque quand l'app n'est pas ouverte). Renvoie true si au moins un
// appareil a ete atteint.
async function pushToUser(userId, buildPayload) {
  if (!PUSH_READY) return false;
  try {
    const [subs] = await getPool().execute(
      'SELECT id, endpoint, p256dh, auth FROM pushSubscription WHERE userId = ?',
      [userId]
    );
    if (subs.length === 0) return false;
    const [langRows] = await getPool().execute('SELECT language FROM user WHERE id = ? LIMIT 1', [userId]);
    const language = langRows[0] && langRows[0].language;
    const payload = JSON.stringify(buildPayload(isSupportedLocale(language) ? language : 'fr'));

    let delivered = 0;
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 60, urgency: 'high' }
          );
          delivered += 1;
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await getPool().execute('DELETE FROM pushSubscription WHERE id = ?', [sub.id]);
          } else {
            console.error('[call push]', error.message);
          }
        }
      })
    );
    return delivered > 0;
  } catch (error) {
    console.error('[call push]', error.message);
    return false;
  }
}

module.exports = function createCallSignaling(io) {
  const calls = new Map(); // callId -> call
  const userCalls = new Map(); // userId -> callId (un utilisateur = un appel a la fois)

  function userRoom(userId) {
    return `user:${userId}`;
  }

  function hasSockets(userId) {
    const room = io.sockets.adapter.rooms.get(userRoom(userId));
    return Boolean(room && room.size > 0);
  }

  function cleanup(call) {
    if (call.timer) clearTimeout(call.timer);
    calls.delete(call.id);
    if (userCalls.get(call.callerId) === call.id) userCalls.delete(call.callerId);
    if (userCalls.get(call.calleeId) === call.id) userCalls.delete(call.calleeId);
  }

  // Termine l'appel et previente les deux camps (sauf `exceptSocketId`).
  function terminate(call, reason, exceptSocketId) {
    // Appel non decroche par quelqu'un de hors ligne : la notification "appel entrant"
    // est remplacee (meme tag) par "appel manque".
    if (call.notifiedOffline && (reason === 'missed' || reason === 'cancelled') && !hasSockets(call.calleeId)) {
      pushToUser(call.calleeId, (locale) => ({
        title: `${call.caller.firstName} ${call.caller.lastName}`,
        body: tr(locale, 'Appel manque'),
        url: `/messages/${call.conversationId}`,
        icon: call.caller.avatar || '/icon.png',
        tag: `call-${call.id}`,
        renotify: true
      })).catch(() => {});
    }
    const payload = { callId: call.id, reason };
    if (call.callerSocketId && call.callerSocketId !== exceptSocketId) {
      io.to(call.callerSocketId).emit('call:ended', payload);
    }
    if (call.state === 'active' && call.calleeSocketId) {
      if (call.calleeSocketId !== exceptSocketId) io.to(call.calleeSocketId).emit('call:ended', payload);
    } else {
      // Ca sonne encore : tous les onglets du destinataire doivent s'arreter.
      if (exceptSocketId) {
        io.in(userRoom(call.calleeId)).except(exceptSocketId).emit('call:ended', payload);
      } else {
        io.to(userRoom(call.calleeId)).emit('call:ended', payload);
      }
    }
    cleanup(call);
  }

  function findCall(callId) {
    return typeof callId === 'string' ? calls.get(callId) : undefined;
  }

  return function register(socket) {
    const userId = socket.userId;

    socket.on('call:invite', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const conversationId = Number(payload && payload.conversationId);
        const toUserId = Number(payload && payload.toUserId);
        const kind = payload && payload.kind === 'video' ? 'video' : 'voice';

        if (!Number.isInteger(conversationId) || !Number.isInteger(toUserId) || toUserId === userId) {
          return reply({ ok: false, reason: 'invalid' });
        }
        if (userCalls.has(userId)) return reply({ ok: false, reason: 'self_busy' });
        if (userCalls.has(toUserId)) return reply({ ok: false, reason: 'busy' });

        const allowed = await canCall(userId, toUserId, conversationId);
        if (!allowed) return reply({ ok: false, reason: 'not_allowed' });

        const caller = await getUserInfo(userId);
        if (!caller) return reply({ ok: false, reason: 'invalid' });

        // L'etat a pu changer pendant les requetes SQL : on re-verifie juste
        // avant de reserver les deux utilisateurs (bloc synchrone).
        if (userCalls.has(userId)) return reply({ ok: false, reason: 'self_busy' });
        if (userCalls.has(toUserId)) return reply({ ok: false, reason: 'busy' });

        // Hors ligne : on appelle quand meme (notification push + sonnerie a l'ouverture de l'app).
        const calleeOffline = !hasSockets(toUserId);

        const call = {
          id: crypto.randomUUID(),
          kind,
          conversationId,
          callerId: userId,
          calleeId: toUserId,
          callerSocketId: socket.id,
          calleeSocketId: null,
          state: 'ringing',
          timer: null,
          caller,
          notifiedOffline: false
        };
        calls.set(call.id, call);
        userCalls.set(userId, call.id);
        userCalls.set(toUserId, call.id);

        call.timer = setTimeout(() => {
          const current = calls.get(call.id);
          if (current && current.state === 'ringing') terminate(current, 'missed');
        }, calleeOffline ? OFFLINE_RING_TIMEOUT_MS : RING_TIMEOUT_MS);

        io.to(userRoom(toUserId)).emit('call:incoming', {
          callId: call.id,
          kind,
          conversationId,
          caller
        });

        let notified = false;
        if (calleeOffline) {
          call.notifiedOffline = true;
          notified = await pushToUser(toUserId, (locale) => ({
            title: `${caller.firstName} ${caller.lastName}`,
            body: kind === 'video' ? tr(locale, 'Appel video entrant') : tr(locale, 'Appel vocal entrant'),
            url: `/messages/${conversationId}`,
            icon: caller.avatar || '/icon.png',
            tag: `call-${call.id}`,
            requireInteraction: true,
            renotify: true,
            vibrate: [300, 150, 300, 150, 300]
          }));
        }

        return reply({ ok: true, callId: call.id, calleeOffline, notified });
      } catch (error) {
        console.error('call:invite', error);
        return reply({ ok: false, reason: 'error' });
      }
    });

    // Un client qui vient de se connecter (ex: ouverture de l'app depuis la
    // notification push) demande s'il y a un appel en train de sonner pour lui.
    socket.on('call:sync', () => {
      const callId = userCalls.get(userId);
      const call = callId ? calls.get(callId) : null;
      if (!call || call.state !== 'ringing' || call.calleeId !== userId) return;
      socket.emit('call:incoming', {
        callId: call.id,
        kind: call.kind,
        conversationId: call.conversationId,
        caller: call.caller
      });
    });

    socket.on('call:accept', (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const call = findCall(payload && payload.callId);
      if (!call || call.calleeId !== userId || call.state !== 'ringing') {
        return reply({ ok: false });
      }

      if (call.timer) clearTimeout(call.timer);
      call.timer = null;
      call.state = 'active';
      call.calleeSocketId = socket.id;

      // Les autres onglets du destinataire arretent de sonner.
      socket.to(userRoom(userId)).emit('call:handled', { callId: call.id });
      io.to(call.callerSocketId).emit('call:accepted', { callId: call.id });
      return reply({ ok: true });
    });

    socket.on('call:decline', (payload) => {
      const call = findCall(payload && payload.callId);
      if (!call || call.calleeId !== userId || call.state !== 'ringing') return;

      socket.to(userRoom(userId)).emit('call:handled', { callId: call.id });
      io.to(call.callerSocketId).emit('call:ended', { callId: call.id, reason: 'declined' });
      cleanup(call);
    });

    socket.on('call:end', (payload) => {
      const call = findCall(payload && payload.callId);
      if (!call) return;
      const isCaller = call.callerId === userId && call.callerSocketId === socket.id;
      const isCallee = call.calleeId === userId;
      if (!isCaller && !isCallee) return;

      if (call.state === 'ringing') {
        if (isCaller) terminate(call, 'cancelled', socket.id);
        else {
          socket.to(userRoom(userId)).emit('call:handled', { callId: call.id });
          io.to(call.callerSocketId).emit('call:ended', { callId: call.id, reason: 'declined' });
          cleanup(call);
        }
        return;
      }

      if (isCallee && call.calleeSocketId !== socket.id) return;
      terminate(call, 'ended', socket.id);
    });

    socket.on('call:signal', (payload) => {
      const call = findCall(payload && payload.callId);
      if (!call || call.state !== 'active' || !payload.data) return;

      let size = 0;
      try {
        size = JSON.stringify(payload.data).length;
      } catch (error) {
        return;
      }
      if (size > MAX_SIGNAL_SIZE) return;

      let targetSocketId = null;
      if (socket.id === call.callerSocketId) targetSocketId = call.calleeSocketId;
      else if (socket.id === call.calleeSocketId) targetSocketId = call.callerSocketId;
      if (!targetSocketId) return;

      io.to(targetSocketId).emit('call:signal', { callId: call.id, data: payload.data });
    });

    socket.on('call:state', (payload) => {
      const call = findCall(payload && payload.callId);
      if (!call || call.state !== 'active' || !payload.state) return;

      let targetSocketId = null;
      if (socket.id === call.callerSocketId) targetSocketId = call.calleeSocketId;
      else if (socket.id === call.calleeSocketId) targetSocketId = call.callerSocketId;
      if (!targetSocketId) return;

      io.to(targetSocketId).emit('call:peer-state', {
        callId: call.id,
        state: {
          audio: payload.state.audio !== false,
          camera: payload.state.camera === true,
          screen: payload.state.screen === true
        }
      });
    });

    socket.on('disconnect', () => {
      for (const call of Array.from(calls.values())) {
        if (call.callerSocketId === socket.id) {
          terminate(call, call.state === 'ringing' ? 'cancelled' : 'disconnected', socket.id);
        } else if (call.state === 'active' && call.calleeSocketId === socket.id) {
          terminate(call, 'disconnected', socket.id);
        } else if (call.state === 'ringing' && call.calleeId === userId && !hasSockets(userId)) {
          // Le destinataire n'a plus aucun onglet ouvert : inutile de faire sonner.
          terminate(call, 'missed', socket.id);
        }
      }
    });
  };
};