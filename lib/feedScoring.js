import { query } from './db';
import { getPostAggregatesBatch } from './posts';

// =====================================================================
// FEED SCORING — algorithme deterministe et documente
// =====================================================================
//
// Chaque publication candidate recoit un score = somme ponderee de 8
// composantes, chacune normalisee entre 0 et 1 avant application de son
// poids. Aucune alea : a donnees egales, le score est toujours identique
// (pas de Math.random, pas d'appel a un modele externe).
//
//   score = W_RECENCY        * recenceNormalisee(post)
//         + W_SOCIAL         * proximiteSociale(auteur)
//         + W_AFFINITY       * affiniteAvecAuteur(viewer, auteur)
//         + W_MESSAGE        * affiniteMessages(viewer, auteur)
//         + W_HASHTAG        * affiniteHashtags(viewer, post)
//         + W_ENGAGEMENT     * engagementNormalise(post)
//         + W_EARLY_VELOCITY * velociteInitiale(post)
//         + W_AUTHOR_REACH   * activiteAuteur(auteur)
//
// Cette formule est le moteur de "reach" (portee) : plus ses composantes
// sont hautes pour une publication donnee vis-a-vis d'un viewer donne,
// plus cette publication touchera de personnes dans le flux de ce viewer.
//
// - recenceNormalisee : decroissance exponentielle, demi-vie 30h. Un post
//   qui vient d'etre publie vaut 1, un post vieux de 30h vaut ~0.5, etc.
//   Garantit qu'on ne masque jamais totalement les publications recentes.
// - proximiteSociale : 1 si ami accepte, 0.4 si amis en commun (decouverte
//   de reseau elargi), 0.15 pour un inconnu (permet quand meme une petite
//   decouverte de contenu public), 0 si c'est l'auteur lui-meme (non
//   applicable, gere a part).
// - affiniteAvecAuteur : base sur le nombre de reactions/commentaires que
//   le viewer a laisses sur les publications de cet auteur au cours des
//   30 derniers jours (log1p, plafonne a 1). Traduit "les publications
//   atteignent les personnes qui reagissent souvent a nos publications".
// - affiniteMessages : base sur le nombre de messages echanges entre le
//   viewer et l'auteur (conversations privees) au cours des 30 derniers
//   jours (log1p, plafonne a 1). Traduit "les publications atteignent les
//   personnes a qui on parle en messages".
// - affiniteHashtags : recouvrement entre les hashtags du post et les
//   hashtags avec lesquels le viewer a interagi (reactions/commentaires)
//   au cours des 30 derniers jours (log1p, plafonne a 1).
// - engagementNormalise : log1p(likes + commentaires*1.5 + partages*2),
//   normalise par rapport au maximum observe dans le lot de candidats
//   courant (evite qu'un seul post viral n'ecrase tout le classement).
// - velociteInitiale : nombre de reactions + commentaires recus par le
//   post dans les EARLY_VELOCITY_WINDOW_MINUTES suivant sa publication,
//   normalise sur le lot courant. Un post qui "decolle" vite est pousse
//   plus fort, comme un signal de viralite precoce.
// - activiteAuteur : reputation de portee de l'auteur, basee sur (a) le
//   nombre de publications sur les 30 derniers jours, (b) la regularite
//   du rythme de publication (ecart-type des intervalles entre posts,
//   plus l'auteur est regulier plus le bonus est fort) et (c) le nombre
//   d'amis (audience potentielle). Un auteur actif, regulier et avec un
//   large reseau voit ses publications legerement mieux distribuees.
//
// Un utilisateur tout nouveau (aucun ami, aucune interaction) obtient
// naturellement des composantes affinite/hashtag/message a 0 : le
// classement retombe alors sur recence + engagement global + velocite,
// ce qui donne un flux "tendances recentes" raisonnable sans code special.
//
// DIVERSITE : apres le tri par score, une passe de re-classement limite
// a 2 le nombre de publications consecutives du meme auteur (voir
// `applyDiversity`), pour eviter qu'un utilisateur tres actif ne
// monopolise le flux.
// =====================================================================

