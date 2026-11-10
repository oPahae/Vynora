import { useCallback, useEffect, useRef, useState } from 'react';

// =====================================================================
// Sortie audio des appels : mode "haut-parleur" / "ecouteur".
// =====================================================================
// Les navigateurs n'exposent pas directement un bouton "haut-parleur" :
// on passe par HTMLMediaElement.setSinkId() (Chrome, Edge, Chrome Android,
// Safari 18.4+...) pour choisir la sortie audio parmi celles listees par
// enumerateDevices(). Quand le navigateur ne le permet pas (ex: iOS plus
// ancien, Firefox), la sortie reste geree par le systeme et l'interface
// l'indique a l'utilisateur.
// =====================================================================

const SPEAKER_RE = /speaker|haut[- ]?parleur|altavoz|altoparlante|lautsprecher|громк|扬声器|スピーカー|مكبر/i;
const EARPIECE_RE = /earpiece|receiver|ecouteur|écouteur|auricular|auricolare|hörmuschel|наушник|听筒|受話器|سماعة الأذن/i;
const HEADSET_RE = /headset|headphone|casque|auricul|cuffie|kopfh|наушн|耳机|ヘッドホン|سماعة/i;

export function supportsOutputSelection() {
  return typeof HTMLMediaElement !== 'undefined' && typeof HTMLMediaElement.prototype.setSinkId === 'function';
}

async function listOutputs() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'audiooutput');
  } catch (error) {
    return [];
  }
}

// Choisit la sortie correspondant au mode demande.
//  - haut-parleur : un peripherique "speaker" s'il existe, sinon la sortie par defaut.
//  - ecouteur     : "earpiece/receiver" (mobile), sinon casque, sinon rien de different.
function chooseOutput(outputs, speakerOn) {
  if (speakerOn) {
    const speaker = outputs.find((d) => SPEAKER_RE.test(d.label) && !EARPIECE_RE.test(d.label));
    return { deviceId: speaker ? speaker.deviceId : 'default', found: true };
  }
  const earpiece = outputs.find((d) => EARPIECE_RE.test(d.label));
  if (earpiece) return { deviceId: earpiece.deviceId, found: true };
  const headset = outputs.find((d) => HEADSET_RE.test(d.label) && !SPEAKER_RE.test(d.label));
  if (headset) return { deviceId: headset.deviceId, found: true };
  return { deviceId: 'default', found: false };
}

export async function applyAudioOutput(elements, speakerOn) {
  const list = (Array.isArray(elements) ? elements : [elements]).filter(Boolean);
  if (list.length === 0) return { supported: supportsOutputSelection(), found: true };
  if (!supportsOutputSelection()) return { supported: false, found: false };

  const outputs = await listOutputs();
  const choice = chooseOutput(outputs, speakerOn);
  await Promise.all(
    list.map(async (element) => {
      try {
        if (element.sinkId !== choice.deviceId) await element.setSinkId(choice.deviceId);
      } catch (error) {
        // sortie indisponible : on garde la precedente
      }
    })
  );
  return { supported: true, found: choice.found };
}

// Hook : etat haut-parleur + application sur un ensemble d'elements <audio>.
// `getElements()` renvoie les elements a mettre a jour ; `deps` declenche une
// nouvelle application (nouveau flux, etc.).
export function useSpeakerOutput({ getElements, deps = [], onUnavailable, initial = true }) {
  const [speakerOn, setSpeakerOn] = useState(initial);
  const [supported, setSupported] = useState(false);
  const speakerRef = useRef(initial);
  const userToggledRef = useRef(false);
  const getRef = useRef(getElements);
  const notifyRef = useRef(onUnavailable);
  getRef.current = getElements;
  notifyRef.current = onUnavailable;

  useEffect(() => {
    setSupported(supportsOutputSelection());
  }, []);

  const apply = useCallback(async () => {
    const result = await applyAudioOutput(getRef.current(), speakerRef.current);
    if (userToggledRef.current) {
      userToggledRef.current = false;
      if (!result.supported) notifyRef.current && notifyRef.current('unsupported');
      else if (!result.found && !speakerRef.current) notifyRef.current && notifyRef.current('no-earpiece');
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    speakerRef.current = !speakerRef.current;
    userToggledRef.current = true;
    setSpeakerOn(speakerRef.current);
    apply();
  }, [apply]);

  useEffect(() => {
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.addEventListener) return undefined;
    const handler = () => apply();
    navigator.mediaDevices.addEventListener('devicechange', handler);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handler);
  }, [apply]);

  return { speakerOn, speakerSupported: supported, toggleSpeaker };
}

// Relance la lecture d'un element media bloquee par la politique d'autoplay
// (au prochain geste de l'utilisateur ou au retour de l'onglet au premier plan).
export function useAutoplayRecovery(getElements, active) {
  useEffect(() => {
    if (!active) return undefined;
    const resume = () => {
      (getElements() || []).filter(Boolean).forEach((element) => {
        if (element.srcObject && element.paused) {
          const playing = element.play();
          if (playing && typeof playing.catch === 'function') playing.catch(() => {});
        }
      });
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    const timer = setInterval(resume, 2000);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
