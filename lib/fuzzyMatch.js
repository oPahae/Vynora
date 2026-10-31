// =====================================================================
// RECHERCHE FLOUE (tolerante aux fautes de frappe)
// =====================================================================
// Permet a la recherche globale de retrouver un mot meme quand l'utilisateur
// a fait une faute de frappe ou une inversion de lettres : par exemple le
// terme "Bojnouur" doit retrouver une publication contenant "Bonjour".
//
// Principe : pour chaque mot du contenu compare au terme recherche, on
// calcule une distance de Damerau-Levenshtein restreinte (insertion,
// suppression, substitution, et transposition de deux lettres adjacentes,
// qui est la faute de frappe la plus courante). Si cette distance reste
// sous un seuil qui grandit avec la longueur du mot, on considere qu'il y a
// correspondance. Une correspondance exacte ou une simple sous-chaine reste
// toujours prioritaire sur une correspondance floue lors du classement.
// =====================================================================

function normalize(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Distance de Damerau-Levenshtein restreinte (optimal string alignment).
function editDistance(a, b) {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const d = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i += 1) d[i][0] = i;
  for (let j = 0; j <= bl; j += 1) d[0][j] = j;

  for (let i = 1; i <= al; i += 1) {
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[al][bl];
}

// Seuil de tolerance : plus le mot est long, plus on tolere de fautes,
// sinon un mot de 3 lettres matcherait n'importe quoi.
function thresholdFor(length) {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  return 3;
}

// Compare un terme recherche a un mot unique. Renvoie un score de
// pertinence (plus haut = meilleur) ou null si aucune correspondance,
// meme floue, n'est trouvee.
export function fuzzyWordScore(word, term) {
  const w = normalize(word);
  const t = normalize(term);
  if (!t || !w) return null;

  if (w === t) return 100;
  if (w.startsWith(t) || t.startsWith(w)) return 90;
  if (w.includes(t) || t.includes(w)) return 80;

  const distance = editDistance(w, t);
  const threshold = thresholdFor(Math.max(w.length, t.length));
  if (distance > threshold) return null;

  // Score decroissant avec la distance, toujours sous les correspondances
  // exactes/sous-chaines ci-dessus.
  return 60 - distance * 10;
}

// Compare un terme recherche a un texte complet (plusieurs mots) : on
// tokenise le texte et on garde le meilleur score parmi tous les mots,
// pour retrouver un mot mal orthographie au milieu d'une phrase.
export function fuzzyTextScore(text, term) {
  const t = normalize(term).trim();
  if (!t) return null;

  const normalizedText = normalize(text);
  if (normalizedText.includes(t)) return 85;

  const words = normalizedText.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let best = null;
  for (const word of words) {
    const score = fuzzyWordScore(word, t);
    if (score !== null && (best === null || score > best)) best = score;
  }
  return best;
}

export function fuzzyMatches(text, term) {
  return fuzzyTextScore(text, term) !== null;
}