const WEIGHTS = {
  recency: 25,
  social: 18,
  affinity: 15,
  message: 10,
  hashtag: 8,
  engagement: 9,
  earlyVelocity: 8,
  authorReach: 7
};

const RECENCY_HALF_LIFE_HOURS = 30;
const AFFINITY_WINDOW_DAYS = 30;
const MESSAGE_AFFINITY_WINDOW_DAYS = 30;
const AUTHOR_ACTIVITY_WINDOW_DAYS = 30;
// Fenetre de reference plus large pour mesurer la regularite du rythme de
// publication (ecarts entre posts) : 30 jours suffit rarement a observer
// un rythme stable, donc on regarde jusqu'a 90 jours en arriere.
const AUTHOR_REGULARITY_WINDOW_DAYS = 90;
// Duree, apres la publication d'un post, pendant laquelle les reactions
// et commentaires comptent comme "vélocite initiale" (signal de reach).
const EARLY_VELOCITY_WINDOW_MINUTES = 15;
const MAX_CONSECUTIVE_SAME_AUTHOR = 2;
// Taille du lot de candidats recupere avant scoring. Un lot plus large
// donne un classement plus pertinent mais coute plus cher a calculer ;
// 200 est un compromis raisonnable pour un reseau social de taille
// moyenne (voir section "Notes de performance" du README).
const CANDIDATE_POOL_SIZE = 200;

function recencyScore(createdAt) {
  const ageHours = (Date.now() - new Date(createdAt.replace(' ', 'T') + 'Z').getTime()) / (1000 * 60 * 60);
  return Math.pow(0.5, Math.max(0, ageHours) / RECENCY_HALF_LIFE_HOURS);
}

function normalizedLog(value, max) {
  if (max <= 0) return 0;
  return Math.log1p(value) / Math.log1p(max);
}

// Recupere le lot de publications candidates visibles par le viewer
// (memes regles de visibilite grossiere que le fil chronologique existant
// dans /api/feed ; la verification fine reste faite par canViewPost en
// aval, ce scoring ne remplace pas la securite d'acces).
// Boost premium (voir /api/posts/[id]/boost).
const BOOST_MULTIPLIER = 1.5;
const BOOST_BONUS = 0.25;

async function getActiveBoostSet(postIds) {
  if (postIds.length === 0) return new Set();
  const rows = await query(
    `SELECT DISTINCT b.postId FROM postBoost b
     JOIN user bu ON bu.id = b.userId AND ((bu.premiumUntil IS NOT NULL AND bu.premiumUntil > NOW()) OR bu.role = 'admin')
     WHERE b.postId IN (${postIds.map(() => '?').join(', ')}) AND b.endsAt > NOW()`,
    postIds
  );
  return new Set(rows.map((row) => row.postId));
}

export async function getFeedCandidates(viewerId, poolSize = CANDIDATE_POOL_SIZE) {
  const base = await fetchCandidates(viewerId, poolSize, '');
  // Les publications boostees (premium) restent candidates meme si elles sont
  // plus anciennes que le lot recent.
  const boosted = await fetchCandidates(
    viewerId,
    40,
    `AND p.id IN (SELECT b.postId FROM postBoost b JOIN user bu ON bu.id = b.userId
                  WHERE b.endsAt > NOW() AND ((bu.premiumUntil IS NOT NULL AND bu.premiumUntil > NOW()) OR bu.role = 'admin'))`
  );
  const seen = new Set(base.map((row) => row.id));
  return [...base, ...boosted.filter((row) => !seen.has(row.id))];
}

