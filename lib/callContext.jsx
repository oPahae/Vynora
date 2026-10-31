import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useSocket } from '@/lib/socketContext';
import { useToast } from '@/lib/toastContext';
import { startRingtone, startRingback, playEndTone } from '@/lib/callSounds';

import { t } from '@/lib/i18n/runtime';
// Gestion globale des appels audio / video / partage d'ecran (WebRTC).
//
// - La signalisation (sonnerie, offre/reponse, candidats ICE) passe par
//   Socket.IO (voir server/callSignaling.js) ; les flux, eux, circulent en
//   pair-a-pair entre les deux navigateurs.
// - Le fournisseur est place dans _app.jsx : un appel entrant sonne sur
//   n'importe quelle page et un appel en cours survit a la navigation.
// - Les transceivers audio ET video sont crees des le debut de l'appel : la
//   camera ou le partage d'ecran peuvent ainsi etre actives/coupes a tout
//   moment avec `replaceTrack`, sans renegociation.

const CallContext = createContext(null);

const ENDED_DISPLAY_MS = 2500;
const RECONNECT_GRACE_MS = 15000;
const ICE_CACHE_MS = 10 * 60 * 1000;
const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const DEFAULT_REMOTE_MEDIA = { audio: true, camera: false, screen: false };
const VIDEO_CONSTRAINTS = { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };

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
    // on retombe sur les serveurs par defaut
  }
  return iceCache.servers || DEFAULT_ICE_SERVERS;
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (value) => String(value).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function describeMediaError(error, device = 'micro') {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return t("Les appels necessitent une connexion securisee (HTTPS).");
  }
  switch (error && error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return t("Acces au {device} refuse. Autorisez-le dans les parametres de votre navigateur.", { device });
    case 'NotFoundError':
    case 'OverconstrainedError':
      return t("Aucun {device} detecte sur cet appareil.", { device });
    case 'NotReadableError':
      return t("Le {device} est deja utilise par une autre application.", { device });
    default:
      return t("Impossible d'acceder au {device}.", { device });
  }
}

async function acquireMedia(kind) {
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

  if (kind === 'video') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video: VIDEO_CONSTRAINTS });
      return { stream, cameraFailed: false };
    } catch (error) {
      // Camera refusee ou absente : on tente le micro seul (l'erreur du micro,
      // s'il echoue aussi, est propagee a l'appelant).
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      return { stream, cameraFailed: true };
    }
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio });
  return { stream, cameraFailed: false };
}

function stopTrack(track) {
  if (!track) return;
  try {
    track.onended = null;
    track.stop();
  } catch (error) {
    // deja arrete
  }
}

