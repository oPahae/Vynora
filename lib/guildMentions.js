// =====================================================================
// MENTIONS DANS LES SALONS DE SERVEUR (@membre, @role)
// =====================================================================
// Approche texte simple (pas de balisage cache) : on detecte "@Nom Complet"
// ou "@NomDeRole" directement dans le contenu du message, en comparant
// aux membres/roles ACTUELS du serveur au moment de l'envoi ou de
// l'affichage. C'est volontairement plus simple qu'un systeme a jetons
// (Discord utilise des ids caches de type <@123>) : plus facile a taper
// dans un simple champ texte, au prix d'une petite ambiguite si deux
// membres partagent exactement le meme nom complet (cas rare, accepte).
// Le role @everyone n'est jamais une cible de mention (pour eviter les
// notifications de masse accidentelles).
// =====================================================================

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Construit la liste des cibles de mention possibles a partir des membres
// et des roles d'un serveur, triee par longueur de nom decroissante (pour
// qu'un nom plus long/specifique soit reconnu avant un nom plus court).
export function buildMentionCandidates(members, roles) {
  const candidates = [];
  (members || []).forEach((member) => {
    const label = `${member.firstName} ${member.lastName}`.trim();
    if (label) candidates.push({ type: 'user', id: member.id, label, color: null });
  });
  (roles || [])
    .filter((role) => !role.isDefault)
    .forEach((role) => {
      if (role.name) candidates.push({ type: 'role', id: role.id, label: role.name, color: role.color });
    });
  return candidates.sort((a, b) => b.label.length - a.label.length);
}

function buildMentionRegex(candidates) {
  if (candidates.length === 0) return null;
  const alternation = candidates.map((c) => escapeRegExp(c.label)).join('|');
  return new RegExp(`@(${alternation})(?![\\w])`, 'g');
}

// Decoupe le contenu en segments texte/mention pour l'affichage. Chaque
// segment est soit { text } soit { mention: candidate }.
export function splitMentionSegments(content, candidates) {
  const regex = buildMentionRegex(candidates);
  if (!regex || !content) return [{ text: content || '' }];

  const byLabel = new Map(candidates.map((c) => [c.label, c]));
  const segments = [];
  let lastIndex = 0;
  let match = regex.exec(content);
  while (match) {
    if (match.index > lastIndex) segments.push({ text: content.slice(lastIndex, match.index) });
    segments.push({ mention: byLabel.get(match[1]) });
    lastIndex = match.index + match[0].length;
    match = regex.exec(content);
  }
  if (lastIndex < content.length) segments.push({ text: content.slice(lastIndex) });
  return segments;
}

// Renvoie les ids distincts de membres et de roles mentionnes dans le
// contenu (utilise cote serveur pour envoyer les notifications).
export function extractMentionedIds(content, candidates) {
  const regex = buildMentionRegex(candidates);
  const userIds = new Set();
  const roleIds = new Set();
  if (!regex || !content) return { userIds, roleIds };

  const byLabel = new Map(candidates.map((c) => [c.label, c]));
  let match = regex.exec(content);
  while (match) {
    const candidate = byLabel.get(match[1]);
    if (candidate) (candidate.type === 'user' ? userIds : roleIds).add(candidate.id);
    match = regex.exec(content);
  }
  return { userIds, roleIds };
}