async function fetchCandidates(viewerId, poolSize, extraWhere) {
  return query(
    `SELECT DISTINCT p.* FROM post p
     JOIN user author ON author.id = p.userId AND author.deactivatedAt IS NULL
     LEFT JOIN friend f ON f.status = 'accepted'
       AND ((f.requesterId = ? AND f.addresseeId = p.userId) OR (f.addresseeId = ? AND f.requesterId = p.userId))
     LEFT JOIN postVisibilityUser pvu ON pvu.postId = p.id AND pvu.userId = ?
     WHERE p.deletedAt IS NULL
       AND p.groupId IS NULL
       AND p.userId NOT IN (
         SELECT blockedId FROM block WHERE blockerId = ?
         UNION
         SELECT blockerId FROM block WHERE blockedId = ?
       )
       AND (
         p.userId = ?
         OR p.visibility = 'public'
         OR p.visibility = 'exceptFor'
         OR (p.visibility = 'friends' AND f.id IS NOT NULL)
         OR (p.visibility = 'onlyFor' AND pvu.userId IS NOT NULL)
       )
       ${extraWhere}
     ORDER BY p.createdAt DESC
     LIMIT ?`,
    [viewerId, viewerId, viewerId, viewerId, viewerId, viewerId, poolSize]
  );
}

async function getFriendIdSet(viewerId) {
  const rows = await query(
    `SELECT requesterId, addresseeId FROM friend WHERE status = 'accepted' AND (requesterId = ? OR addresseeId = ?)`,
    [viewerId, viewerId]
  );
  const ids = rows.map((row) => (row.requesterId === viewerId ? row.addresseeId : row.requesterId));
  return new Set(ids);
}

async function getMutualFriendIdSet(viewerId) {
  // Auteurs qui sont amis avec au moins un ami du viewer (reseau elargi),
  // utilise pour une petite bonification de decouverte meme sans lien direct.
  const rows = await query(
    `SELECT DISTINCT f2.requesterId as candidateId FROM friend f1
     JOIN friend f2 ON (f2.requesterId = f1.addresseeId OR f2.addresseeId = f1.addresseeId)
       AND f2.status = 'accepted'
     WHERE f1.status = 'accepted' AND (f1.requesterId = ? OR f1.addresseeId = ?)
     UNION
     SELECT DISTINCT f2.addresseeId as candidateId FROM friend f1
     JOIN friend f2 ON (f2.requesterId = f1.requesterId OR f2.addresseeId = f1.requesterId)
       AND f2.status = 'accepted'
     WHERE f1.status = 'accepted' AND (f1.requesterId = ? OR f1.addresseeId = ?)`,
    [viewerId, viewerId, viewerId, viewerId]
  );
  return new Set(rows.map((row) => row.candidateId).filter((id) => id !== viewerId));
}

async function getAuthorAffinityMap(viewerId) {
  const rows = await query(
    `SELECT p2.userId as authorId, COUNT(*) as cnt FROM reaction r
     JOIN post p2 ON p2.id = r.postId
     WHERE r.userId = ? AND r.createdAt > DATE_SUB(NOW(), INTERVAL ${AFFINITY_WINDOW_DAYS} DAY)
     GROUP BY p2.userId
     UNION ALL
     SELECT p2.userId as authorId, COUNT(*) as cnt FROM comment c
     JOIN post p2 ON p2.id = c.postId
     WHERE c.userId = ? AND c.deletedAt IS NULL AND c.createdAt > DATE_SUB(NOW(), INTERVAL ${AFFINITY_WINDOW_DAYS} DAY)
     GROUP BY p2.userId`,
    [viewerId, viewerId]
  );
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.authorId, (map.get(row.authorId) || 0) + Number(row.cnt));
  });
  return map;
}

async function getHashtagAffinityMap(viewerId) {
  const rows = await query(
    `SELECT h.name, COUNT(*) as cnt FROM reaction r
     JOIN postHashtag ph ON ph.postId = r.postId
     JOIN hashtag h ON h.id = ph.hashtagId
     WHERE r.userId = ? AND r.createdAt > DATE_SUB(NOW(), INTERVAL ${AFFINITY_WINDOW_DAYS} DAY)
     GROUP BY h.name
     UNION ALL
     SELECT h.name, COUNT(*) as cnt FROM comment c
     JOIN postHashtag ph ON ph.postId = c.postId
     JOIN hashtag h ON h.id = ph.hashtagId
     WHERE c.userId = ? AND c.deletedAt IS NULL AND c.createdAt > DATE_SUB(NOW(), INTERVAL ${AFFINITY_WINDOW_DAYS} DAY)
     GROUP BY h.name`,
    [viewerId, viewerId]
  );
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.name, (map.get(row.name) || 0) + Number(row.cnt));
  });
  return map;
}

