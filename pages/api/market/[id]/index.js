import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { saveMediaFiles } from '@/lib/upload';
import {
  MARKET_SELECT,
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

async function loadProduct(productId, viewerId) {
  const visibility = marketVisibilitySql(viewerId);
  const rows = await query(`${MARKET_SELECT} WHERE p.id = ? AND ${visibility.clause} LIMIT 1`, [productId, ...visibility.params]);
  return rows[0] || null;
}

export default async function handler(req, res) {
  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const productId = Number(req.query.id);
  if (!Number.isInteger(productId)) {
    return res.status(422).json({ success: false, message: 'Requete invalide' });
  }

  try {
    const row = await loadProduct(productId, payload.id);
    if (!row) return res.status(404).json({ success: false, message: 'Annonce introuvable' });
    const isSeller = row.sellerId === payload.id;

    if (req.method === 'GET') {
      if (!isSeller) await query('UPDATE marketProduct SET viewsCount = viewsCount + 1 WHERE id = ?', [productId]);
      const [product] = await hydrateProducts([row], payload.id, { includeContact: true });
      return res.status(200).json({ success: true, product });
    }

    if (req.method === 'PUT') {
      if (!isSeller) return res.status(403).json({ success: false, message: 'Action non autorisee' });

      const { fields, files } = await parseMarketRequest(req);
      const { values, error } = validateProductFields(fields, { partial: true });
      if (error) return res.status(422).json({ success: false, message: error });

      const status = fields.status !== undefined ? fields.status.toString() : null;
      if (status !== null) {
        if (!['active', 'sold'].includes(status)) {
          return res.status(422).json({ success: false, message: 'Statut invalide' });
        }
        values.status = status;
      }

      let removeIds = [];
      if (fields.removeMediaIds) {
        try {
          removeIds = JSON.parse(fields.removeMediaIds.toString()).map((id) => Number(id)).filter((id) => Number.isInteger(id));
        } catch (parseError) {
          removeIds = [];
        }
      }

      const current = await query('SELECT mediaId FROM marketProductMedia WHERE productId = ?', [productId]);
      const remaining = current.filter((m) => !removeIds.includes(m.mediaId)).length + files.length;
      if (remaining < 1) return res.status(422).json({ success: false, message: 'Ajoutez au moins une photo' });
      if (remaining > MARKET_MAX_PHOTOS) {
        return res.status(422).json({ success: false, message: `Maximum ${MARKET_MAX_PHOTOS} photos` });
      }

      const merged = {
        phone: row.phone,
        whatsapp: row.whatsapp,
        allowMessages: row.allowMessages,
        ...values
      };
      if (!merged.phone && !merged.whatsapp && !merged.allowMessages) {
        return res.status(422).json({
          success: false,
          message: 'Indiquez au moins un moyen de contact (telephone, WhatsApp ou messages)'
        });
      }

      const keys = Object.keys(values);
      if (keys.length > 0) {
        await query(`UPDATE marketProduct SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`, [
          ...keys.map((key) => values[key]),
          productId
        ]);
      }

      if (removeIds.length > 0) {
        await query(
          `DELETE FROM marketProductMedia WHERE productId = ? AND mediaId IN (${removeIds.map(() => '?').join(', ')})`,
          [productId, ...removeIds]
        );
      }
      if (files.length > 0) {
        const mediaIds = await saveMediaFiles(files, payload.id);
        const startPos = current.length;
        const mediaValues = mediaIds.map((mediaId, index) => [productId, mediaId, startPos + index]);
        await query(
          `INSERT INTO marketProductMedia (productId, mediaId, position) VALUES ${mediaValues.map(() => '(?, ?, ?)').join(', ')}`,
          mediaValues.flat()
        );
      }

      const updated = await loadProduct(productId, payload.id);
      const [product] = await hydrateProducts([updated], payload.id, { includeContact: true });
      return res.status(200).json({ success: true, product });
    }

    if (req.method === 'DELETE') {
      if (!isSeller && !payload.isAdmin) return res.status(403).json({ success: false, message: 'Action non autorisee' });
      await query('UPDATE marketProduct SET deletedAt = NOW(), status = ? WHERE id = ?', ['removed', productId]);
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
}
