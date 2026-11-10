import { query } from './db';
import { mediaUrl, parseUpload, getField } from './upload';
import { readJsonBody } from './uploadSessions';

// =====================================================================
// Market : annonces entre membres (vente / achat).
// L'achat se fait HORS de l'application : le vendeur indique son telephone
// et/ou son WhatsApp, et/ou accepte d'etre contacte via les messages.
// =====================================================================

export const MARKET_CATEGORIES = [
  'electronics',
  'vehicles',
  'realestate',
  'fashion',
  'home',
  'beauty',
  'sports',
  'kids',
  'books',
  'services',
  'other'
];
export const MARKET_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'for_parts'];
export const MARKET_CURRENCIES = ['MAD', 'EUR', 'USD'];
export const MARKET_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MARKET_MAX_PHOTOS = 8;
export const MARKET_MAX_COMMENT = 1000;

// Indicatif pays ajoute aux numeros WhatsApp saisis au format national
// (ex: 0612345678 -> 212612345678). Modifiable via .env.
const DEFAULT_COUNTRY_CODE = (process.env.MARKET_DEFAULT_COUNTRY_CODE || '212').replace(/\D/g, '');

// Garde chiffres et "+" initial ; renvoie null si le numero est invalide.
export function normalizePhone(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const plus = raw.startsWith('+') ? '+' : '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 16) return null;
  return `${plus}${digits}`;
}

export function whatsappUrl(value) {
  const phone = normalizePhone(value);
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!phone.startsWith('+')) {
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  }
  return `https://wa.me/${digits}`;
}

export const MARKET_SELECT = `
  SELECT p.id, p.sellerId, p.title, p.description, p.price, p.currency, p.category, p.conditionType, p.city,
         p.phone, p.whatsapp, p.allowMessages, p.status, p.viewsCount, p.createdAt, p.updatedAt,
         u.firstName AS sellerFirstName, u.lastName AS sellerLastName, u.avatarId AS sellerAvatarId,
         ((u.premiumUntil IS NOT NULL AND u.premiumUntil > NOW()) OR u.role = 'admin') AS sellerVerified
  FROM marketProduct p
  JOIN user u ON u.id = p.sellerId
`;

// Conditions de visibilite (alias : p = marketProduct, u = user).
export function marketVisibilitySql(viewerId) {
  return {
    clause: `p.deletedAt IS NULL AND p.status <> 'removed' AND u.bannedAt IS NULL
      AND NOT EXISTS (SELECT 1 FROM block b WHERE (b.blockerId = ? AND b.blockedId = p.sellerId) OR (b.blockerId = p.sellerId AND b.blockedId = ?))`,
    params: [viewerId, viewerId]
  };
}

export async function hydrateProducts(rows, viewerId, { includeContact = false } = {}) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');

  const [mediaRows, likeRows, commentRows] = await Promise.all([
    query(`SELECT productId, mediaId FROM marketProductMedia WHERE productId IN (${placeholders}) ORDER BY position ASC, id ASC`, ids),
    query(
      `SELECT productId, COUNT(*) AS total, SUM(userId = ?) AS mine
         FROM marketProductLike WHERE productId IN (${placeholders}) GROUP BY productId`,
      [viewerId || 0, ...ids]
    ),
    query(
      `SELECT productId, COUNT(*) AS total FROM marketComment
        WHERE productId IN (${placeholders}) AND deletedAt IS NULL GROUP BY productId`,
      ids
    )
  ]);

  const media = {};
  mediaRows.forEach((row) => {
    if (!media[row.productId]) media[row.productId] = [];
    media[row.productId].push({ id: row.mediaId, url: mediaUrl(row.mediaId) });
  });
  const likes = {};
  likeRows.forEach((row) => {
    likes[row.productId] = { total: Number(row.total), mine: Number(row.mine) > 0 };
  });
  const comments = {};
  commentRows.forEach((row) => {
    comments[row.productId] = Number(row.total);
  });

  return rows.map((row) => {
    const product = {
      id: row.id,
      sellerId: row.sellerId,
      title: row.title,
      description: row.description,
      price: Number(row.price),
      currency: row.currency,
      category: row.category,
      condition: row.conditionType,
      city: row.city,
      status: row.status,
      viewsCount: row.viewsCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      allowMessages: Boolean(row.allowMessages),
      seller: {
        id: row.sellerId,
        firstName: row.sellerFirstName,
        lastName: row.sellerLastName,
        avatar: mediaUrl(row.sellerAvatarId),
        verified: Boolean(row.sellerVerified)
      },
      media: media[row.id] || [],
      likeCount: likes[row.id] ? likes[row.id].total : 0,
      likedByMe: likes[row.id] ? likes[row.id].mine : false,
      commentCount: comments[row.id] || 0
    };
    if (includeContact) {
      product.contact = {
        phone: row.phone || null,
        whatsapp: row.whatsapp || null,
        whatsappUrl: whatsappUrl(row.whatsapp)
      };
    }
    return product;
  });
}

