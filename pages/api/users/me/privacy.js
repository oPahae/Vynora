import { getUserFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  const hasIsPrivate = req.body?.isPrivate !== undefined;
  const hasShowOnlineStatus = req.body?.showOnlineStatus !== undefined;
  const hasShowReadReceipts = req.body?.showReadReceipts !== undefined;

  if (!hasIsPrivate && !hasShowOnlineStatus && !hasShowReadReceipts) {
    return res.status(422).json({ success: false, message: 'Aucun reglage a mettre a jour' });
  }

  const fields = [];
  const values = [];
  const responseBody = { success: true };

  if (hasIsPrivate) {
    const isPrivate = Boolean(req.body.isPrivate);
    fields.push('isPrivate = ?');
    values.push(isPrivate ? 1 : 0);
    responseBody.isPrivate = isPrivate;
  }
  if (hasShowOnlineStatus) {
    const showOnlineStatus = Boolean(req.body.showOnlineStatus);
    fields.push('showOnlineStatus = ?');
    values.push(showOnlineStatus ? 1 : 0);
    responseBody.showOnlineStatus = showOnlineStatus;
  }
  if (hasShowReadReceipts) {
    const showReadReceipts = Boolean(req.body.showReadReceipts);
    fields.push('showReadReceipts = ?');
    values.push(showReadReceipts ? 1 : 0);
    responseBody.showReadReceipts = showReadReceipts;
  }

  try {
    await query(`UPDATE user SET ${fields.join(', ')} WHERE id = ?`, [...values, payload.id]);
    return res.status(200).json(responseBody);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
