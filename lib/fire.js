import { query } from '@/lib/db';

// Niveau de fire d'un membre = son boost, affiche sur son profil.
// Il traduit le niveau de reactions du membre dans le systeme : plus il reagit
// (publications et commentaires), plus le niveau monte. Fenetre glissante identique
// a celle de l'affinite du fil (lib/feedScoring.js).
//
// Pour changer le comportement : ajuster FIRE_WINDOW_DAYS, FIRE_THRESHOLDS ou la
// requete de getFireInfo (par exemple compter les reactions recues a la place).
export const FIRE_WINDOW_DAYS = 30;
// Nombre minimal de reactions sur la fenetre pour atteindre chaque niveau (1 a 5).
export const FIRE_THRESHOLDS = [1, 10, 30, 75, 150];
export const FIRE_MAX_LEVEL = FIRE_THRESHOLDS.length;

// count -> { level (0..5), count, nextAt (null au niveau max), progress (0..1 vers le niveau suivant) }
export function computeFireLevel(count) {
  const total = Math.max(0, Number(count) || 0);
  let level = 0;
  FIRE_THRESHOLDS.forEach((min, index) => {
    if (total >= min) level = index + 1;
  });
  const nextAt = level >= FIRE_MAX_LEVEL ? null : FIRE_THRESHOLDS[level];
  const floor = level === 0 ? 0 : FIRE_THRESHOLDS[level - 1];
  const progress = nextAt === null ? 1 : Math.min(1, Math.max(0, (total - floor) / (nextAt - floor)));
  return { level, count: total, nextAt, progress };
}

export async function getFireInfo(userId) {
  const rows = await query(
    'SELECT COUNT(*) AS total FROM reaction WHERE userId = ? AND createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)',
    [userId, FIRE_WINDOW_DAYS]
  );
  return computeFireLevel(rows[0]?.total);
}

// Version exposee aux autres membres : uniquement le niveau, pas le detail du calcul.
export function publicFire(fire) {
  return { level: fire.level, max: FIRE_MAX_LEVEL };
}

// Version exposee au proprietaire du profil : niveau + progression.
export function selfFire(fire) {
  return {
    level: fire.level,
    max: FIRE_MAX_LEVEL,
    count: fire.count,
    nextAt: fire.nextAt,
    progress: fire.progress,
    windowDays: FIRE_WINDOW_DAYS
  };
}