// Frequence des messages prives echanges entre le viewer et chaque
// interlocuteur, sur les conversations a deux (hors groupes), au cours
// des MESSAGE_AFFINITY_WINDOW_DAYS derniers jours.
async function getMessageAffinityMap(viewerId) {
  const rows = await query(
    `SELECT cp2.userId as otherId, COUNT(m.id) as cnt
     FROM conversationParticipant cp1
     JOIN conversation c ON c.id = cp1.conversationId AND c.isGroup = 0
     JOIN conversationParticipant cp2 ON cp2.conversationId = cp1.conversationId AND cp2.userId != cp1.userId
     JOIN message m ON m.conversationId = cp1.conversationId
       AND m.createdAt > DATE_SUB(NOW(), INTERVAL ${MESSAGE_AFFINITY_WINDOW_DAYS} DAY)
     WHERE cp1.userId = ? AND cp1.leftAt IS NULL
     GROUP BY cp2.userId`,
    [viewerId]
  );
  const map = new Map();
  rows.forEach((row) => map.set(row.otherId, Number(row.cnt)));
  return map;
}

// Nombre de reactions + commentaires recus par chaque post candidat dans
// les EARLY_VELOCITY_WINDOW_MINUTES qui suivent sa publication : un signal
// de "decollage rapide" qui augmente la portee du post.
async function getEarlyVelocityMap(postIds) {
  if (postIds.length === 0) return new Map();
  const placeholders = postIds.map(() => '?').join(', ');
  const rows = await query(
    `SELECT r.postId, COUNT(*) as cnt FROM reaction r
     JOIN post p ON p.id = r.postId
     WHERE r.postId IN (${placeholders})
       AND r.createdAt <= DATE_ADD(p.createdAt, INTERVAL ${EARLY_VELOCITY_WINDOW_MINUTES} MINUTE)
     GROUP BY r.postId
     UNION ALL
     SELECT c.postId, COUNT(*) as cnt FROM comment c
     JOIN post p ON p.id = c.postId
     WHERE c.postId IN (${placeholders}) AND c.deletedAt IS NULL
       AND c.createdAt <= DATE_ADD(p.createdAt, INTERVAL ${EARLY_VELOCITY_WINDOW_MINUTES} MINUTE)
     GROUP BY c.postId`,
    [...postIds, ...postIds]
  );
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.postId, (map.get(row.postId) || 0) + Number(row.cnt));
  });
  return map;
}

// Ecart-type d'un tableau de nombres (population), utilise pour juger de
// la regularite du rythme de publication d'un auteur.
function standardDeviation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

