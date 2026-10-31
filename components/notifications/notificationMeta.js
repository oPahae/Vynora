import { t } from '@/lib/i18n/runtime';
const MODERATION_KINDS = {
  post: () => t("publication"),
  comment: () => t("commentaire"),
  reel: () => t("reel"),
  reelComment: () => t("commentaire de reel"),
  group: () => t("groupe"),
  server: () => t("serveur"),
  story: () => t("story")
};

function getModerationText(notification) {
  let kind = '';
  let reason = '';
  try {
    const parsed = JSON.parse(notification.content);
    kind = (MODERATION_KINDS[parsed.k] || (() => ''))();
    reason = parsed.r || '';
  } catch (error) {
    // contenu illisible
  }
  return t("L'administration a supprime votre {kind}. Motif : {reason}", { kind, reason });
}

function getLoginAlertText(notification) {
  let device = '';
  let place = '';
  try {
    const parsed = JSON.parse(notification.content);
    device = parsed.d || '';
    place = parsed.p || '';
    if (place === 'Reseau local') place = t("Reseau local");
    if (place === 'Localisation inconnue') place = t("Localisation inconnue");
  } catch (error) {
    // contenu illisible
  }
  return t("Nouvelle connexion a votre compte depuis {device} ({place}). Ce n'etait pas vous ?", { device, place });
}

function getPremiumPurchaseText(notification, name) {
  let amount = '';
  try {
    amount = JSON.parse(notification.content).m;
  } catch (error) {
    // contenu illisible
  }
  return t("{name} a achete Premium ({amount} MAD)", { name, amount });
}

export function getNotificationText(notification) {
  if (notification.type === 'premiumWelcome') return t("Felicitations ! Vous etes maintenant Premium : badge verifie, visiteurs du profil et boost de publications sont actives.");
  if (notification.type === 'premiumPurchase') return getPremiumPurchaseText(notification, `${notification.actor.firstName} ${notification.actor.lastName}`);
  if (notification.type === 'moderation') return getModerationText(notification);
  if (notification.type === 'loginAlert') return getLoginAlertText(notification);
  const name = `${notification.actor.firstName} ${notification.actor.lastName}`;

  switch (notification.type) {
    case 'friendRequest':
      return t("{name} vous a envoye une demande d'ami", { name });
    case 'friendAccept':
      return t("{name} a accepte votre demande d'ami", { name });
    case 'like':
      if (notification.targetType === 'reel') return t("{name} a reagi a votre reel", { name });
      if (notification.targetType === 'reelComment') return t("{name} a reagi a votre commentaire de reel", { name });
      return notification.targetType === 'post'
        ? t("{name} a reagi a votre publication", { name })
        : t("{name} a reagi a votre commentaire", { name });
    case 'comment':
      if (notification.targetType === 'reel') return t("{name} a commente votre reel", { name });
      return t("{name} a commente votre publication", { name });
    case 'reply':
      if (notification.targetType === 'reelComment') return t("{name} a repondu a votre commentaire de reel", { name });
      return t("{name} a repondu a votre commentaire", { name });
    case 'mention':
      if (notification.targetType === 'guildMessage' && notification.content) {
        try {
          const { channelName } = JSON.parse(notification.content);
          return t("{name} vous a mentionne dans #{channelName}", { name, channelName });
        } catch (error) {
          return t("{name} vous a mentionne dans un salon", { name });
        }
      }
      if (notification.targetType === 'comment') return t("{name} vous a mentionne dans un commentaire", { name });
      return t("{name} vous a mentionne dans une publication", { name });
    case 'share':
      return t("{name} a partage votre publication", { name });
    case 'status':
      return t("{name} a reagi a votre story", { name });
    case 'message':
      return t("{name} vous a envoye un message", { name });
    case 'groupInvite':
      return notification.content
        ? `${name} vous a invite a rejoindre le groupe "${notification.content}"`
        : `${name} vous a invite a rejoindre un groupe`;
    case 'groupRemoved':
      return notification.content
        ? t("Vous avez ete retire du groupe \"{content}\"", { content: notification.content })
        : t("Vous avez ete retire d'un groupe");
    case 'groupRoleChange':
      return notification.content
        ? t("Vous etes maintenant administrateur du groupe \"{content}\"", { content: notification.content })
        : t("Vous etes maintenant administrateur d'un groupe");
    default:
      return t("{name} a interagi avec vous", { name });
  }
}

export function getNotificationHref(notification) {
  if (notification.type === 'moderation') return null;
  if (notification.type === 'loginAlert') return '/devices';
  if (notification.type === 'premiumWelcome') return '/premium';
  if (notification.type === 'premiumPurchase') return '/admin?tab=premium';
  if (notification.type === 'friendRequest' || notification.type === 'friendAccept') {
    return `/profile/${notification.actor.id}`;
  }
  if (notification.type === 'message') {
    return '/messages';
  }
  if (notification.targetType === 'guildMessage' && notification.content) {
    try {
      const { guildId } = JSON.parse(notification.content);
      return `/servers/${guildId}`;
    } catch (error) {
      return null;
    }
  }
  if (notification.targetType === 'group' && notification.targetId) {
    return `/groups/${notification.targetId}`;
  }
  if (notification.targetType === 'reel' && notification.targetId) {
    return `/reels?id=${notification.targetId}`;
  }
  if (notification.targetType === 'reelComment' && notification.content) {
    return `/reels?id=${notification.content}&comments=1`;
  }
  if (notification.targetType === 'post') {
    return `/post/${notification.targetId}`;
  }
  if (notification.targetType === 'comment' && notification.content) {
    // content stores the id of the post the comment belongs to, so clicking
    // a comment/reply/like-on-comment notification always leads somewhere,
    // whether it was already read or not.
    return `/post/${notification.content}`;
  }
  return null;
}
