import { t, getIntlLocale } from '@/lib/i18n/runtime';

// Libelles du Market (appeles au rendu pour suivre la langue active).
export function getCategories() {
  return [
    { key: 'electronics', label: t("Electronique") },
    { key: 'vehicles', label: t("Vehicules") },
    { key: 'realestate', label: t("Immobilier") },
    { key: 'fashion', label: t("Mode") },
    { key: 'home', label: t("Maison et jardin") },
    { key: 'beauty', label: t("Beaute") },
    { key: 'sports', label: t("Sport et loisirs") },
    { key: 'kids', label: t("Enfants et bebes") },
    { key: 'books', label: t("Livres et culture") },
    { key: 'services', label: t("Services") },
    { key: 'other', label: t("Autre") }
  ];
}

export function getConditions() {
  return [
    { key: 'new', label: t("Neuf") },
    { key: 'like_new', label: t("Comme neuf") },
    { key: 'good', label: t("Bon etat") },
    { key: 'fair', label: t("Etat correct") },
    { key: 'for_parts', label: t("Pour pieces") }
  ];
}

export const CURRENCIES = ['MAD', 'EUR', 'USD'];

export function categoryLabel(key) {
  const found = getCategories().find((c) => c.key === key);
  return found ? found.label : key;
}

export function conditionLabel(key) {
  const found = getConditions().find((c) => c.key === key);
  return found ? found.label : key;
}

export function formatPrice(price, currency = 'MAD') {
  if (!Number(price)) return t("Gratuit");
  try {
    return new Intl.NumberFormat(getIntlLocale(), { style: 'currency', currency, maximumFractionDigits: price % 1 ? 2 : 0 }).format(price);
  } catch (error) {
    return `${price} ${currency}`;
  }
}