// Score de "portee" propre a chaque auteur (independant du post), combinant
// son activite recente (nombre de publications), la regularite de son
// rythme de publication, et la taille de son reseau d'amis (audience
// potentielle). Renvoie une Map<authorId, score 0..1> deja normalisee sur
// le lot d'auteurs fourni.
async function getAuthorActivityReachMap(authorIds) {
  const map = new Map();
  if (authorIds.length === 0) return map;

  const placeholders = authorIds.map(() => '?').join(', ');

  const [postRows, friendRows] = await Promise.all([
    query(
      `SELECT userId, createdAt FROM post
       WHERE userId IN (${placeholders}) AND deletedAt IS NULL AND groupId IS NULL
         AND createdAt > DATE_SUB(NOW(), INTERVAL ${AUTHOR_REGULARITY_WINDOW_DAYS} DAY)
       ORDER BY userId, createdAt ASC`,
      authorIds
    ),
    query(
      `SELECT requesterId, addresseeId FROM friend
       WHERE status = 'accepted' AND (requesterId IN (${placeholders}) OR addresseeId IN (${placeholders}))`,
      [...authorIds, ...authorIds]
    )
  ]);

  // Regroupe les dates de publication par auteur.
  const postsByAuthor = new Map();
  postRows.forEach((row) => {
    if (!postsByAuthor.has(row.userId)) postsByAuthor.set(row.userId, []);
    postsByAuthor.get(row.userId).push(new Date(row.createdAt.replace(' ', 'T') + 'Z').getTime());
  });

  // Compte les amis par auteur.
  const friendCount = new Map();
  authorIds.forEach((id) => friendCount.set(id, 0));
  friendRows.forEach((row) => {
    if (authorIds.includes(row.requesterId)) friendCount.set(row.requesterId, (friendCount.get(row.requesterId) || 0) + 1);
    if (authorIds.includes(row.addresseeId)) friendCount.set(row.addresseeId, (friendCount.get(row.addresseeId) || 0) + 1);
  });

  const thirtyDaysAgo = Date.now() - AUTHOR_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const rawPerAuthor = new Map();
  authorIds.forEach((authorId) => {
    const timestamps = postsByAuthor.get(authorId) || [];
    const recentCount = timestamps.filter((t) => t >= thirtyDaysAgo).length;

    let regularity = 0.3; // valeur neutre-basse quand on manque de donnees
    if (timestamps.length >= 3) {
      const intervalsHours = [];
      for (let i = 1; i < timestamps.length; i += 1) {
        intervalsHours.push((timestamps[i] - timestamps[i - 1]) / (1000 * 60 * 60));
      }
      const { mean, stdDev } = standardDeviation(intervalsHours);
      // Coefficient de variation faible = rythme regulier = bonus proche de 1.
      const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
      regularity = 1 / (1 + coefficientOfVariation);
    }

    rawPerAuthor.set(authorId, { recentCount, regularity, friends: friendCount.get(authorId) || 0 });
  });

  const maxRecentCount = Math.max(1, ...[...rawPerAuthor.values()].map((v) => v.recentCount));
  const maxFriends = Math.max(1, ...[...rawPerAuthor.values()].map((v) => v.friends));

  authorIds.forEach((authorId) => {
    const data = rawPerAuthor.get(authorId);
    const activityScore = normalizedLog(data.recentCount, maxRecentCount);
    const friendsScore = normalizedLog(data.friends, maxFriends);
    const score = activityScore * 0.6 + data.regularity * 0.25 + friendsScore * 0.15;
    map.set(authorId, score);
  });

  return map;
}

async function getPostHashtagsMap(postIds) {
  if (postIds.length === 0) return new Map();
  const placeholders = postIds.map(() => '?').join(', ');
  const rows = await query(
    `SELECT ph.postId, h.name FROM postHashtag ph JOIN hashtag h ON h.id = ph.hashtagId WHERE ph.postId IN (${placeholders})`,
    postIds
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.postId)) map.set(row.postId, []);
    map.get(row.postId).push(row.name);
  });
  return map;
}

// Re-classement pour la diversite : parcourt la liste triee par score et
// reporte plus loin dans le flux toute publication qui creerait plus de
// `MAX_CONSECUTIVE_SAME_AUTHOR` publications consecutives du meme auteur,
// en la remplacant par la meilleure publication suivante d'un autre
// auteur. Deterministe, ne melange jamais aleatoirement l'ordre.
function applyDiversity(sortedRows) {
  const result = [];
  const pending = [...sortedRows];

  while (pending.length > 0) {
    const lastAuthors = result.slice(-MAX_CONSECUTIVE_SAME_AUTHOR).map((row) => row.userId);
    const blockedAuthor =
      lastAuthors.length === MAX_CONSECUTIVE_SAME_AUTHOR && lastAuthors.every((id) => id === lastAuthors[0])
        ? lastAuthors[0]
        : null;

    let pickIndex = 0;
    if (blockedAuthor !== null) {
      const alternativeIndex = pending.findIndex((row) => row.userId !== blockedAuthor);
      if (alternativeIndex !== -1) pickIndex = alternativeIndex;
    }

    result.push(pending[pickIndex]);
    pending.splice(pickIndex, 1);
  }

  return result;
}

