import { tr } from '@/lib/i18n/server';
import { isSupportedLocale } from '@/lib/i18n/config';
import webpush from 'web-push';
import { query } from './db';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_CONTACT_EMAIL = process.env.VAPID_CONTACT_EMAIL || 'admin@example.com';

// Si aucune cle VAPID n'est configuree, les notifications push restent
// desactivees proprement : aucune erreur, le reste de l'application (y
// compris les notifications in-app existantes) continue de fonctionner
// normalement. Voir le README ("Configuration des notifications push")
// pour generer une paire de cles.
export const isPushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (isPushConfigured) {
  webpush.setVapidDetails(`mailto:${VAPID_CONTACT_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else if (typeof window === 'undefined') {
  // Averti une seule fois au demarrage du serveur (pas a chaque requete).
  console.warn(
    '[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absentes : notifications push desactivees (voir README).'
  );
}

export function getVapidPublicKey() {
  return isPushConfigured ? VAPID_PUBLIC_KEY : null;
}

export async function saveSubscription(userId, subscription, userAgent) {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('Abonnement push invalide');
  }

  // Un meme endpoint (= un meme navigateur/appareil) ne doit exister
  // qu'une seule fois, y compris si l'utilisateur connecte a change entre
  // deux abonnements sur ce navigateur (ex. compte partage) : on met a
  // jour la ligne plutot que d'en creer une seconde ("eviter les
  // doublons").
  await query(
    `INSERT INTO pushSubscription (userId, endpoint, p256dh, auth, userAgent) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE userId = VALUES(userId), p256dh = VALUES(p256dh), auth = VALUES(auth), userAgent = VALUES(userAgent)`,
    [userId, endpoint, keys.p256dh, keys.auth, (userAgent || '').slice(0, 255)]
  );
}

export async function removeSubscription(userId, endpoint) {
  await query('DELETE FROM pushSubscription WHERE userId = ? AND endpoint = ?', [userId, endpoint]);
}

export async function hasActiveSubscriptions(userId) {
  const rows = await query('SELECT 1 FROM pushSubscription WHERE userId = ? LIMIT 1', [userId]);
  return rows.length > 0;
}

// Construit un titre/texte/URL de notification push lisible a partir d'un
// evenement de notification in-app (meme evenements que la table
// `notification`, voir lib/notifications.js).
function buildPushPayload({ type, actor, content, targetType, targetId }, locale) {
  const name = actor ? `${actor.firstName} ${actor.lastName}` : tr(locale, 'Quelqu\'un');
  const messages = {
    like: tr(locale, '{name} a aime votre publication', { name }),
    comment: tr(locale, '{name} a commente votre publication', { name }),
    reply: tr(locale, '{name} a repondu a votre commentaire', { name }),
    share: tr(locale, '{name} a partage votre publication', { name }),
    mention: tr(locale, '{name} vous a mentionne', { name }),
    friendRequest: tr(locale, "{name} vous a envoye une demande d'ami", { name }),
    friendAccept: tr(locale, "{name} a accepte votre demande d'ami", { name }),
    groupInvite: content
      ? tr(locale, '{name} vous a invite a rejoindre "{group}"', { name, group: content })
      : tr(locale, '{name} vous a invite a rejoindre un groupe', { name }),
    groupRemoved: content
      ? tr(locale, 'Vous avez ete retire du groupe "{group}"', { group: content })
      : tr(locale, "Vous avez ete retire d'un groupe"),
    loginAlert: tr(locale, 'Nouvelle connexion a votre compte detectee. Ce n\'etait pas vous ?'),
    premiumWelcome: tr(locale, "Felicitations ! Vous etes maintenant Premium."),
    premiumPurchase: tr(locale, "{name} a achete Premium", { name }),
    moderation: tr(locale, "L'administration a supprime l'un de vos contenus."),
    groupRoleChange: content
      ? tr(locale, 'Vous etes maintenant administrateur de "{group}"', { group: content })
      : tr(locale, "Vous etes maintenant administrateur d'un groupe")
  };

  const body = messages[type] || tr(locale, '{name} a interagi avec vous', { name });

  let url = '/notifications';
  if (targetType === 'group' && targetId) url = `/groups/${targetId}`;
  else if (targetType === 'post' && targetId) url = `/post/${targetId}`;
  else if (type === 'friendRequest' || type === 'friendAccept') url = '/friends';
  else if (actor) url = `/profile/${actor.id}`;

  // Pour les notifications de groupe, `content` est deja integre au texte
  // ci-dessus (nom du groupe) : on ne le rajoute pas une seconde fois en
  // suffixe (contrairement aux autres types, ou `content` sert surtout
  // d'identifiant technique de routage).
  const isGroupType = type === 'groupInvite' || type === 'groupRemoved' || type === 'groupRoleChange' || type === 'moderation' || type === 'loginAlert' || type === 'premiumWelcome';

  return {
    title: 'Nexus',
    body: content && !isGroupType ? `${body} : "${content.slice(0, 80)}"` : body,
    url,
    icon: actor?.avatar || '/icon.png'
  };
}

// Envoie une notification push a tous les appareils abonnes de
// `userId`. Ne bloque jamais l'appelant : les erreurs sont interceptees
// et journalisees, un abonnement expire/invalide (HTTP 404/410) est
// supprime automatiquement. Appele depuis lib/notifications.js,
// c'est une couche supplementaire qui ne remplace jamais les
// notifications in-app existantes.
export async function sendPushForNotification(notificationEvent) {
  if (!isPushConfigured) return;

  const { userId } = notificationEvent;

  try {
    // Si l'utilisateur a deja une connexion Socket.IO active (il utilise
    // l'application en ce moment), on evite de doubler l'alerte in-app par
    // une notification push redondante.
    if (global.io) {
      const room = global.io.sockets.adapter.rooms.get(`user:${userId}`);
      if (room && room.size > 0) return;
    }

    const subscriptions = await query('SELECT id, endpoint, p256dh, auth FROM pushSubscription WHERE userId = ?', [
      userId
    ]);
    if (subscriptions.length === 0) return;

    const [langRow] = await query('SELECT language FROM user WHERE id = ? LIMIT 1', [userId]);
    const locale = isSupportedLocale(langRow?.language) ? langRow.language : 'fr';
    const payload = JSON.stringify(buildPushPayload(notificationEvent, locale));

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
        } catch (error) {
          // 404/410 = abonnement expire ou revoque par le navigateur :
          // on le supprime pour ne plus jamais retenter dessus.
          if (error.statusCode === 404 || error.statusCode === 410) {
            await query('DELETE FROM pushSubscription WHERE id = ?', [sub.id]);
          } else {
            console.error('[push] Echec envoi vers un abonnement:', error.message);
          }
        }
      })
    );
  } catch (error) {
    console.error('[push] Erreur inattendue lors de l\'envoi:', error.message);
  }
}
