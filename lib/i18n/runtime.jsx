import { Fragment, cloneElement, isValidElement } from 'react';
// API de traduction "sans hook" : t() lit la langue active au moment de
// l'appel. Les pages sont remontees lors d'un changement de langue (voir
// _app.jsx), ce qui garantit que toute l'interface est re-rendue.
import { translate, translateDynamic } from './core';
import { DEFAULT_LOCALE, getLocaleMeta, isSupportedLocale } from './config';

let activeLocale = DEFAULT_LOCALE;

export function setActiveLocale(locale) {
  activeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function getActiveLocale() {
  return activeLocale;
}

// Traduit un texte (cle = texte francais) avec interpolation {nom}.
export function t(key, vars) {
  return translate(activeLocale, key, vars);
}

// Marqueur pour les textes declares hors composant (constantes de module) :
// retourne la cle telle quelle ; l'appelant doit la passer a t() au rendu.
export function tm(key) {
  return key;
}

// Traduit un message deja interpole (ex: message d'erreur renvoye par l'API).
export function td(text) {
  return translateDynamic(activeLocale, text);
}

export function isRtl(locale = activeLocale) {
  return getLocaleMeta(locale).dir === 'rtl';
}

export function getIntlLocale(locale = activeLocale) {
  return getLocaleMeta(locale).intl;
}

// Nombre de minutes/heures/jours etc. : accord simple (1 => singulier).
export function tn(singularKey, pluralKey, count, vars) {
  return t(Math.abs(count) > 1 ? pluralKey : singularKey, { count, ...vars });
}

// Variante "riche" : les valeurs de `vars` peuvent etre des elements React
// (ex: <strong>email</strong>). Retourne un tableau de noeuds.
export function tRich(key, vars = {}) {
  const template = translate(activeLocale, key);
  const parts = template.split(/(\{\w+\})/g);
  return parts.map((part, index) => {
    const match = /^\{(\w+)\}$/.exec(part);
    if (match && match[1] in vars) {
      const value = vars[match[1]];
      return isValidElement(value) ? cloneElement(value, { key: index }) : <Fragment key={index}>{value}</Fragment>;
    }
    return part ? <Fragment key={index}>{part}</Fragment> : null;
  });
}

// --- Dates / heures / nombres selon la langue active -------------------------
export function formatDate(date, options) {
  return new Date(date).toLocaleDateString(getIntlLocale(), options);
}

export function formatTime(date, options = { hour: '2-digit', minute: '2-digit' }) {
  return new Date(date).toLocaleTimeString(getIntlLocale(), options);
}

export function formatNumber(value, options) {
  return new Intl.NumberFormat(getIntlLocale(), options).format(value);
}