// Calcule le score de chaque publication candidate et renvoie la liste
// triee (avant pagination). `viewerId` est l'utilisateur pour qui le
// feed est personnalise.
export async function scoreAndRankPosts(viewerId, candidateRows) {
  if (candidateRows.length === 0) return [];

  const postIds = candidateRows.map((row) => row.id);
  const authorIds = [...new Set(candidateRows.map((row) => row.userId))];

  const [
    friendIds,
    mutualIds,
    authorAffinity,
    messageAffinity,
    hashtagAffinity,
    postHashtags,
    aggregates,
    earlyVelocity,
    authorReach,
    boostedPosts
  ] = await Promise.all([
    getFriendIdSet(viewerId),
    getMutualFriendIdSet(viewerId),
    getAuthorAffinityMap(viewerId),
    getMessageAffinityMap(viewerId),
    getHashtagAffinityMap(viewerId),
    getPostHashtagsMap(postIds),
    getPostAggregatesBatch(postIds, viewerId),
    getEarlyVelocityMap(postIds),
    getAuthorActivityReachMap(authorIds),
    getActiveBoostSet(postIds)
  ]);

  const maxAuthorAffinity = Math.max(1, ...authorAffinity.values());
  const maxMessageAffinity = Math.max(1, ...messageAffinity.values());
  const maxHashtagAffinity = Math.max(1, ...hashtagAffinity.values());
  const maxEarlyVelocity = Math.max(1, ...earlyVelocity.values());
  const maxEngagementRaw = Math.max(
    1,
    ...postIds.map((id) => {
      const agg = aggregates[id];
      return agg.totalReactions + agg.commentCount * 1.5 + agg.shareCount * 2;
    })
  );

  const scored = candidateRows.map((row) => {
    let social = 0.15;
    if (row.userId === viewerId) social = 0;
    else if (friendIds.has(row.userId)) social = 1;
    else if (mutualIds.has(row.userId)) social = 0.4;

    const affinityRaw = authorAffinity.get(row.userId) || 0;
    const affinity = normalizedLog(affinityRaw, maxAuthorAffinity);

    const messageRaw = messageAffinity.get(row.userId) || 0;
    const messageScore = normalizedLog(messageRaw, maxMessageAffinity);

    const hashtags = postHashtags.get(row.id) || [];
    const hashtagRaw = hashtags.reduce((sum, name) => sum + (hashtagAffinity.get(name) || 0), 0);
    const hashtagScore = normalizedLog(hashtagRaw, maxHashtagAffinity);

    const agg = aggregates[row.id];
    const engagementRaw = agg.totalReactions + agg.commentCount * 1.5 + agg.shareCount * 2;
    const engagement = normalizedLog(engagementRaw, maxEngagementRaw);

    const earlyVelocityRaw = earlyVelocity.get(row.id) || 0;
    const earlyVelocityScore = normalizedLog(earlyVelocityRaw, maxEarlyVelocity);

    const reach = row.userId === viewerId ? 0 : authorReach.get(row.userId) || 0;

    const recency = recencyScore(row.createdAt);

    const score =
      WEIGHTS.recency * recency +
      WEIGHTS.social * social +
      WEIGHTS.affinity * affinity +
      WEIGHTS.message * messageScore +
      WEIGHTS.hashtag * hashtagScore +
      WEIGHTS.engagement * engagement +
      WEIGHTS.earlyVelocity * earlyVelocityScore +
      WEIGHTS.authorReach * reach;

    // Boost premium : bonus fixe + multiplicateur, applique a tous les viewers.
    const boostedScore = boostedPosts.has(row.id) ? score * BOOST_MULTIPLIER + BOOST_BONUS : score;

    return { ...row, _score: boostedScore };
  });

  scored.sort((a, b) => b._score - a._score || new Date(b.createdAt) - new Date(a.createdAt));

  return applyDiversity(scored);
}
