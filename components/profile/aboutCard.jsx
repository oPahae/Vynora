import { Briefcase, GraduationCap, MapPin, Globe2, CalendarDays, UserRound, Cake } from 'lucide-react';

import { t, formatDate as formatLocalDate } from '@/lib/i18n/runtime';
const ITEMS = [
  { key: 'work', icon: Briefcase, get prefix() { return t("Travaille chez"); } },
  { key: 'education', icon: GraduationCap, get prefix() { return t("A etudie a"); } },
  { key: 'city', icon: MapPin, get prefix() { return t("Vit a"); } },
  { key: 'country', icon: Globe2, get prefix() { return t("Originaire de"); } }
];

const GENDER_LABELS = { get male() { return t("Homme"); }, get female() { return t("Femme"); } };

function formatDate(dateString) {
  return formatLocalDate(dateString, { month: 'long', year: 'numeric' });
}

function formatBirthDate(dateString) {
  return formatLocalDate(dateString, { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AboutCard({ profile }) {
  const items = ITEMS.filter((item) => profile[item.key]);
  const genderLabel = GENDER_LABELS[profile.gender];

  return (
    <div className="nx-card p-6">
      <h2 className="font-display font-semibold text-slate-900 mb-4 tracking-tight">{t("A propos")}</h2>
      <div className="space-y-3.5">
        {items.length === 0 && !genderLabel && !profile.birthDate && (
          <p className="text-sm text-slate-400">{t("Aucune information renseignee pour le moment.")}</p>
        )}
        {genderLabel && (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
              <UserRound size={15} className="text-brand-500" />
            </span>
            <span className="font-medium text-slate-800">{genderLabel}</span>
          </div>
        )}
        {profile.birthDate && (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
              <Cake size={15} className="text-brand-500" />
            </span>
            <span>{t("Ne(e) le")}{' '}<span className="font-medium text-slate-800">{formatBirthDate(profile.birthDate)}</span>
            </span>
          </div>
        )}
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-3 text-sm text-slate-600">
            <span className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
              <item.icon size={15} className="text-brand-500" />
            </span>
            <span>
              {item.prefix} <span className="font-medium text-slate-800">{profile[item.key]}</span>
            </span>
          </div>
        ))}
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
            <CalendarDays size={15} className="text-brand-500" />
          </span>
          <span>{t("Membre depuis {date}", { date: formatDate(profile.createdAt) })}</span>
        </div>
      </div>
    </div>
  );
}
