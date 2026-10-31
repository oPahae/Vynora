// Aide i18n cote serveur (routes API, e-mails, notifications push).
const { DEFAULT_LOCALE, LANG_COOKIE, normalizeLocale, isSupportedLocale } = require('./config');
const { translate } = require('./core');

function parseCookieHeader(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const index = pair.indexOf('=');
    if (index === -1) return;
    cookies[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
  });
  return cookies;
}

// Langue d'une requete : cookie `lang` (defini par l'app), sinon francais.
function getRequestLocale(req) {
  try {
    const fromCookie = req.cookies?.[LANG_COOKIE] || parseCookieHeader(req.headers?.cookie)[LANG_COOKIE];
    if (isSupportedLocale(fromCookie)) return fromCookie;
  } catch (error) {}
  return DEFAULT_LOCALE;
}

// Traduit une cle (texte francais) pour une langue donnee.
function tr(locale, key, vars) {
  return translate(locale, key, vars);
}

module.exports = { getRequestLocale, tr, parseCookieHeader };