export function CallProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { showToast } = useToast();

  const [phase, setPhaseState] = useState('idle'); // idle | outgoing | incoming | connecting | active | ended
  const [call, setCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [remoteMedia, setRemoteMedia] = useState(DEFAULT_REMOTE_MEDIA);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localCameraStream, setLocalCameraStream] = useState(null);
  const [duration, setDuration] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [endedMessage, setEndedMessage] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [canShareScreen, setCanShareScreen] = useState(false);

  const socketRef = useRef(null);
  const phaseRef = useRef('idle');
  const callRef = useRef(null);
  const pcRef = useRef(null);
  const micStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const sendersRef = useRef({});
  const remoteStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const signalChainRef = useRef(Promise.resolve());
  const stopRingRef = useRef(null);
  const mutedRef = useRef(false);
  const durationTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const endedTimerRef = useRef(null);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    setCanShareScreen(
      typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
    );
  }, []);

  const setPhase = useCallback((next) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const toastError = useCallback(
    (message) => {
      showToast({ title: t("Appel"), message, type: 'error', playSound: false });
    },
    [showToast]
  );

  const stopRing = useCallback(() => {
    if (stopRingRef.current) {
      stopRingRef.current();
      stopRingRef.current = null;
    }
  }, []);

  const isFree = useCallback(() => phaseRef.current === 'idle' || phaseRef.current === 'ended', []);

  // ---------------------------------------------------------------------------
  // Nettoyage complet (flux, connexion, minuteurs, etat React)
  // ---------------------------------------------------------------------------
  const resetToIdle = useCallback(() => {
    setPhase('idle');
    setCall(null);
    setEndedMessage('');
    setDuration(0);
  }, [setPhase]);

  const teardown = useCallback(
    (message) => {
      stopRing();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
      durationTimerRef.current = null;
      reconnectTimerRef.current = null;
      endedTimerRef.current = null;

      const pc = pcRef.current;
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
      pcRef.current = null;

      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(stopTrack);
      stopTrack(cameraTrackRef.current);
      stopTrack(screenTrackRef.current);
      micStreamRef.current = null;
      cameraTrackRef.current = null;
      screenTrackRef.current = null;
      sendersRef.current = {};
      remoteStreamRef.current = null;
      pendingCandidatesRef.current = [];
      signalChainRef.current = Promise.resolve();
      mutedRef.current = false;
      callRef.current = null;

      setRemoteStream(null);
      setLocalCameraStream(null);
      setIsMuted(false);
      setCameraOn(false);
      setScreenSharing(false);
      setRemoteMedia(DEFAULT_REMOTE_MEDIA);
      setIsReconnecting(false);
      setMinimized(false);

      if (!message) {
        resetToIdle();
        return;
      }

      setEndedMessage(message);
      setPhase('ended');
      playEndTone();
      endedTimerRef.current = setTimeout(() => {
        endedTimerRef.current = null;
        resetToIdle();
      }, ENDED_DISPLAY_MS);
    },
    [resetToIdle, setPhase, stopRing]
  );

  // Termine l'appel courant. `reason` sert a choisir le message affiche.
  const finishCall = useCallback(
    (reason, { notifyServer = false } = {}) => {
      const current = callRef.current;
      if (!current || current.finished) return;
      current.finished = true;

      if (notifyServer && current.callId && socketRef.current) {
        socketRef.current.emit('call:end', { callId: current.callId });
      }

      const who = current.peer?.firstName || t("Votre correspondant");
      const wasConnected = Boolean(current.connectedAt);
      const elapsed = wasConnected ? Math.floor((Date.now() - current.connectedAt) / 1000) : 0;
      let message;

      switch (reason) {
        case 'declined':
          message = t("{who} a refuse l'appel", { who });
          break;
        case 'missed':
          message = current.role === 'caller' ? t("{who} n'a pas repondu", { who }) : t("Appel manque de {who}", { who });
          break;
        case 'cancelled':
          message = current.role === 'callee' ? t("Appel manque de {who}", { who }) : t("Appel annule");
          break;
        case 'disconnected':
          message = t("Votre correspondant s'est deconnecte");
          break;
        case 'connection_failed':
          message = t("La connexion a echoue");
          break;
        case 'connection_lost':
          message = t("Connexion perdue");
          break;
        case 'error':
          message = t("Une erreur est survenue pendant l'appel");
          break;
        case 'ended':
        default:
          message = wasConnected
            ? t("Appel termine - {formatDuration}", { formatDuration: formatDuration(elapsed) })
            : current.role === 'caller'
              ? t("Appel annule")
              : t("Appel termine");
      }

      teardown(message);
    },
    [teardown]
  );

  // Abandon silencieux (erreur locale avant le debut de l'appel, etc.).
  const abortSilently = useCallback(
    (current) => {
      if (current) current.finished = true;
      teardown('');
    },
    [teardown]
  );

  // ---------------------------------------------------------------------------
  // Signalisation
  // ---------------------------------------------------------------------------
  const sendSignal = useCallback((data) => {
    const current = callRef.current;
    if (!current || !current.callId || !socketRef.current) return;
    socketRef.current.emit('call:signal', { callId: current.callId, data });
  }, []);

  // Informe le correspondant de l'etat de mon micro / camera / partage d'ecran.
  const sendMediaState = useCallback(() => {
    const current = callRef.current;
    if (!current || !current.callId || !socketRef.current) return;
    const sharing = Boolean(screenTrackRef.current);
    socketRef.current.emit('call:state', {
      callId: current.callId,
      state: {
        audio: !mutedRef.current,
        camera: Boolean(cameraTrackRef.current) && !sharing,
        screen: sharing
      }
    });
  }, []);

  const markActive = useCallback(() => {
    const current = callRef.current;
    if (!current || phaseRef.current === 'active') return;
    stopRing();
    current.connectedAt = Date.now();
    setPhase('active');
    setDuration(0);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = setInterval(() => {
      const c = callRef.current;
      if (c && c.connectedAt) setDuration(Math.floor((Date.now() - c.connectedAt) / 1000));
    }, 1000);
    sendMediaState();
  }, [sendMediaState, setPhase, stopRing]);

  const createPeerConnection = useCallback(async () => {
    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });
    const remote = new MediaStream();

    remoteStreamRef.current = remote;
    setRemoteStream(remote);

    pc.ontrack = (event) => {
      if (!remote.getTracks().some((track) => track.id === event.track.id)) {
        remote.addTrack(event.track);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal({ type: 'candidate', candidate: event.candidate.toJSON() });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
        setIsReconnecting(false);
        markActive();
      } else if (state === 'disconnected') {
        setIsReconnecting(true);
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (pcRef.current === pc && pc.connectionState !== 'connected') {
              finishCall('connection_lost', { notifyServer: true });
            }
          }, RECONNECT_GRACE_MS);
        }
      } else if (state === 'failed') {
        finishCall('connection_failed', { notifyServer: true });
      }
    };

    pcRef.current = pc;
    return pc;
  }, [finishCall, markActive, sendSignal]);

  // Cote appele : apres setRemoteDescription(offre), on branche nos pistes
  // locales sur les transceivers crees par l'offre.
  const bindLocalTracks = useCallback(async (pc) => {
    const audioTrack = micStreamRef.current ? micStreamRef.current.getAudioTracks()[0] || null : null;
    const videoTrack = screenTrackRef.current || cameraTrackRef.current || null;

    for (const transceiver of pc.getTransceivers()) {
      const kind = transceiver.receiver && transceiver.receiver.track ? transceiver.receiver.track.kind : null;
      if (kind !== 'audio' && kind !== 'video') continue;
      transceiver.direction = 'sendrecv';
      if (kind === 'audio') {
        sendersRef.current.audio = transceiver.sender;
        await transceiver.sender.replaceTrack(audioTrack);
      } else {
        sendersRef.current.video = transceiver.sender;
        await transceiver.sender.replaceTrack(videoTrack);
      }
    }
  }, []);

  const flushCandidates = useCallback(async (pc) => {
    const queued = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Candidat ICE ignore', error);
      }
    }
  }, []);

  const processSignal = useCallback(
    async (current, data) => {
      const pc = pcRef.current;
      if (!pc || current.finished || !data) return;

      if (data.type === 'offer') {
        await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        await bindLocalTracks(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: 'answer', sdp: pc.localDescription.sdp });
        await flushCandidates(pc);
      } else if (data.type === 'answer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        await flushCandidates(pc);
      } else if (data.type === 'candidate' && data.candidate) {
        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (error) {
            console.warn('Candidat ICE ignore', error);
          }
        } else {
          pendingCandidatesRef.current.push(data.candidate);
        }
      }
    },
    [bindLocalTracks, flushCandidates, sendSignal]
  );

  // ---------------------------------------------------------------------------
  // Medias locaux
  // ---------------------------------------------------------------------------
  const attachCameraTrack = useCallback((track) => {
    cameraTrackRef.current = track;
    setCameraOn(Boolean(track));
    setLocalCameraStream(track ? new MediaStream([track]) : null);
    if (track) {
      // Camera debranchee / coupee par le systeme.
      track.onended = () => {
        if (cameraTrackRef.current !== track) return;
        cameraTrackRef.current = null;
        setCameraOn(false);
        setLocalCameraStream(null);
        if (!screenTrackRef.current && sendersRef.current.video) {
          sendersRef.current.video.replaceTrack(null).catch(() => {});
        }
        sendMediaState();
      };
    }
  }, [sendMediaState]);

  const installLocalMedia = useCallback(
    ({ stream }) => {
      micStreamRef.current = new MediaStream(stream.getAudioTracks());
      mutedRef.current = false;
      setIsMuted(false);
      attachCameraTrack(stream.getVideoTracks()[0] || null);
    },
    [attachCameraTrack]
  );

  // ---------------------------------------------------------------------------
  // Actions exposees a l'interface
  // ---------------------------------------------------------------------------
  const startCall = useCallback(
    async (peer, conversationId, kind = 'voice') => {
      const sock = socketRef.current;
      if (!sock || !sock.connected) {
        toastError(t("Connexion temps reel indisponible, veuillez reessayer."));
        return;
      }
      if (!isFree()) {
        toastError(t("Vous etes deja en communication."));
        return;
      }
      if (
        typeof window === 'undefined' ||
        !window.isSecureContext ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia ||
        typeof RTCPeerConnection === 'undefined'
      ) {
        toastError(t("Les appels necessitent un navigateur recent et une connexion securisee (HTTPS)."));
        return;
      }

      if (endedTimerRef.current) {
        clearTimeout(endedTimerRef.current);
        endedTimerRef.current = null;
      }

      const callObj = { callId: null, kind, conversationId, peer, role: 'caller', finished: false, connectedAt: null };
      callRef.current = callObj;
      setCall({ callId: null, kind, conversationId, peer, role: 'caller' });
      setEndedMessage('');
      setRemoteMedia(DEFAULT_REMOTE_MEDIA);
      setPhase('outgoing');
      getIceServers(); // prechauffe le cache

      let media;
      try {
        media = await acquireMedia(kind);
      } catch (error) {
        if (!callObj.finished) {
          abortSilently(callObj);
          toastError(describeMediaError(error));
        }
        return;
      }

      if (callObj.finished) {
        media.stream.getTracks().forEach(stopTrack);
        return;
      }

      installLocalMedia(media);
      if (media.cameraFailed) {
        toastError(t("Camera indisponible : l'appel se fait en audio uniquement."));
      }

      sock.timeout(8000).emit('call:invite', { conversationId, toUserId: peer.id, kind }, (err, res) => {
        if (callObj.finished) {
          // Annule entre-temps : on previent le serveur pour qu'il arrete la sonnerie.
          if (!err && res && res.ok) sock.emit('call:end', { callId: res.callId });
          return;
        }

        if (err || !res || !res.ok) {
          const reason = res && res.reason;
          let message = t("Impossible de lancer l'appel.");
          if (reason === 'offline') message = t("{firstName} n'est pas en ligne.", { firstName: peer.firstName });
          else if (reason === 'busy') message = t("{firstName} est deja en communication.", { firstName: peer.firstName });
          else if (reason === 'self_busy') message = t("Vous etes deja en communication (autre onglet ?).");
          else if (reason === 'not_allowed') message = t("Appel impossible avec cet utilisateur.");
          abortSilently(callObj);
          toastError(message);
          return;
        }

        callObj.callId = res.callId;
        setCall((prev) => (prev ? { ...prev, callId: res.callId } : prev));
        stopRing();
        stopRingRef.current = startRingback();
      });
    },
    [abortSilently, installLocalMedia, isFree, setPhase, stopRing, toastError]
  );

  const acceptCall = useCallback(async () => {
    const current = callRef.current;
    const sock = socketRef.current;
    if (!current || !sock || current.role !== 'callee' || phaseRef.current !== 'incoming') return;

    stopRing();
    setPhase('connecting');

    let media;
    try {
      media = await acquireMedia(current.kind);
    } catch (error) {
      if (!current.finished) {
        sock.emit('call:decline', { callId: current.callId });
        abortSilently(current);
        toastError(describeMediaError(error));
      }
      return;
    }

    if (current.finished) {
      media.stream.getTracks().forEach(stopTrack);
      return;
    }

    installLocalMedia(media);
    if (media.cameraFailed) {
      toastError(t("Camera indisponible : l'appel se fait en audio uniquement."));
    }

    try {
      await createPeerConnection();
    } catch (error) {
      console.error(error);
      sock.emit('call:decline', { callId: current.callId });
      abortSilently(current);
      toastError(t("Impossible d'initialiser l'appel."));
      return;
    }

    if (current.finished) return;

    sock.timeout(8000).emit('call:accept', { callId: current.callId }, (err, res) => {
      if (current.finished) return;
      if (err || !res || !res.ok) {
        abortSilently(current);
        toastError(t("Cet appel n'est plus disponible."));
      }
    });
  }, [abortSilently, createPeerConnection, installLocalMedia, setPhase, stopRing, toastError]);

  const declineCall = useCallback(() => {
    const current = callRef.current;
    if (!current || current.role !== 'callee' || phaseRef.current !== 'incoming') return;
    if (socketRef.current) socketRef.current.emit('call:decline', { callId: current.callId });
    abortSilently(current);
  }, [abortSilently]);

  const endCall = useCallback(() => {
    finishCall('ended', { notifyServer: true });
  }, [finishCall]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
    setIsMuted(next);
    sendMediaState();
  }, [sendMediaState]);

  const toggleCamera = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.finished) return;

    if (cameraTrackRef.current) {
      stopTrack(cameraTrackRef.current);
      attachCameraTrack(null);
      if (!screenTrackRef.current && sendersRef.current.video) {
        try {
          await sendersRef.current.video.replaceTrack(null);
        } catch (error) {
          console.warn(error);
        }
      }
      sendMediaState();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
      const track = stream.getVideoTracks()[0];
      if (callRef.current !== current || current.finished) {
        stopTrack(track);
        return;
      }
      attachCameraTrack(track);
      if (!screenTrackRef.current && sendersRef.current.video) {
        await sendersRef.current.video.replaceTrack(track);
      }
      sendMediaState();
    } catch (error) {
      toastError(describeMediaError(error, 'camera'));
    }
  }, [attachCameraTrack, sendMediaState, toastError]);

  const stopScreenShare = useCallback(async () => {
    const track = screenTrackRef.current;
    if (!track) return;
    screenTrackRef.current = null;
    stopTrack(track);
    setScreenSharing(false);
    if (sendersRef.current.video) {
      try {
        // On revient a la camera si elle est allumee, sinon plus de video.
        await sendersRef.current.video.replaceTrack(cameraTrackRef.current || null);
      } catch (error) {
        console.warn(error);
      }
    }
    sendMediaState();
  }, [sendMediaState]);

  const startScreenShare = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.finished || screenTrackRef.current || !sendersRef.current.video) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      toastError(t("Le partage d'ecran n'est pas disponible sur cet appareil."));
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false
      });
    } catch (error) {
      // NotAllowedError = l'utilisateur a ferme le selecteur : pas une erreur.
      if (error && error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        toastError(t("Impossible de demarrer le partage d'ecran."));
      }
      return;
    }

    const track = stream.getVideoTracks()[0];
    if (!track || callRef.current !== current || current.finished || !sendersRef.current.video) {
      stopTrack(track);
      return;
    }

    try {
      track.contentHint = 'detail'; // privilegie la nettete du texte
    } catch (error) {
      // non supporte
    }
    // Bouton natif du navigateur "Arreter le partage".
    track.onended = () => {
      stopScreenShare();
    };

    screenTrackRef.current = track;
    setScreenSharing(true);
    try {
      await sendersRef.current.video.replaceTrack(track);
    } catch (error) {
      console.error(error);
      stopScreenShare();
      toastError(t("Impossible de demarrer le partage d'ecran."));
      return;
    }
    sendMediaState();
  }, [sendMediaState, stopScreenShare, toastError]);

  const toggleScreenShare = useCallback(() => {
    if (screenTrackRef.current) stopScreenShare();
    else startScreenShare();
  }, [startScreenShare, stopScreenShare]);

  // ---------------------------------------------------------------------------
  // Evenements Socket.IO
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return undefined;

    function onIncoming({ callId, kind, conversationId, caller }) {
      if (!isFree()) return;
      if (endedTimerRef.current) {
        clearTimeout(endedTimerRef.current);
        endedTimerRef.current = null;
      }
      callRef.current = { callId, kind, conversationId, peer: caller, role: 'callee', finished: false, connectedAt: null };
      setCall({ callId, kind, conversationId, peer: caller, role: 'callee' });
      setEndedMessage('');
      setRemoteMedia(DEFAULT_REMOTE_MEDIA);
      setPhase('incoming');
      stopRing();
      stopRingRef.current = startRingtone();
    }

    // Cote appelant : le destinataire a decroche, on lance la negociation.
    async function onAccepted({ callId }) {
      const current = callRef.current;
      if (!current || current.callId !== callId || current.role !== 'caller' || current.finished) return;

      stopRing();
      setPhase('connecting');

      try {
        const pc = await createPeerConnection();
        const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
        const videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
        sendersRef.current = { audio: audioTransceiver.sender, video: videoTransceiver.sender };

        await audioTransceiver.sender.replaceTrack(
          micStreamRef.current ? micStreamRef.current.getAudioTracks()[0] || null : null
        );
        await videoTransceiver.sender.replaceTrack(screenTrackRef.current || cameraTrackRef.current || null);
        if (current.finished) return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({ type: 'offer', sdp: pc.localDescription.sdp });
      } catch (error) {
        console.error('Negociation WebRTC impossible', error);
        finishCall('error', { notifyServer: true });
      }
    }

    function onSignal({ callId, data }) {
      const current = callRef.current;
      if (!current || current.callId !== callId) return;
      signalChainRef.current = signalChainRef.current
        .then(() => processSignal(current, data))
        .catch((error) => {
          console.error('Signal WebRTC invalide', error);
          finishCall('error', { notifyServer: true });
        });
    }

    function onPeerState({ callId, state }) {
      const current = callRef.current;
      if (!current || current.callId !== callId || !state) return;
      setRemoteMedia({ audio: state.audio !== false, camera: state.camera === true, screen: state.screen === true });
    }

    function onEnded({ callId, reason }) {
      const current = callRef.current;
      if (!current || current.callId !== callId) return;
      finishCall(reason || 'ended');
    }

    // Un autre onglet a decroche / refuse : on arrete de sonner ici.
    function onHandled({ callId }) {
      const current = callRef.current;
      if (!current || current.callId !== callId || phaseRef.current !== 'incoming') return;
      abortSilently(current);
    }

    function onSocketDisconnect() {
      if (callRef.current) finishCall('connection_lost');
    }

    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:signal', onSignal);
    socket.on('call:peer-state', onPeerState);
    socket.on('call:ended', onEnded);
    socket.on('call:handled', onHandled);
    socket.on('disconnect', onSocketDisconnect);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:signal', onSignal);
      socket.off('call:peer-state', onPeerState);
      socket.off('call:ended', onEnded);
      socket.off('call:handled', onHandled);
      socket.off('disconnect', onSocketDisconnect);
    };
  }, [
    abortSilently,
    createPeerConnection,
    finishCall,
    isFree,
    processSignal,
    sendSignal,
    setPhase,
    socket,
    stopRing
  ]);

  // Deconnexion de l'utilisateur : on coupe tout.
  useEffect(() => {
    if (!user && callRef.current) abortSilently(callRef.current);
  }, [user, abortSilently]);

  // Demontage du fournisseur : liberer micro / camera.
  useEffect(
    () => () => {
      if (callRef.current) callRef.current.finished = true;
      stopRing();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (endedTimerRef.current) clearTimeout(endedTimerRef.current);
      if (pcRef.current) pcRef.current.close();
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(stopTrack);
      stopTrack(cameraTrackRef.current);
      stopTrack(screenTrackRef.current);
    },
    [stopRing]
  );

  const value = {
    phase,
    call,
    isMuted,
    cameraOn,
    screenSharing,
    remoteMedia,
    remoteStream,
    localCameraStream,
    duration,
    isReconnecting,
    endedMessage,
    minimized,
    setMinimized,
    canShareScreen,
    isInCall: phase !== 'idle' && phase !== 'ended',
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error(t("useCall doit etre utilise a l'interieur de CallProvider"));
  }
  return context;
}
