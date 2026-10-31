import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  MonitorOff,
  Minimize2,
  Maximize2,
  Loader2
} from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import { useCall, formatDuration } from '@/lib/callContext';

import { t } from '@/lib/i18n/runtime';
// Couleurs en valeurs arbitraires Tailwind : le mode sombre de l'application
// redefinit `.bg-surface` / `.text-slate-900`, ce qui casserait ces boutons.
const ACTIVE_BUTTON = 'bg-[#ffffff] text-[#0f172a] hover:bg-[#e2e8f0]';
const IDLE_BUTTON = 'bg-white/15 text-white hover:bg-white/25';

function ControlButton({ onClick, label, tone = 'idle', disabled = false, children }) {
  const toneClasses =
    tone === 'danger'
      ? 'bg-red-500 text-white hover:bg-red-600'
      : tone === 'success'
        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
        : tone === 'active'
          ? ACTIVE_BUTTON
          : IDLE_BUTTON;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${toneClasses}`}
    >
      {children}
    </button>
  );
}

function IncomingCall({ call, onAccept, onDecline }) {
  const { peer, kind } = call;
  return (
    <motion.div
      initial={{ opacity: 0, y: -40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -40 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className="fixed top-4 inset-x-4 z-[90] mx-auto max-w-sm bg-ink text-white rounded-3xl shadow-card border border-white/10 p-4 flex items-center gap-3"
      role="alertdialog"
      aria-label={t("Appel entrant de {firstName} {lastName}", { firstName: peer.firstName, lastName: peer.lastName })}
    >
      <div className="relative shrink-0">
        <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
        <Avatar src={peer.avatar} firstName={peer.firstName} lastName={peer.lastName} size="lg" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold truncate">
          {peer.firstName} {peer.lastName}{peer.verified && <VerifiedBadge size={14} />}
        </p>
        <p className="text-xs text-white/60">{kind === 'video' ? t("Appel video entrant") : t("Appel vocal entrant")}</p>
      </div>
      <button
        type="button"
        onClick={onDecline}
        aria-label={t("Refuser l'appel")}
        title={t("Refuser")}
        className="w-12 h-12 shrink-0 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
      >
        <PhoneOff size={20} />
      </button>
      <button
        type="button"
        onClick={onAccept}
        aria-label={t("Accepter l'appel")}
        title={t("Accepter")}
        className="w-12 h-12 shrink-0 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-colors"
      >
        {kind === 'video' ? <Video size={20} /> : <Phone size={20} />}
      </button>
    </motion.div>
  );
}

export default function CallOverlay() {
  const {
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
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare
  } = useCall();

  const audioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);

  const hasCall = Boolean(call) && phase !== 'idle';
  const isFullScreen = hasCall && phase !== 'incoming' && !minimized;
  const showRemoteVideo = Boolean(remoteStream) && (remoteMedia.camera || remoteMedia.screen);

  // Le son du correspondant passe par une balise <audio> toujours montee
  // (meme quand l'appel est reduit), la balise <video> sert uniquement a l'image.
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.srcObject = remoteStream || null;
    if (remoteStream) element.play().catch(() => {});
  }, [remoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
      if (remoteStream) remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, isFullScreen]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localCameraStream || null;
      if (localCameraStream) localVideoRef.current.play().catch(() => {});
    }
  }, [localCameraStream, isFullScreen]);

  let statusText = '';
  if (phase === 'outgoing') statusText = call?.callId ? t("Appel en cours...") : t("Demarrage de l'appel...");
  else if (phase === 'connecting') statusText = t("Connexion...");
  else if (phase === 'active') statusText = isReconnecting ? t("Reconnexion...") : formatDuration(duration);
  else if (phase === 'ended') statusText = endedMessage;

  const isEnded = phase === 'ended';
  const canHangUp = phase === 'outgoing' || phase === 'connecting' || phase === 'active';
  const inCallControls = phase === 'active' || phase === 'connecting' || phase === 'outgoing';
  const peer = call?.peer;

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline />

      <AnimatePresence>
        {hasCall && phase === 'incoming' && (
          <IncomingCall key="incoming" call={call} onAccept={acceptCall} onDecline={declineCall} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFullScreen && peer && (
          <motion.div
            key="fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] bg-slate-950 text-white flex flex-col"
          >
            <div className="relative flex-1 min-h-0 overflow-hidden">
              <video
                ref={remoteVideoRef}
                muted
                playsInline
                autoPlay
                className={`absolute inset-0 w-full h-full ${
                  remoteMedia.screen ? 'object-contain bg-black' : 'object-cover'
                } ${showRemoteVideo ? '' : 'invisible'}`}
              />

              {!showRemoteVideo && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center bg-slate-900">
                  <div className="relative">
                    {(phase === 'outgoing' || phase === 'connecting') && (
                      <span className="absolute -inset-3 rounded-full bg-brand-500/25 animate-ping" />
                    )}
                    <Avatar src={peer.avatar} firstName={peer.firstName} lastName={peer.lastName} size="xxl" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-semibold">
                      {peer.firstName} {peer.lastName}{peer.verified && <VerifiedBadge size={14} />}
                    </h2>
                    <p className={`mt-1 text-sm ${isEnded || isReconnecting ? 'text-amber-300' : 'text-white/70'}`}>
                      {statusText}
                    </p>
                    {!remoteMedia.audio && phase === 'active' && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/60">
                        <MicOff size={13} />{' '}{t("Micro coupe")}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Barre superieure */}
              <div className="absolute top-0 inset-x-0 flex items-start justify-between gap-3 p-4 bg-black/40 pointer-events-none">
                <div className="min-w-0 pointer-events-auto">
                  {showRemoteVideo && (
                    <>
                      <p className="font-display font-semibold truncate drop-shadow">
                        {peer.firstName} {peer.lastName}{peer.verified && <VerifiedBadge size={14} />}
                      </p>
                      <p className={`text-xs drop-shadow ${isReconnecting ? 'text-amber-300' : 'text-white/80'}`}>
                        {statusText}
                      </p>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {screenSharing && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-medium">
                        <MonitorUp size={13} />{' '}{t("Vous partagez votre ecran")}</span>
                    )}
                    {remoteMedia.screen && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/90 px-3 py-1 text-xs font-medium">
                        <MonitorUp size={13} />{' '}{t("{firstName} partage son ecran", { firstName: peer.firstName })}</span>
                    )}
                    {showRemoteVideo && !remoteMedia.audio && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs">
                        <MicOff size={13} />{' '}{t("Micro coupe")}</span>
                    )}
                  </div>
                </div>
                {!isEnded && (
                  <button
                    type="button"
                    onClick={() => setMinimized(true)}
                    aria-label={t("Reduire l'appel")}
                    title={t("Reduire")}
                    className="pointer-events-auto shrink-0 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
                  >
                    <Minimize2 size={18} />
                  </button>
                )}
              </div>

              {/* Apercu de ma camera */}
              {localCameraStream && !isEnded && (
                <div className="absolute bottom-4 end-4 w-28 sm:w-40 aspect-[3/4] sm:aspect-video rounded-2xl overflow-hidden border border-white/20 shadow-card bg-black">
                  <video
                    ref={localVideoRef}
                    muted
                    playsInline
                    autoPlay
                    className="w-full h-full object-cover -scale-x-100"
                  />
                </div>
              )}
            </div>

            {/* Commandes */}
            {!isEnded && (
              <div className="shrink-0 flex items-center justify-center gap-3 sm:gap-4 px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-slate-950">
                {inCallControls && (
                  <>
                    <ControlButton
                      onClick={toggleMute}
                      tone={isMuted ? 'active' : 'idle'}
                      label={isMuted ? t("Reactiver le micro") : t("Couper le micro")}
                    >
                      {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                    </ControlButton>

                    <ControlButton
                      onClick={toggleCamera}
                      tone={cameraOn ? 'active' : 'idle'}
                      label={cameraOn ? t("Couper la camera") : t("Activer la camera")}
                    >
                      {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
                    </ControlButton>

                    {canShareScreen && (
                      <ControlButton
                        onClick={toggleScreenShare}
                        tone={screenSharing ? 'success' : 'idle'}
                        disabled={phase !== 'active'}
                        label={screenSharing ? t("Arreter le partage d'ecran") : t("Partager mon ecran")}
                      >
                        {screenSharing ? <MonitorOff size={22} /> : <MonitorUp size={22} />}
                      </ControlButton>
                    )}
                  </>
                )}

                {canHangUp && (
                  <ControlButton
                    onClick={endCall}
                    tone="danger"
                    label={phase === 'active' ? t("Raccrocher") : t("Annuler l'appel")}
                  >
                    <PhoneOff size={22} />
                  </ControlButton>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Appel reduit : petite pastille flottante */}
      <AnimatePresence>
        {hasCall && phase !== 'incoming' && minimized && peer && (
          <motion.div
            key="mini"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed z-[90] end-4 bottom-24 md:bottom-6 bg-ink text-white rounded-full shadow-card border border-white/10 ps-2 pe-2 py-2 flex items-center gap-2.5"
          >
            <button
              type="button"
              onClick={() => setMinimized(false)}
              className="flex items-center gap-2.5 text-start ps-0.5"
              aria-label={t("Agrandir l'appel")}
            >
              <Avatar src={peer.avatar} firstName={peer.firstName} lastName={peer.lastName} size="sm" />
              <span className="max-w-[110px]">
                <span className="block text-xs font-semibold truncate">{peer.firstName}</span>
                <span className={`block text-[11px] ${isReconnecting ? 'text-amber-300' : 'text-white/60'}`}>
                  {statusText}
                </span>
              </span>
            </button>
            {phase !== 'ended' && (
              <>
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? t("Reactiver le micro") : t("Couper le micro")}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isMuted ? ACTIVE_BUTTON : IDLE_BUTTON
                  }`}
                >
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => setMinimized(false)}
                  aria-label={t("Agrandir l'appel")}
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                >
                  <Maximize2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={endCall}
                  aria-label={t("Raccrocher")}
                  className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                >
                  {phase === 'connecting' || phase === 'outgoing' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <PhoneOff size={16} />
                  )}
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
