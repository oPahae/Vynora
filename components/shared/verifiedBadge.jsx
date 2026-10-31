import { BadgeCheck } from 'lucide-react';
import { t } from '@/lib/i18n/runtime';

// Badge "compte verifie" (reserve aux comptes premium).
export default function VerifiedBadge({ size = 15, className = '' }) {
  return (
    <span title={t("Compte verifie")} aria-label={t("Compte verifie")} className={`inline-flex align-text-bottom ms-1 text-sky-500 ${className}`}>
      <BadgeCheck size={size} fill="currentColor" className="text-sky-500 [&>path:last-child]:stroke-white" strokeWidth={2.2} />
    </span>
  );
}
