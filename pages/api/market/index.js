import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { saveMediaFiles } from '@/lib/upload';
import {
  MARKET_SELECT,
  MARKET_CATEGORIES,
  MARKET_MAX_PHOTOS,
  hydrateProducts,
  marketVisibilitySql,
  parseMarketRequest,
  validateProductFields
} from '@/lib/market';

export const config = {
  api: {
    bodyParser: false
  }
};

const SORTS = {
  recent: 'p.createdAt DESC, p.id DESC',
  priceAsc: 'p.price ASC, p.id DESC',
  priceDesc: 'p.price DESC, p.id DESC',
  popular: '(SELECT COUNT(*) FROM marketProductLike l WHERE l.productId = p.id) DESC, p.createdAt DESC'
};

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  if (req.method === 'GET') {
    try {
      const visibility = marketVisibilitySql(payload.id);
      const where = [visibility.clause];
      const params = [...visibility.params];

      const sellerId = Number(req.query.sellerId);
      const mine = req.query.mine === '1' || req.query.mine === 'true';
      if (mine) {
        where.push('p.sellerId = ?');
        params.push(payload.id);
      } else if (Number.isInteger(sellerId) && sellerId > 0) {
        where.push('p.sellerId = ?');
        params.push(sellerId);
      } else {
        where.push("p.status = 'active'");
      }

      const q = (req.query.query || '').toString().trim().slice(0, 100);
      if (q) {
        where.push('(p.title LIKE ? OR p.description LIKE ?)');
        params.push(`%${q}%`, `%${q}%`);
      }
      const category = (req.query.category || '').toString();
      if (MARKET_CATEGORIES.includes(category)) {
        where.push('p.category = ?');
        params.push(category);
      }
      const city = (req.query.city || '').toString().trim().slice(0, 100);
      if (city) {
        where.push('p.city LIKE ?');
        params.push(`%${city}%`);
      }
      const minPrice = Number(req.query.minPrice);
      if (req.query.minPrice !== undefined && req.query.minPrice !== '' && Number.isFinite(minPrice)) {
        where.push('p.price >= ?');
        params.push(minPrice);
      }
      const maxPrice = Number(req.query.maxPrice);
      if (req.query.maxPrice !== undefined && req.query.maxPrice !== '' && Number.isFinite(maxPrice)) {
        where.push('p.price <= ?');
        params.push(maxPrice);
      }

      const offset = Math.max(0, Number(req.query.offset) || 0);
      const limit = Math.min(Number(req.query.limit) || 12, 30);
      const order = SORTS[req.query.sort] || SORTS.recent;

      const rows = await query(
        `${MARKET_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`,
        [...params, limit + 1, offset]
      );
      const hasMore = rows.length > limit;
      const products = await hydrateProducts(rows.slice(0, limit), payload.id);
      return res.status(200).json({ success: true, products, hasMore });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { fields, files } = await parseMarketRequest(req);
      const { values, error } = validateProductFields(fields);
      if (error) return res.status(422).json({ success: false, message: error });

      if (files.length === 0) {
        return res.status(422).json({ success: false, message: 'Ajoutez au moins une photo' });
      }
      if (files.length > MARKET_MAX_PHOTOS) {
        return res.status(422).json({ success: false, message: `Maximum ${MARKET_MAX_PHOTOS} photos` });
      }
      if (!values.phone && !values.whatsapp && !values.allowMessages) {
        return res.status(422).json({
          success: false,
          message: 'Indiquez au moins un moyen de contact (telephone, WhatsApp ou messages)'
        });
      }

      const result = await query(
        `INSERT INTO marketProduct (sellerId, title, description, price, currency, category, conditionType, city, phone, whatsapp, allowMessages)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.id,
          values.title,
          values.description,
          values.price,
          values.currency,
          values.category,
          values.conditionType,
          values.city,
          values.phone,
          values.whatsapp,
          values.allowMessages
        ]
      );
      const productId = result.insertId;

      const mediaIds = await saveMediaFiles(files, payload.id);
      const mediaValues = mediaIds.map((mediaId, index) => [productId, mediaId, index]);
      await query(
        `INSERT INTO marketProductMedia (productId, mediaId, position) VALUES ${mediaValues.map(() => '(?, ?, ?)').join(', ')}`,
        mediaValues.flat()
      );

      const rows = await query(`${MARKET_SELECT} WHERE p.id = ? LIMIT 1`, [productId]);
      const [product] = await hydrateProducts(rows, payload.id, { includeContact: true });

      return res.status(201).json({ success: true, product });
    } catch (error) {
      return res.status(422).json({ success: false, message: error.message || 'Erreur lors de la creation' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ success: false, message: 'Methode non autorisee' });
}
