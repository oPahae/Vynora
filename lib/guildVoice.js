import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '@/lib/i18n/runtime';
// =====================================================================
// Salon vocal de serveur : maillage WebRTC complet.
// =====================================================================
// Chaque participant ouvre une RTCPeerConnection vers chaque AUTRE
// participant (voir server/guildVoiceSignaling.js pour la convention de
// negociation). Ce hook gere : media locaux (micro/camera/ecran),
// connexions pairs, et l'etat (mute/camera/ecran) de chacun.
//
// Volontairement local a la page serveur : quitter le salon (fermer
// l'onglet du salon vocal, changer de serveur) raccroche, contrairement
// aux appels 1-a-1 qui, eux, survivent a la navigation.
// =====================================================================

const ICE_CACHE_MS = 10 * 60 * 1000;
const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const VIDEO_CONSTRAINTS = { width: { ideal: 1280 }, height: { ideal: 720 } };

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
  // Flux video LOCAL (camera ou ecran) : sert uniquement a l'apercu de sa
  // propre camera / de son propre partage d'ecran dans l'interface.
  const [localVideoStream, setLocalVideoStream] = useState(null);
  // socketId -> { userId, user, muted, camera, screen, stream }
  const [peers, setPeers] = useState(new Map());

  const pcsRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const sendersRef = useRef(new Map()); // socketId -> { audio, video }
  const pendingCandidatesRef = useRef(new Map()); // socketId -> RTCIceCandidate[]
  const micStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const selfStateRef = useRef(selfState);
  const channelIdRef = useRef(channelId);

  selfStateRef.current = selfState;
  channelIdRef.current = channelId;

  const setPeer = useCallback((socketId, patch) => {
    setPeers((prev) => {
      const next = new Map(prev);
      next.set(socketId, { ...(next.get(socketId) || {}), ...patch });
      return next;
    });
  }, []);

  const removePeer = useCallback((socketId) => {
    const pc = pcsRef.current.get(socketId);
    if (pc) pc.close();
    pcsRef.current.delete(socketId);
    sendersRef.current.delete(socketId);
    pendingCandidatesRef.current.delete(socketId);
    setPeers((prev) => {
      const next = new Map(prev);
      next.delete(socketId);
      return next;
    });
  }, []);

  const sendSignal = useCallback(
    (targetSocketId, data) => {
      socket.emit('voice:signal', { channelId: channelIdRef.current, targetSocketId, data });
    },
    [socket]
  );

  const currentVideoTrack = useCallback(() => screenTrackRef.current || cameraTrackRef.current || null, []);

  // Met a jour l'apercu local d'apres la piste video actuellement envoyee.
  const refreshLocalPreview = useCallback(() => {
    const track = screenTrackRef.current || cameraTrackRef.current || null;
    setLocalVideoStream(track ? new MediaStream([track]) : null);
  }, []);

  // Prepare les gestionnaires communs (piste distante, ICE, etat de
  // connexion) sur une RTCPeerConnection fraichement creee.
  const attachCommonHandlers = useCallback(
    (pc, socketId) => {
      const remoteStream = new MediaStream();
      setPeer(socketId, { stream: remoteStream });
      pc.ontrack = (event) => {
        if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) remoteStream.addTrack(event.track);
        setPeer(socketId, { stream: remoteStream });
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) sendSignal(socketId, { type: 'candidate', candidate: event.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') removePeer(socketId);
      };
    },
    [removePeer, sendSignal, setPeer]
  );

  // Cote OFFREUR (nouvel arrivant qui appelle un pair deja present) : on
  // cree nous-memes les transceivers, dans un ordre fixe (audio puis
  // video), avant de generer l'offre.
  const createOffererConnection = useCallback(
    async (socketId) => {
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
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
    [attachCommonHandlers, currentVideoTrack]
  );

  // Cote REPONDEUR (on recoit une offre) : on NE cree PAS nos propres
  // transceivers a l'avance. On applique d'abord l'offre distante (qui
  // cree automatiquement les transceivers correspondant a ses m-lines),
  // puis on recupere CES transceivers via getTransceivers() pour y
  // attacher nos pistes locales. Creer ses propres transceivers avant
  // setRemoteDescription (comme le fait createOffererConnection) peut,
  // selon le navigateur, donner des transceivers qui ne s'associent pas
  // exactement aux m-lines de l'offre : c'etait la cause du bug ou la
  // camera/le partage d'ecran ne s'affichaient jamais chez les autres.
  const createAnswererConnection = useCallback(
    async (socketId) => {
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      attachCommonHandlers(pc, socketId);
      pcsRef.current.set(socketId, pc);
      return pc;
    },
    [attachCommonHandlers]
  );

  // Attache les pistes locales courantes aux transceivers deja negocies
  // (utilise juste apres setRemoteDescription cote repondeur).
  const bindLocalTracks = useCallback(
    async (pc, socketId) => {
      const audioTransceiver = pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio');
      const videoTransceiver = pc.getTransceivers().find((t) => t.receiver.track.kind === 'video');
      const audioTrack = micStreamRef.current ? micStreamRef.current.getAudioTracks()[0] : null;
      if (audioTransceiver) {
        audioTransceiver.direction = 'sendrecv';
        if (audioTrack) await audioTransceiver.sender.replaceTrack(audioTrack);
      }
      if (videoTransceiver) {
        videoTransceiver.direction = 'sendrecv';
        const videoTrack = currentVideoTrack();
        if (videoTrack) await videoTransceiver.sender.replaceTrack(videoTrack);
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

  // Le nouvel arrivant envoie l'offre a un pair deja present.
  const callPeer = useCallback(
    async (socketId) => {
      const pc = await createOffererConnection(socketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(socketId, { type: 'offer', sdp: pc.localDescription });
    },
    [createOffererConnection, sendSignal]
  );

  const handleSignal = useCallback(
    async ({ from, data }) => {
      if (!data) return;
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
      if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await flushCandidates(from, pc);
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
    [bindLocalTracks, createAnswererConnection, flushCandidates, sendSignal]
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
    for (const senders of sendersRef.current.values()) {
      if (senders.video) await senders.video.replaceTrack(track);
    }
  }, [currentVideoTrack]);

  const leave = useCallback(() => {
    if (channelIdRef.current) socket.emit('voice:leave', { channelId: channelIdRef.current });
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    sendersRef.current.clear();
    pendingCandidatesRef.current.clear();
    setPeers(new Map());
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    if (cameraTrackRef.current) cameraTrackRef.current.stop();
    cameraTrackRef.current = null;
    if (screenTrackRef.current) screenTrackRef.current.stop();
    screenTrackRef.current = null;
    setLocalVideoStream(null);
    setStatus('idle');
  }, [socket]);

  useEffect(() => {
    if (!enabled || !socket || !channelId) return undefined;
    let cancelled = false;

    async function connect() {
      setStatus('connecting');
      setErrorMessage('');
      try {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false; // reactive apres la reponse du serveur (selon la permission de parler)
        });

        socket.emit('voice:join', { channelId }, async (result) => {
          if (cancelled) return;
          if (!result || !result.ok) {
            setErrorMessage(
              result?.reason === 'not_allowed' ? t("Vous n'avez pas la permission de rejoindre ce salon") : t("Impossible de rejoindre le salon vocal")
            );
            setStatus('error');
            return;
          }
          setCaps({ canSpeak: result.canSpeak, canVideo: result.canVideo, canScreenShare: result.canScreenShare, canMuteOthers: result.canMuteOthers });
          selfStateRef.current = { muted: !result.canSpeak, camera: false, screen: false };
          setSelfState(selfStateRef.current);
          // L'etat affiche (et annonce aux autres par le serveur) est
          // "micro actif" si la permission de parler est accordee : la piste
          // audio doit donc etre reellement activee, sinon personne
          // n'entendrait rien tant qu'on n'a pas coupe/reactive le micro.
          if (micStreamRef.current) {
            micStreamRef.current.getAudioTracks().forEach((track) => {
              track.enabled = Boolean(result.canSpeak);
            });
          }
          result.peers.forEach((peer) => {
            setPeer(peer.socketId, { userId: peer.userId, user: peer.user, muted: peer.muted, camera: peer.camera, screen: peer.screen });
          });
          setStatus('connected');
          for (const peer of result.peers) {
            // eslint-disable-next-line no-await-in-loop
            await callPeer(peer.socketId);
          }
        });
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error?.name === 'NotAllowedError' ? t("Acces au microphone refuse") : t("Impossible d'acceder au microphone")
          );
          setStatus('error');
        }
      }
    }
    connect();

    return () => {
      cancelled = true;
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
      // Le partage d'ecran reste prioritaire tant qu'il est actif.
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
      if (screenTrackRef.current) screenTrackRef.current.stop();
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
    try {
      setErrorMessage('');
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const [track] = stream.getVideoTracks();
      screenTrackRef.current = track;
      // Bouton "Arreter le partage" du navigateur.
      track.onended = () => {
        if (selfStateRef.current.screen) toggleScreenShare();
      };
      await applyVideoTrackToAllPeers();
      refreshLocalPreview();
      broadcastState({ screen: true });
    } catch (error) {
      // Annule par l'utilisateur dans la boite de dialogue du navigateur.
    }
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
