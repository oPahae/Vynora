// Evaluation locale (sans appel reseau) de la force d'un mot de passe.
//
// Cinq criteres, affiches sous la barre : 8 caracteres, 12 caracteres,
// majuscules + minuscules, chiffre, symbole. La barre se remplit de 20 % par
// critere rempli : elle atteint donc 100 % exactement quand tous les criteres
// sont valides ("Fort"). Un motif previsible (mot de passe courant, repetition,
// suite) est signale ; un mot de passe courant retire un critere.

const COMMON = ['password', 'motdepasse', '123456', '12345678', 'qwerty', 'azerty', 'abc123', 'iloveyou', 'admin', 'welcome', 'letmein', '000000', '111111'];

export const STRENGTH_LEVELS = [
  { label: 'Tres faible', color: '#ef4444' },
  { label: 'Faible', color: '#f97316' },
  { label: 'Moyen', color: '#eab308' },
  { label: 'Bon', color: '#22c55e' },
  { label: 'Fort', color: '#10b981' }
];

export function evaluatePassword(password = '') {
  const checks = {
    length: password.length >= 8,
    long: password.length >= 12,
    mixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password)
  };

  if (!password) return { score: -1, percent: 0, checks, level: null, weakPattern: false, hasSequence: false };

  let met = Object.values(checks).filter(Boolean).length;

  const lowered = password.toLowerCase();
  // Mot de passe courant ou caractere repete 3 fois : retire un critere.
  const weakPattern = COMMON.some((word) => lowered.includes(word)) || /(.)\1{2,}/.test(password);
  if (weakPattern) met = Math.max(0, met - 1);
  // Suites evidentes (1234, abcd) : simple conseil, sans toucher a la barre.
  const hasSequence = /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef)/i.test(password);

  // En dessous de 8 caracteres, jamais mieux que "Faible".
  if (!checks.length) met = Math.min(met, 1);

  const score = Math.max(0, Math.min(4, met - 1));
  const percent = Math.max(8, met * 20);
  return { score, percent, checks, level: STRENGTH_LEVELS[score], weakPattern, hasSequence };
}
