import { getUserFromRequest } from '@/lib/auth';
import { getNotifications, getUnreadNotificationCount, NOTIFICATION_CATEGORIES } from '@/lib/notifications';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Methode non autorisee' });
  }

  const payload = await getUserFromRequest(req);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Non authentifie' });
  }

  try {
    const offset = Number(req.query.offset) || 0;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const category = Object.keys(NOTIFICATION_CATEGORIES).includes(req.query.category) ? req.query.category : 'all';

    const [notifications, unreadCount] = await Promise.all([
      getNotifications(payload.id, offset, limit, category),
      getUnreadNotificationCount(payload.id)
    ]);

    return res.status(200).json({ success: true, notifications, unreadCount, hasMore: notifications.length === limit });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
