import { query } from '@/lib/db';
import { fuzzyTextScore } from '@/lib/fuzzyMatch';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CANDIDATES = 5;
const FUZZY_POOL_SIZE = 500;

function maskPart(value) {
  if (value.length <= 2) return `${value[0] || ''}*`;
  return `${value.slice(0, 2)}${'*'.repeat(Math.min(6, value.length - 2))}`;
}

// "jean.dupont@gmail.com" -> "je******@gm****.com" : l'email complet n'est
// jamais renvoye au navigateur lors de la recherche de compte.
export function maskEmail(email) {
  const [local, domain = ''] = email.split('@');
  const [domainName, ...rest] = domain.split('.');
  return `${maskPart(local)}@${maskPart(domainName)}${rest.length ? `.${rest.join('.')}` : ''}`;
}

// Recherche par email exact, ou par nom (sous-chaine, puis tolerance aux
// fautes de frappe si rien n'est trouve). Renvoie au plus 5 candidats.
export async function findAccountCandidates(rawQuery) {
  const term = rawQuery.trim();
  if (term.length < 2) return [];

  if (EMAIL_REGEX.test(term)) {
    return query('SELECT id, firstName, lastName, email, avatarId FROM user WHERE email = ? LIMIT 1', [term.toLowerCase()]);
  }

  const likeTerm = `%${term}%`;
  const exact = await query(
    `SELECT id, firstName, lastName, email, avatarId FROM user
     WHERE firstName LIKE ? OR lastName LIKE ? OR CONCAT(firstName, ' ', lastName) LIKE ?
     ORDER BY firstName ASC, lastName ASC LIMIT ?`,
    [likeTerm, likeTerm, likeTerm, MAX_CANDIDATES]
  );
  if (exact.length > 0) return exact;

  const pool = await query('SELECT id, firstName, lastName, email, avatarId FROM user LIMIT ?', [FUZZY_POOL_SIZE]);
  return pool
    .map((row) => ({ row, score: fuzzyTextScore(`${row.firstName} ${row.lastName}`, term) }))
    .filter((entry) => entry.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map((entry) => entry.row);
}
