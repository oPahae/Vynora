import { t } from '@/lib/i18n/runtime';

// Motifs proposes a l'administrateur pour toute sanction (suppression,
// bannissement...). "other" ouvre un champ libre.
export function getReasonOptions() {
  return [
    { key: 'rules', label: t("Non-respect des regles de la communaute") },
    { key: 'spam', label: t("Spam ou publicite indesirable") },
    { key: 'harassment', label: t("Harcelement ou intimidation") },
    { key: 'hate', label: t("Discours haineux ou discrimination") },
    { key: 'violence', label: t("Violence ou contenu dangereux") },
    { key: 'nudity', label: t("Nudite ou contenu sexuel") },
    { key: 'misinformation', label: t("Fausses informations") },
    { key: 'scam', label: t("Arnaque ou fraude") },
    { key: 'impersonation', label: t("Usurpation d'identite") },
    { key: 'other', label: t("Autre") }
  ];
}

// Texte final du motif (libelle du choix, ou texte libre pour "Autre").
export function resolveReason(key, customText) {
  if (key === 'other') return (customText || '').trim();
  const option = getReasonOptions().find((item) => item.key === key);
  return option ? option.label : '';
}
