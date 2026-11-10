import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '@/lib/i18n/runtime';
// =====================================================================
// Salon vocal de serveur : maillage WebRTC complet.
// =====================================================================
// Chaque participant ouvre une RTCPeerConnection vers chaque AUTRE
// participant (voir server/guildVoiceSignaling.js pour la convention de
// negociation : le NOUVEL ARRIVANT envoie toujours l'offre initiale).
//
// Fiabilite :
//  - les messages de signalisation d'un meme pair sont traites en file
//    (jamais en parallele) ;
//  - toute modification de piste video (camera, partage d'ecran) est suivie
//    d'une renegociation (offre/reponse), sinon les autres ne recoivent pas
//    toujours l'image ;
//  - une connexion qui passe en "disconnected"/"failed" est relancee par un
//    redemarrage ICE avant d'etre abandonnee ;
//  - si la socket de signalisation se reconnecte, on rejoint de nouveau le
//    salon (le serveur nous en a retire a la deconnexion).
// =====================================================================

const ICE_CACHE_MS = 10 * 60 * 1000;
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' }
];
const VIDEO_CONSTRAINTS = { width: { ideal: 1280 }, height: { ideal: 720 } };
const AUDIO_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const ICE_RESTART_DELAY_MS = 2500;
const MAX_ICE_RESTARTS = 4;

let iceCache = { servers: null, fetchedAt: 0 };
async function getIceServers() {
  if (iceCache.servers && Date.now() - iceCache.fetchedAt < ICE_CACHE_MS) return iceCache.servers;
  try {
    const response = await fetch('/api/calls/ice-servers');
    const data = await response.json();
    if (data.success && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      iceCache = { servers: data.iceServers, fetchedAt: Date.now() };
      return iceCache.servers;
    }
  } catch (error) {
    // On retombe sur le STUN public par defaut.
  }
  return iceCache.servers || DEFAULT_ICE_SERVERS;
}

