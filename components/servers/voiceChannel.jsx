import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Volume2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  PhoneOff,
  Loader2,
  Volume1,
  Maximize2,
  X,
  MousePointerClick
} from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import { useSocket } from '@/lib/socketContext';
import { useAuth } from '@/lib/authContext';
import { useVoiceChannel } from '@/lib/guildVoice';

import { t } from '@/lib/i18n/runtime';
function ControlButton({ active, danger, disabled, onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 ${
        danger
          ? 'bg-red-500 text-white hover:bg-red-600'
          : active
            ? 'bg-surface text-slate-900 hover:bg-slate-100'
            : 'bg-ink/80 text-white hover:bg-ink/90'
      }`}
    >
      {children}
    </button>
  );
}

// Video branchee sur un MediaStream. L'affectation de `srcObject` se fait
// dans un effet propre a ce composant : il est monte AU MOMENT ou la camera
// / le partage d'ecran apparait, donc le flux est toujours attache (le bug
// precedent : le flux n'etait attache qu'au premier rendu de la tuile, avant
// que l'element <video> n'existe).
function StreamVideo({ stream, className }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (element.srcObject !== stream) element.srcObject = stream || null;
    if (stream) {
      const playing = element.play();
      if (playing && typeof playing.catch === 'function') playing.catch(() => {});
    }
  }, [stream]);

  // Toujours muette : le son des autres passe par <PeerAudio> (sinon il
  // serait joue deux fois), et on ne s'entend pas soi-meme.
  return <video ref={videoRef} autoPlay playsInline muted className={className} />;
}

// Lecture du son d'un participant distant (element invisible) + volume.
function PeerAudio({ stream, volume }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    if (element.srcObject !== stream) element.srcObject = stream || null;
    if (stream) {
      const playing = element.play();
      if (playing && typeof playing.catch === 'function') playing.catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    // HTMLMediaElement.volume n'accepte qu'un nombre entre 0 et 1.
    if (audioRef.current) audioRef.current.volume = Math.min(1, Math.max(0, volume));
  }, [volume]);

  return <audio ref={audioRef} autoPlay />;
}

// Tuile d'un participant (rangee du haut) : petite video si camera/ecran
// actif, sinon avatar. Cliquer dessus affiche son flux en grand dessous.
function ParticipantTile({ participant, focused, onSelect, volume, onVolumeChange, canMuteOthers, onMuteUser }) {
  const { name, avatarInfo, muted, camera, screen, isSelf, hasVideo, stream } = participant;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={focused}
      title={hasVideo ? t("Voir en grand") : name}
      className={`relative group shrink-0 w-36 sm:w-44 aspect-video bg-ink rounded-xl2 overflow-hidden flex items-center justify-center cursor-pointer outline-none transition-shadow ${
        focused ? 'ring-2 ring-brand-400' : 'ring-1 ring-white/10 hover:ring-white/30 focus-visible:ring-white/50'
      }`}
    >
      {hasVideo ? (
        <StreamVideo stream={stream} className={`w-full h-full ${screen ? 'object-contain bg-black' : 'object-cover'}`} />
      ) : (
        <Avatar src={avatarInfo?.avatar} firstName={avatarInfo?.firstName || name} lastName={avatarInfo?.lastName || ''} size="lg" />
      )}

      <div className="absolute bottom-1.5 start-1.5 end-1.5 flex items-center justify-between gap-1 pointer-events-none">
        <span className="flex items-center gap-1 bg-black/55 text-white text-xs px-2 py-1 rounded-full min-w-0">
          {muted && <MicOff size={11} className="shrink-0 text-red-400" />}
          <span className="truncate">{name}</span>
        </span>
        {(screen || camera) && (
          <span className="shrink-0 bg-black/55 text-white p-1 rounded-full" title={screen ? t("Partage d'ecran") : t("Camera")}>
            {screen ? <MonitorUp size={11} /> : <Video size={11} />}
          </span>
        )}
      </div>

      {!isSelf && (
        <div className="absolute top-1.5 end-1.5 flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
          <label
            className="flex items-center gap-1 bg-black/55 rounded-full px-2 py-1"
            onClick={(event) => event.stopPropagation()}
            title={t("Volume")}
          >
            <Volume1 size={12} className="text-white shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(event) => onVolumeChange(Number(event.target.value))}
              className="w-12 h-1 accent-white"
            />
          </label>
          {canMuteOthers && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMuteUser();
              }}
              title={t("Couper son micro")}
              className="bg-black/55 hover:bg-red-500 text-white p-1.5 rounded-full transition-colors"
            >
              <MicOff size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Grande zone sous la rangee des participants : flux (camera ou ecran) de
// la personne selectionnee.
function Stage({ participant, onClose }) {
  const containerRef = useRef(null);
  const { name, avatarInfo, camera, screen, hasVideo, stream } = participant;

  function toggleFullscreen() {
    const element = containerRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      element.requestFullscreen?.();
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 bg-black rounded-xl2 overflow-hidden flex items-center justify-center">
      {hasVideo ? (
        <StreamVideo stream={stream} className="w-full h-full object-contain bg-black" />
      ) : (
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <Avatar src={avatarInfo?.avatar} firstName={avatarInfo?.firstName || name} lastName={avatarInfo?.lastName || ''} size="xl" />
          <p className="text-sm text-white/60">{t("{name} n'a ni camera ni partage d'ecran actif.", { name })}</p>
        </div>
      )}

      <div className="absolute top-2 start-2 end-2 flex items-center justify-between gap-2 pointer-events-none">
        <span className="flex items-center gap-1.5 bg-black/60 text-white text-xs px-2.5 py-1.5 rounded-full min-w-0">
          {screen ? <MonitorUp size={13} className="shrink-0" /> : camera ? <Video size={13} className="shrink-0" /> : null}
          <span className="truncate">
            {name}
            {hasVideo ? (screen ? t(" - partage d'ecran") : t(" - camera")) : ''}
          </span>
        </span>
        <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
          {hasVideo && (
            <button
              type="button"
              onClick={toggleFullscreen}
              title={t("Plein ecran")}
              aria-label={t("Plein ecran")}
              className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full"
            >
              <Maximize2 size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title={t("Fermer l'affichage")}
            aria-label={t("Fermer l'affichage")}
            className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Salon vocal : rejoint automatiquement a l'ouverture, quitte a la
// fermeture ou au changement de salon. Rangee de participants en haut, flux
// (camera / partage d'ecran) du participant clique en grand dessous, barre
// de controles (micro, camera, partage d'ecran) en bas.
export default function VoiceChannel({ guildId, channel, onBack, onHangup }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [volumes, setVolumes] = useState({});
  const [focusKey, setFocusKey] = useState(null); // null = automatique, 'none' = rien, sinon cle du participant
  const {
    status,
    errorMessage,
    selfState,
    caps,
    peers,
    localVideoStream,
    dismissError,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    muteUser
  } = useVoiceChannel({
    socket,
    guildId,
    channelId: channel.id,
    enabled: Boolean(socket)
  });

  const peerList = useMemo(() => [...peers.entries()], [peers]);

  const participants = useMemo(() => {
    const selfName = `${user?.firstName || ''} (vous)`.trim();
    const me = {
      key: 'self',
      isSelf: true,
      name: selfName,
      avatarInfo: user,
      muted: selfState.muted,
      camera: selfState.camera,
      screen: selfState.screen,
      stream: localVideoStream,
      hasVideo: Boolean((selfState.camera || selfState.screen) && localVideoStream)
    };
    const others = peerList.map(([socketId, peer]) => ({
      key: socketId,
      isSelf: false,
      name: `${peer.user?.firstName || ''} ${peer.user?.lastName || ''}`.trim() || t("Participant"),
      avatarInfo: peer.user,
      muted: peer.muted,
      camera: peer.camera,
      screen: peer.screen,
      stream: peer.stream,
      hasVideo: Boolean((peer.camera || peer.screen) && peer.stream)
    }));
    return [me, ...others];
  }, [user, selfState, localVideoStream, peerList]);

  // Affichage automatique : un partage d'ecran des autres d'abord, puis une
  // camera des autres, puis son propre flux.
  const autoKey = useMemo(() => {
    const others = participants.filter((p) => !p.isSelf);
    const pick =
      others.find((p) => p.screen && p.hasVideo) ||
      others.find((p) => p.camera && p.hasVideo) ||
      participants.find((p) => p.isSelf && p.hasVideo);
    return pick ? pick.key : null;
  }, [participants]);

  // Une fermeture manuelle ne dure que jusqu'a l'apparition d'un nouveau flux.
  useEffect(() => {
    setFocusKey((prev) => (prev === 'none' ? null : prev));
  }, [autoKey]);

  const effectiveKey = focusKey === 'none' ? null : participants.some((p) => p.key === focusKey) ? focusKey : autoKey;
  const focused = participants.find((p) => p.key === effectiveKey) || null;

  function selectParticipant(key) {
    setFocusKey(key === effectiveKey ? 'none' : key);
  }

  const tile = (participant) => (
    <ParticipantTile
      key={participant.key}
      participant={participant}
      focused={participant.key === effectiveKey}
      onSelect={() => selectParticipant(participant.key)}
      volume={volumes[participant.key] ?? 1}
      onVolumeChange={(value) => setVolumes((prev) => ({ ...prev, [participant.key]: value }))}
      canMuteOthers={caps.canMuteOthers}
      onMuteUser={() => muteUser(participant.key)}
    />
  );

  return (
    <div className="flex flex-col h-full bg-ink">
      <div className="flex items-center gap-2 px-3 md:px-4 h-14 shrink-0 border-b border-white/10">
        <button type="button" onClick={onBack} className="md:hidden p-1.5 -ms-1 text-white/70" aria-label={t("Retour aux salons")}>
          <ArrowLeft size={20} />
        </button>
        <Volume2 size={18} className="text-white/60" />
        <h2 className="font-display font-semibold text-white truncate">{channel.name}</h2>
        <span className="ms-auto text-xs text-white/50">{peerList.length + (status === 'connected' ? 1 : 0)}{' '}{t("connecte(s)")}</span>
      </div>

      {status === 'connected' && errorMessage && (
        <div className="shrink-0 flex items-center gap-2 bg-red-500/15 text-red-200 text-xs px-4 py-2">
          <span className="flex-1">{errorMessage}</span>
          <button type="button" onClick={dismissError} aria-label={t("Fermer")} className="shrink-0 text-red-200/80 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col p-3 md:p-4 gap-3 overflow-hidden">
        {status === 'connecting' && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-white/60">
            <Loader2 size={24} className="animate-spin" />
            <p className="text-sm">{t("Connexion au salon vocal...")}</p>
          </div>
        )}
        {status === 'error' && (
          <div className="h-full flex items-center justify-center text-center text-sm text-red-300 px-6">{errorMessage}</div>
        )}
        {status === 'connected' && (
          <>
            {/* Le son des autres participants (invisible). */}
            {peerList.map(([socketId, peer]) => (
              <PeerAudio key={t("audio-{socketId}", { socketId })} stream={peer.stream} volume={volumes[socketId] ?? 1} />
            ))}

            {focused ? (
              <>
                <div className="shrink-0 flex gap-2 overflow-x-auto pb-1">{participants.map(tile)}</div>
                <Stage participant={focused} onClose={() => setFocusKey('none')} />
              </>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="flex flex-wrap gap-3 justify-center content-start">{participants.map(tile)}</div>
                {participants.length > 1 && (
                  <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/40">
                    <MousePointerClick size={13} />{' '}{t("Cliquez sur un participant pour afficher sa camera ou son partage d'ecran en grand.")}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {status === 'connected' && (
        <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-4 border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ControlButton active={!selfState.muted} disabled={!caps.canSpeak} onClick={toggleMute} label={selfState.muted ? t("Activer le micro") : t("Couper le micro")}>
            {selfState.muted ? <MicOff size={19} /> : <Mic size={19} />}
          </ControlButton>
          <ControlButton active={selfState.camera} disabled={!caps.canVideo} onClick={toggleCamera} label={selfState.camera ? t("Couper la camera") : t("Activer la camera")}>
            {selfState.camera ? <Video size={19} /> : <VideoOff size={19} />}
          </ControlButton>
          <ControlButton active={selfState.screen} disabled={!caps.canScreenShare} onClick={toggleScreenShare} label={selfState.screen ? t("Arreter le partage d'ecran") : t("Partager l'ecran")}>
            {selfState.screen ? <MonitorUp size={19} /> : <MonitorOff size={19} />}
          </ControlButton>
          <ControlButton danger onClick={onHangup} label={t("Quitter le salon vocal")}>
            <PhoneOff size={19} />
          </ControlButton>
        </div>
      )}
    </div>
  );
}
