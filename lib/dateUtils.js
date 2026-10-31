import { t, formatDate } from '@/lib/i18n/runtime';

export function formatRelativeTime(dateString) {
  const date = new Date(dateString.replace(' ', 'T'));
  const now = new Date();
  const diffSeconds = Math.floor((now - date) / 1000);

  if (diffSeconds < 60) return t("a l'instant");

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return t('il y a {count} min', { count: diffMinutes });

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return t('il y a {count} h', { count: diffHours });

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return t('il y a {count} j', { count: diffDays });

  return formatDate(date, {
    day: 'numeric',
    month: 'short',
    year: diffDays > 365 ? 'numeric' : undefined
  });
}
