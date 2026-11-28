import { Flame } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';

// Niveau de fire (boost) affiche sur le profil : 5 flammes, remplies selon le niveau.
// `fire` = { level, max, count?, nextAt?, windowDays? } (le detail n'est fourni qu'au proprietaire).
const TONES = [
  { pill: 'bg-slate-500/10 text-slate-500', flame: 'text-slate-400' },
  { pill: 'bg-amber-500/10 text-amber-600', flame: 'text-amber-500' },
  { pill: 'bg-orange-500/10 text-orange-600', flame: 'text-orange-500' },
  { pill: 'bg-orange-500/15 text-orange-600', flame: 'text-orange-600' },
  { pill: 'bg-red-500/10 text-red-600', flame: 'text-red-500' },
  { pill: 'bg-rose-500/15 text-rose-600', flame: 'text-rose-600' }
];

function levelName(level) {
  switch (level) {
    case 1:
      return t("Etincelle");
    case 2:
      return t("Flamme");
    case 3:
      return t("Brasier");
    case 4:
      return t("Feu ardent");
    case 5:
      return t("Inferno");
    default:
      return t("Eteint");
  }
}

export default function FireLevel({ fire, className = '' }) {
  if (!fire) return null;
  const max = fire.max || 5;
  const level = Math.min(Math.max(fire.level || 0, 0), max);
  const tone = TONES[level] || TONES[0];

  const lines = [t("Niveau de fire {level}/{max}", { level, max }), t("Plus un membre reagit, plus son boost augmente.")];
  if (typeof fire.count === 'number') {
    lines.push(t("{count} reactions sur les {days} derniers jours", { count: fire.count, days: fire.windowDays || 30 }));
    lines.push(fire.nextAt ? t("Prochain niveau a {next} reactions", { next: fire.nextAt }) : t("Niveau maximum atteint"));
  }
  const tooltip = lines.join('\n');

  return (
    <span
      title={tooltip}
      aria-label={`${levelName(level)} - ${t("Niveau de fire {level}/{max}", { level, max })}`}
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold cursor-default ${tone.pill} ${className}`}
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: max }, (_, index) => {
          const active = index < level;
          return (
            <Flame
              key={index}
              size={14}
              className={active ? tone.flame : 'text-slate-300'}
              fill={active ? 'currentColor' : 'none'}
              strokeWidth={active ? 1.5 : 1.75}
            />
          );
        })}
      </span>
      <span>{levelName(level)}</span>
    </span>
  );
}
