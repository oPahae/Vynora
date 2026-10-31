// Sonneries d'appel generees avec l'API Web Audio (aucun fichier audio requis).
// Chaque fonction demarre la sonnerie et retourne une fonction `stop()`.

function createPlayer(playPattern, intervalMs) {
  let ctx = null;
  let timer = null;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return () => {};
    ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch (error) {
    return () => {};
  }

  function tone(frequency, start, duration, volume) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.setValueAtTime(volume, start + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function run() {
    try {
      playPattern(tone, ctx.currentTime);
    } catch (error) {
      // audio indisponible
    }
  }

  run();
  timer = setInterval(run, intervalMs);

  return function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (ctx) {
      const closing = ctx;
      ctx = null;
      setTimeout(() => closing.close().catch(() => {}), 300);
    }
  };
}

// Appel entrant : double sonnerie repetee.
export function startRingtone() {
  return createPlayer((tone, now) => {
    tone(880, now, 0.35, 0.2);
    tone(660, now + 0.4, 0.35, 0.2);
    tone(880, now + 0.9, 0.35, 0.2);
    tone(660, now + 1.3, 0.35, 0.2);
  }, 3000);
}

// Appel sortant : tonalite d'attente.
export function startRingback() {
  return createPlayer((tone, now) => {
    tone(440, now, 1.0, 0.12);
    tone(480, now, 1.0, 0.12);
  }, 3500);
}

// Fin d'appel : petit bip descendant, joue une seule fois.
export function playEndTone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    [520, 380].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const start = now + index * 0.16;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch (error) {
    // audio indisponible
  }
}
