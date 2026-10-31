// Moteur de traduction sans dependance (client + serveur).
// Les cles sont les textes francais d'origine ; le francais n'a donc pas de
// dictionnaire : une cle absente retombe toujours sur le texte francais.
const { DEFAULT_LOCALE } = require('./config');
const dictionaries = require('./locales');

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    const value = vars[name];
    return value === undefined || value === null ? match : String(value);
  });
}

function translate(locale, key, vars) {
  if (typeof key !== 'string') return key;
  let out = key;
  if (locale && locale !== DEFAULT_LOCALE) {
    const dict = dictionaries[locale];
    if (dict && hasOwn(dict, key)) out = dict[key];
  }
  return interpolate(out, vars);
}

// --- Traduction de messages dynamiques (ex: reponses d'API) -----------------
// Les cles contenant des {placeholders} sont compilees en expressions
// regulieres pour retrouver la traduction d'un message deja interpole.
let patterns = null;
function getPatterns() {
  if (patterns) return patterns;
  patterns = [];
  const source = dictionaries.en || {};
  Object.keys(source).forEach((key) => {
    if (!/\{\w+\}/.test(key)) return;
    const names = [];
    const escaped = key
      .replace(/[.*+?^$()|[\]\\]/g, '\\$&')
      .replace(/\{(\w+)\}/g, (m, name) => {
        names.push(name);
        return '([\\s\\S]+?)';
      });
    patterns.push({ key, names, regex: new RegExp('^' + escaped + '$') });
  });
  // Les cles les plus longues (les plus specifiques) d'abord.
  patterns.sort((a, b) => b.key.length - a.key.length);
  return patterns;
}

function translateDynamic(locale, text) {
  if (typeof text !== 'string' || !text || !locale || locale === DEFAULT_LOCALE) return text;
  const dict = dictionaries[locale];
  if (!dict) return text;
  if (hasOwn(dict, text)) return dict[text];
  const list = getPatterns();
  for (let i = 0; i < list.length; i += 1) {
    const match = list[i].regex.exec(text);
    if (match && hasOwn(dict, list[i].key)) {
      const vars = {};
      list[i].names.forEach((name, index) => {
        vars[name] = match[index + 1];
      });
      return interpolate(dict[list[i].key], vars);
    }
  }
  return text;
}

module.exports = { translate, translateDynamic, interpolate, dictionaries };