// Lit une requete JSON ou multipart (fichiers `media`).
export async function parseMarketRequest(req) {
  const contentType = String(req.headers['content-type'] || '');
  if (contentType.includes('application/json')) {
    const body = await readJsonBody(req);
    const fields = {};
    Object.keys(body).forEach((key) => {
      const value = body[key];
      fields[key] = typeof value === 'string' ? value : JSON.stringify(value);
    });
    return { fields, files: [] };
  }
  return parseUpload(req, MARKET_IMAGE_TYPES);
}

// Valide les champs d'une annonce. `partial` : mise a jour (champs absents ignores).
export function validateProductFields(fields, { partial = false } = {}) {
  const out = {};
  const has = (name) => fields[name] !== undefined;
  const str = (name, max) => getField(fields, name, '').toString().trim().slice(0, max);

  if (!partial || has('title')) {
    const title = str('title', 150);
    if (title.length < 3) return { error: 'Le titre doit contenir au moins 3 caracteres' };
    out.title = title;
  }
  if (!partial || has('description')) out.description = str('description', 5000) || null;
  if (!partial || has('price')) {
    const price = Number(getField(fields, 'price', '').toString().replace(',', '.'));
    if (!Number.isFinite(price) || price < 0 || price > 999999999) return { error: 'Prix invalide' };
    out.price = Math.round(price * 100) / 100;
  }
  if (!partial || has('currency')) {
    const currency = str('currency', 8) || 'MAD';
    if (!MARKET_CURRENCIES.includes(currency)) return { error: 'Devise invalide' };
    out.currency = currency;
  }
  if (!partial || has('category')) {
    const category = str('category', 40) || 'other';
    if (!MARKET_CATEGORIES.includes(category)) return { error: 'Categorie invalide' };
    out.category = category;
  }
  if (!partial || has('condition')) {
    const condition = str('condition', 20) || 'good';
    if (!MARKET_CONDITIONS.includes(condition)) return { error: 'Etat invalide' };
    out.conditionType = condition;
  }
  if (!partial || has('city')) out.city = str('city', 100) || null;
  if (!partial || has('phone')) {
    const raw = str('phone', 40);
    const phone = normalizePhone(raw);
    if (raw && !phone) return { error: 'Numero de telephone invalide' };
    out.phone = phone;
  }
  if (!partial || has('whatsapp')) {
    const raw = str('whatsapp', 40);
    const whatsapp = normalizePhone(raw);
    if (raw && !whatsapp) return { error: 'Numero WhatsApp invalide' };
    out.whatsapp = whatsapp;
  }
  if (!partial || has('allowMessages')) {
    const value = getField(fields, 'allowMessages', 'true').toString();
    out.allowMessages = value === 'true' || value === '1' ? 1 : 0;
  }
  return { values: out };
}