export function useVoiceChannel({ socket, guildId, channelId, enabled }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | error
  const [errorMessage, setErrorMessage] = useState('');
  const [selfState, setSelfState] = useState({ muted: true, camera: false, screen: false });
  const [caps, setCaps] = useState({ canSpeak: true, canVideo: true, canScreenShare: true, canMuteOthers: false });
  // Flux video LOCAL (camera ou ecran) : apercu de sa propre camera / partage.
  const [localVideoStream, setLocalVideoStream] = useState(null);
  // socketId -> { userId, user, muted, camera, screen, stream }
  const [peers, setPeers] = useState(new Map());

  const pcsRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const sendersRef = useRef(new Map()); // socketId -> { audio, video }
  // socketId -> { offerer, queue, negotiating, pending, restartTimer, restarts }
  const metaRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const micStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const selfStateRef = useRef(selfState);
  const channelIdRef = useRef(channelId);
  const joinedRef = useRef(false);
  const negotiateRef = useRef(null);

  selfStateRef.current = selfState;
  channelIdRef.current = channelId;

  const setPeer = useCallback((socketId, patch) => {
    setPeers((prev) => {
      const next = new Map(prev);
      next.set(socketId, { ...(next.get(socketId) || {}), ...patch });
      return next;
    });
  }, []);

  const metaFor = useCallback((socketId, offerer) => {
    let meta = metaRef.current.get(socketId);
    if (!meta) {
      meta = { offerer: Boolean(offerer), queue: Promise.resolve(), negotiating: false, pending: null, restartTimer: null, restarts: 0 };
      metaRef.current.set(socketId, meta);
    }
    return meta;
  }, []);

  const closePeerResources = useCallback((socketId) => {
    const meta = metaRef.current.get(socketId);
    if (meta && meta.restartTimer) clearTimeout(meta.restartTimer);
    metaRef.current.delete(socketId);
    const pc = pcsRef.current.get(socketId);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      try {
        pc.close();
      } catch (error) {
        // deja ferme
      }
    }
    pcsRef.current.delete(socketId);
    sendersRef.current.delete(socketId);
    pendingCandidatesRef.current.delete(socketId);
  }, []);

  const removePeer = useCallback(
    (socketId) => {
      closePeerResources(socketId);
      setPeers((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    },
    [closePeerResources]
  );

  const sendSignal = useCallback(
    (targetSocketId, data) => {
      socket.emit('voice:signal', { channelId: channelIdRef.current, targetSocketId, data });
    },
    [socket]
  );

  const currentVideoTrack = useCallback(() => screenTrackRef.current || cameraTrackRef.current || null, []);

  const refreshLocalPreview = useCallback(() => {
    const track = screenTrackRef.current || cameraTrackRef.current || null;
    setLocalVideoStream(track ? new MediaStream([track]) : null);
  }, []);

  // Renegociation avec un pair. Seul l'OFFREUR de la paire fabrique des
  // offres ; l'autre lui en demande une ({ type: 'negotiate' }).
  const negotiate = useCallback(
    async (socketId, { iceRestart = false } = {}) => {
      const pc = pcsRef.current.get(socketId);
      const meta = metaRef.current.get(socketId);
      if (!pc || !meta) return;

      if (!meta.offerer) {
        sendSignal(socketId, { type: 'negotiate', iceRestart });
        return;
      }
      if (meta.negotiating || pc.signalingState !== 'stable') {
        meta.pending = { iceRestart: Boolean(iceRestart || (meta.pending && meta.pending.iceRestart)) };
        return;
      }
      meta.negotiating = true;
      try {
        const offer = await pc.createOffer({ iceRestart });
        await pc.setLocalDescription(offer);
        sendSignal(socketId, { type: 'offer', sdp: pc.localDescription });
      } catch (error) {
        meta.negotiating = false;
        console.warn('Renegociation vocale impossible', error);
      }
    },
    [sendSignal]
  );
  negotiateRef.current = negotiate;

  const attachCommonHandlers = useCallback(
    (pc, socketId) => {
      // Flux reconstruit a chaque nouvelle piste (voir callContext.jsx).
      pc.ontrack = (event) => {
        const known = pc.getReceivers().map((receiver) => receiver.track).filter(Boolean);
        const tracks = known.some((track) => track.id === event.track.id) ? known : [...known, event.track];
        setPeer(socketId, { stream: new MediaStream(tracks) });
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) sendSignal(socketId, { type: 'candidate', candidate: event.candidate.toJSON() });
      };

      const scheduleRestart = (delay) => {
        const meta = metaRef.current.get(socketId);
        if (!meta || meta.restartTimer) return;
        meta.restartTimer = setTimeout(() => {
          meta.restartTimer = null;
          if (pcsRef.current.get(socketId) !== pc || pc.connectionState === 'connected' || pc.connectionState === 'closed') return;
          if (meta.restarts >= MAX_ICE_RESTARTS) {
            removePeer(socketId);
            return;
          }
          meta.restarts += 1;
          if (negotiateRef.current) negotiateRef.current(socketId, { iceRestart: true });
        }, delay);
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        const meta = metaRef.current.get(socketId);
        if (state === 'connected') {
          if (meta) {
            meta.restarts = 0;
            if (meta.restartTimer) clearTimeout(meta.restartTimer);
            meta.restartTimer = null;
          }
        } else if (state === 'disconnected') {
          scheduleRestart(ICE_RESTART_DELAY_MS);
        } else if (state === 'failed') {
          scheduleRestart(300);
        }
      };
    },
    [removePeer, sendSignal, setPeer]
  );

  // Cote OFFREUR (nouvel arrivant) : transceivers crees dans un ordre fixe.
  const createOffererConnection = useCallback(
    async (socketId) => {
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle', iceCandidatePoolSize: 2 });
      metaFor(socketId, true);
      attachCommonHandlers(pc, socketId);

      const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
      const videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
      const audioTrack = micStreamRef.current ? micStreamRef.current.getAudioTracks()[0] : null;
      if (audioTrack) await audioTransceiver.sender.replaceTrack(audioTrack);
      const videoTrack = currentVideoTrack();
      if (videoTrack) await videoTransceiver.sender.replaceTrack(videoTrack);
      sendersRef.current.set(socketId, { audio: audioTransceiver.sender, video: videoTransceiver.sender });

      pcsRef.current.set(socketId, pc);
      return pc;
    },
    [attachCommonHandlers, currentVideoTrack, metaFor]
  );

  // Cote REPONDEUR : on applique d'abord l'offre (qui cree les transceivers),
  // puis on y attache nos pistes (voir bindLocalTracks).
  const createAnswererConnection = useCallback(
    async (socketId) => {
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle', iceCandidatePoolSize: 2 });
      metaFor(socketId, false);
      attachCommonHandlers(pc, socketId);
      pcsRef.current.set(socketId, pc);
      return pc;
    },
    [attachCommonHandlers, metaFor]
  );

  const bindLocalTracks = useCallback(
    async (pc, socketId) => {
      const audioTransceiver = pc.getTransceivers().find((tr) => tr.receiver.track.kind === 'audio');
      const videoTransceiver = pc.getTransceivers().find((tr) => tr.receiver.track.kind === 'video');
      const audioTrack = micStreamRef.current ? micStreamRef.current.getAudioTracks()[0] : null;
      if (audioTransceiver) {
        audioTransceiver.direction = 'sendrecv';
        if (audioTrack) await audioTransceiver.sender.replaceTrack(audioTrack);
      }
      if (videoTransceiver) {
        videoTransceiver.direction = 'sendrecv';
        await videoTransceiver.sender.replaceTrack(currentVideoTrack());
      }
      sendersRef.current.set(socketId, {
        audio: audioTransceiver ? audioTransceiver.sender : null,
        video: videoTransceiver ? videoTransceiver.sender : null
      });
    },
    [currentVideoTrack]
  );

  const flushCandidates = useCallback(async (socketId, pc) => {
    const queued = pendingCandidatesRef.current.get(socketId) || [];
    pendingCandidatesRef.current.delete(socketId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        // Candidat perime : sans consequence.
      }
    }
  }, []);

  const callPeer = useCallback(
    async (socketId) => {
      const pc = await createOffererConnection(socketId);
      await negotiate(socketId);
      return pc;
    },
    [createOffererConnection, negotiate]
  );

  const processSignal = useCallback(
    async (from, data) => {
      let pc = pcsRef.current.get(from);

      if (data.type === 'offer') {
        if (!pc) pc = await createAnswererConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await bindLocalTracks(pc, from);
        await flushCandidates(from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(from, { type: 'answer', sdp: pc.localDescription });
        return;
      }
      if (!pc) return;
      const meta = metaRef.current.get(from);

      if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await flushCandidates(from, pc);
        if (meta) {
          meta.negotiating = false;
          if (meta.pending) {
            const pending = meta.pending;
            meta.pending = null;
            negotiate(from, pending);
          }
        }
      } else if (data.type === 'negotiate') {
        if (meta && meta.offerer) negotiate(from, { iceRestart: Boolean(data.iceRestart) });
      } else if (data.type === 'candidate' && data.candidate) {
        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (error) {
            // Ignore.
          }
        } else {
          const queue = pendingCandidatesRef.current.get(from) || [];
          queue.push(data.candidate);
          pendingCandidatesRef.current.set(from, queue);
        }
      }
    },
    [bindLocalTracks, createAnswererConnection, flushCandidates, negotiate, sendSignal]
  );

  // Les messages d'un meme pair sont traites l'un apres l'autre.
  const handleSignal = useCallback(
    ({ from, data }) => {
      if (!data || !from) return;
      const existing = metaRef.current.get(from);
      const meta = existing || { queue: Promise.resolve() };
      const run = () => processSignal(from, data).catch((error) => console.warn('Signal vocal invalide', error));
      meta.queue = meta.queue.then(run);
      if (!existing && data.type === 'offer') {
        // La meta definitive est creee par createAnswererConnection : on
        // l'initialise ici pour que la file soit conservee.
        const created = metaFor(from, false);
        created.queue = meta.queue;
      }
    },
    [metaFor, processSignal]
  );

  const broadcastState = useCallback(
    (patch) => {
      const next = { ...selfStateRef.current, ...patch };
      selfStateRef.current = next;
      setSelfState(next);
      socket.emit('voice:state', { channelId: channelIdRef.current, state: next });
    },
    [socket]
  );

  const applyVideoTrackToAllPeers = useCallback(async () => {
    const track = currentVideoTrack();
    for (const [socketId, senders] of sendersRef.current.entries()) {
      if (senders.video) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await senders.video.replaceTrack(track);
        } catch (error) {
          console.warn(error);
        }
      }
      negotiate(socketId);
    }
  }, [currentVideoTrack, negotiate]);

  const teardownPeers = useCallback(() => {
    [...pcsRef.current.keys()].forEach(closePeerResources);
    pcsRef.current.clear();
    sendersRef.current.clear();
    metaRef.current.clear();
    pendingCandidatesRef.current.clear();
    setPeers(new Map());
  }, [closePeerResources]);

  const leave = useCallback(() => {
    if (channelIdRef.current && joinedRef.current) socket.emit('voice:leave', { channelId: channelIdRef.current });
    joinedRef.current = false;
    teardownPeers();
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    if (cameraTrackRef.current) cameraTrackRef.current.stop();
    cameraTrackRef.current = null;
    if (screenTrackRef.current) screenTrackRef.current.stop();
    screenTrackRef.current = null;
    setLocalVideoStream(null);
    setStatus('idle');
  }, [socket, teardownPeers]);

  useEffect(() => {
    if (!enabled || !socket || !channelId) return undefined;
    let cancelled = false;

    // Rejoint le salon cote serveur puis appelle chaque participant present.
    function joinRoom(isRejoin) {
      socket.emit('voice:join', { channelId }, async (result) => {
        if (cancelled) return;
        if (!result || !result.ok) {
          setErrorMessage(
            result?.reason === 'not_allowed' ? t("Vous n'avez pas la permission de rejoindre ce salon") : t("Impossible de rejoindre le salon vocal")
          );
          setStatus('error');
          return;
        }
        joinedRef.current = true;
        setCaps({ canSpeak: result.canSpeak, canVideo: result.canVideo, canScreenShare: result.canScreenShare, canMuteOthers: result.canMuteOthers });

        const previous = selfStateRef.current;
        const muted = isRejoin ? previous.muted || !result.canSpeak : !result.canSpeak;
        selfStateRef.current = { muted, camera: Boolean(cameraTrackRef.current), screen: Boolean(screenTrackRef.current) };
        setSelfState(selfStateRef.current);
        if (micStreamRef.current) {
          micStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = !muted;
          });
        }
        if (isRejoin) socket.emit('voice:state', { channelId, state: selfStateRef.current });

        result.peers.forEach((peer) => {
          setPeer(peer.socketId, { userId: peer.userId, user: peer.user, muted: peer.muted, camera: peer.camera, screen: peer.screen });
        });
        setStatus('connected');
        for (const peer of result.peers) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await callPeer(peer.socketId);
          } catch (error) {
            console.warn('Appel du pair impossible', error);
          }
        }
      });
    }

    async function connect() {
      setStatus('connecting');
      setErrorMessage('');
      try {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
        if (cancelled) {
          micStreamRef.current.getTracks().forEach((track) => track.stop());
          micStreamRef.current = null;
          return;
        }
        micStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false; // reactive apres la reponse du serveur (selon la permission de parler)
        });
        joinRoom(false);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error?.name === 'NotAllowedError' ? t("Acces au microphone refuse") : t("Impossible d'acceder au microphone")
          );
          setStatus('error');
        }
      }
    }

    // La socket s'est reconnectee : le serveur nous a retires du salon a la
    // deconnexion, on reconstruit les connexions et on le rejoint a nouveau.
    function onReconnect() {
      if (cancelled || !joinedRef.current) return;
      joinedRef.current = false;
      teardownPeers();
      setStatus('connecting');
      joinRoom(true);
    }

    connect();
    socket.on('connect', onReconnect);

    return () => {
      cancelled = true;
      socket.off('connect', onReconnect);
      leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, socket, channelId]);

  useEffect(() => {
    if (!socket) return undefined;
    const onPeerJoined = (payload) => {
      if (payload.channelId !== channelIdRef.current) return;
      setPeer(payload.socketId, { userId: payload.userId, user: payload.user, muted: payload.muted, camera: payload.camera, screen: payload.screen });
    };
    const onPeerLeft = (payload) => {
      if (payload.channelId !== channelIdRef.current) return;
      removePeer(payload.socketId);
    };
    const onSignal = (payload) => {
      if (payload.channelId !== channelIdRef.current) return;
      handleSignal(payload);
    };
    const onPeerState = (payload) => {
      if (payload.channelId !== channelIdRef.current) return;
      setPeer(payload.socketId, payload.state);
    };
    const onForceMuted = (payload) => {
      if (payload.channelId !== channelIdRef.current) return;
      if (micStreamRef.current) micStreamRef.current.getAudioTracks().forEach((track) => (track.enabled = false));
      broadcastState({ muted: true });
    };

    socket.on('voice:peer-joined', onPeerJoined);
    socket.on('voice:peer-left', onPeerLeft);
    socket.on('voice:signal', onSignal);
    socket.on('voice:peer-state', onPeerState);
    socket.on('voice:force-muted', onForceMuted);
    return () => {
      socket.off('voice:peer-joined', onPeerJoined);
      socket.off('voice:peer-left', onPeerLeft);
      socket.off('voice:signal', onSignal);
      socket.off('voice:peer-state', onPeerState);
      socket.off('voice:force-muted', onForceMuted);
    };
  }, [socket, setPeer, removePeer, handleSignal, broadcastState]);

  const toggleMute = useCallback(() => {
    if (!caps.canSpeak) return;
    const next = !selfStateRef.current.muted;
    if (micStreamRef.current) micStreamRef.current.getAudioTracks().forEach((track) => (track.enabled = !next));
    broadcastState({ muted: next });
  }, [broadcastState, caps.canSpeak]);

  const toggleCamera = useCallback(async () => {
    if (!caps.canVideo) return;
    if (selfStateRef.current.camera) {
      if (cameraTrackRef.current) cameraTrackRef.current.stop();
      cameraTrackRef.current = null;
      await applyVideoTrackToAllPeers();
      refreshLocalPreview();
      broadcastState({ camera: false });
      return;
    }
    try {
      setErrorMessage('');
      const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
      const [track] = stream.getVideoTracks();
      cameraTrackRef.current = track;
      track.onended = () => {
        if (selfStateRef.current.camera) toggleCamera();
      };
      await applyVideoTrackToAllPeers();
      refreshLocalPreview();
      broadcastState({ camera: true });
    } catch (error) {
      setErrorMessage(t("Impossible d'accéder à la caméra"));
    }
  }, [applyVideoTrackToAllPeers, broadcastState, caps.canVideo, refreshLocalPreview]);

  const toggleScreenShare = useCallback(async () => {
    if (!caps.canScreenShare) return;
    if (selfStateRef.current.screen) {
      if (screenTrackRef.current) {
        screenTrackRef.current.onended = null;
        screenTrackRef.current.stop();
      }
      screenTrackRef.current = null;
      await applyVideoTrackToAllPeers();
      refreshLocalPreview();
      broadcastState({ screen: false });
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setErrorMessage(t("Le partage d'écran n'est pas pris en charge par ce navigateur"));
      return;
    }
    let stream;
    try {
      setErrorMessage('');
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
    } catch (error) {
      // Annule par l'utilisateur dans la boite de dialogue du navigateur.
      if (error && error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        setErrorMessage(t("Impossible de démarrer le partage d'écran"));
      }
      return;
    }
    const [track] = stream.getVideoTracks();
    try {
      track.contentHint = 'detail';
    } catch (error) {
      // non supporte
    }
    screenTrackRef.current = track;
    // Bouton "Arreter le partage" du navigateur.
    track.onended = () => {
      if (selfStateRef.current.screen) toggleScreenShare();
    };
    await applyVideoTrackToAllPeers();
    refreshLocalPreview();
    broadcastState({ screen: true });
  }, [applyVideoTrackToAllPeers, broadcastState, caps.canScreenShare, refreshLocalPreview]);

  const muteUser = useCallback(
    (targetSocketId) => {
      if (!caps.canMuteOthers) return;
      socket.emit('voice:mute-user', { channelId: channelIdRef.current, targetSocketId });
    },
    [socket, caps.canMuteOthers]
  );

  return {
    status,
    errorMessage,
    selfState,
    caps,
    peers,
    localVideoStream,
    dismissError: () => setErrorMessage(''),
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    muteUser,
    leave
  };
}
