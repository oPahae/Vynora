// Assistant IA du composeur. Utilise l'API publique "pahae-utils"
// (https://pahae-utils.vercel.app/api/responseAI?data=...&prompt=...) via
// une route backend dediee : voir pages/api/ai/assist.js. Cette API ne
// necessite pas de cle, l'assistant est donc actif par defaut.

const AI_API_URL = 'https://pahae-utils.vercel.app/api/responseAI';

export const isAiConfigured = true;

const MAX_INPUT_LENGTH = 2000;

const ACTION_PROMPTS = {
  improve:
    "Ameliore le style et la clarte du texte suivant, ecrit par un utilisateur d'un reseau social, sans en changer le sens ni la langue. Reponds uniquement avec le texte ameliore, sans guillemets ni commentaire.",
  correct:
    "Corrige uniquement les fautes d'orthographe, de grammaire et de ponctuation du texte suivant, sans changer le style ni le sens. Reponds uniquement avec le texte corrige, sans guillemets ni commentaire.",
  rephrase:
    'Reformule le texte suivant avec des mots differents, en gardant exactement le meme sens et la meme langue. Reponds uniquement avec le texte reformule, sans guillemets ni commentaire.',
  summarize:
    'Resume le texte suivant en une ou deux phrases courtes, dans la meme langue. Reponds uniquement avec le resume, sans guillemets ni commentaire.',
  translate:
    "Traduis le texte suivant en anglais s'il est en francais, ou en francais s'il est dans une autre langue. Reponds uniquement avec la traduction, sans guillemets ni commentaire.",
  caption:
    "Propose une legende courte et engageante pour une publication de reseau social, a partir de cette description ou de ce brouillon de texte. Reponds uniquement avec la legende proposee, sans guillemets ni commentaire."
};

export const AI_ACTIONS = Object.keys(ACTION_PROMPTS);

// L'API externe echo parfois le prompt systeme dans sa reponse (avant ou
// apres le texte utile), ex. "Bonjour ... Voici le prompt : Corrige
// uniquement les fautes ...". On nettoie ce genre de fuite pour ne jamais
// renvoyer le prompt interne a l'utilisateur.
const LEAK_MARKERS = [
  /voici le prompt[^:]*:?/i,
  /le prompt (utilise|donne|envoye|fourni)[^:]*:?/i,
  /\bprompt\s*:\s*/i,
  /\b(system prompt|instructions? systeme)\s*:?/i
];

function stripPromptLeak(rawResult, action) {
  let cleaned = rawResult;

  const promptText = ACTION_PROMPTS[action];
  if (promptText) {
    const idx = cleaned.indexOf(promptText);
    if (idx !== -1) {
      cleaned = cleaned.slice(0, idx);
    }
  }

  for (const marker of LEAK_MARKERS) {
    const match = cleaned.match(marker);
    if (match && typeof match.index === 'number') {
      cleaned = cleaned.slice(0, match.index);
    }
  }

  cleaned = cleaned.trim();
  // Si le nettoyage a tout supprime (le prompt a fuite sans rien d'autre
  // autour), on prefere renvoyer le texte brut plutot qu'une reponse vide.
  return cleaned || rawResult.trim();
}

// Limiteur de frequence simple, en memoire (reinitialise a chaque
// redemarrage du serveur). Suffisant pour eviter les abus/couts
// incontroles sans necessiter d'infrastructure supplementaire (Redis...).
// Sur un deploiement multi-instance, prevoir un compteur partage.
const RATE_LIMIT_MAX_CALLS = 15;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const callHistory = new Map();

function isRateLimited(userId) {
  const now = Date.now();
  const history = (callHistory.get(userId) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  const limited = history.length >= RATE_LIMIT_MAX_CALLS;
  if (!limited) {
    history.push(now);
    callHistory.set(userId, history);
  }
  return limited;
}

// Langue d'interface -> nom (en francais) utilise dans le prompt de traduction.
const LANGUAGE_NAMES = {
  ar: 'arabe',
  en: 'anglais',
  fr: 'francais',
  es: 'espagnol',
  it: 'italien',
  ja: 'japonais',
  zh: 'chinois',
  ru: 'russe'
};

function buildPrompt(action, locale) {
  if (action === 'translate' && locale && LANGUAGE_NAMES[locale]) {
    const target = LANGUAGE_NAMES[locale];
    const fallback = locale === 'en' ? 'francais' : 'anglais';
    return `Traduis le texte suivant en ${target}. S'il est deja en ${target}, traduis-le en ${fallback}. Reponds uniquement avec la traduction, sans guillemets ni commentaire.`;
  }
  return ACTION_PROMPTS[action];
}

export async function runAiAssist(userId, action, text, locale) {
  if (!ACTION_PROMPTS[action]) {
    return { success: false, status: 422, message: 'Action IA inconnue' };
  }

  const trimmedText = (text || '').toString().trim();
  if (!trimmedText) {
    return { success: false, status: 422, message: 'Aucun texte a traiter' };
  }
  if (trimmedText.length > MAX_INPUT_LENGTH) {
    return { success: false, status: 422, message: `Texte trop long (max ${MAX_INPUT_LENGTH} caracteres)` };
  }

  if (isRateLimited(userId)) {
    return {
      success: false,
      status: 429,
      message: `Limite d'utilisation de l'assistant IA atteinte (${RATE_LIMIT_MAX_CALLS} requetes / 10 min). Reessayez plus tard.`
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const url = `${AI_API_URL}?data=${encodeURIComponent(trimmedText)}&prompt=${encodeURIComponent(buildPrompt(action, locale))}`;
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error('[ai] Erreur API IA:', response.status);
      return {
        success: false,
        status: 502,
        message: "L'assistant IA est momentanement indisponible."
      };
    }

    // La reponse peut etre du texte brut ou du JSON selon l'API ;
    // on gere les deux cas de facon defensive.
    const raw = await response.text();
    let resultText = raw;
    try {
      const data = JSON.parse(raw);
      resultText =
        data.result || data.response || data.message || data.text || data.answer || data.data || raw;
      if (typeof resultText !== 'string') resultText = JSON.stringify(resultText);
    } catch {
      resultText = raw;
    }
    resultText = (resultText || '').toString().trim();
    if (resultText) {
      resultText = stripPromptLeak(resultText, action);
    }

    if (!resultText) {
      return { success: false, status: 502, message: "L'assistant IA n'a renvoye aucun resultat." };
    }

    return { success: true, result: resultText };
  } catch (error) {
    const timedOut = error.name === 'AbortError';
    console.error('[ai] Erreur appel IA:', error.message);
    return {
      success: false,
      status: 504,
      message: timedOut ? "L'assistant IA a mis trop de temps a repondre." : "Erreur lors de l'appel a l'assistant IA."
    };
  }
}
