import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSocket } from '@/lib/socketContext';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/lib/toastContext';
import { getNotificationText, getNotificationHref } from '@/components/notifications/notificationMeta';

import { t } from '@/lib/i18n/runtime';
export default function GlobalToastListener() {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!socket || !user) return undefined;

    function handleNotification(notification) {
      if (!notification?.actor) return;
      showToast({
        title: `${notification.actor.firstName} ${notification.actor.lastName}`,
        message: getNotificationText(notification).replace(
          `${notification.actor.firstName} ${notification.actor.lastName} `,
          ''
        ),
        avatar: notification.actor.avatar,
        type: 'info',
        href: getNotificationHref(notification)
      });
    }

    function handleConversationUpdated(preview) {
      if (!preview || preview.senderId === user.id) return;
      const conversationPath = `/messages/${preview.conversationId}`;
      if (router.asPath === conversationPath) return;

      showToast({
        title: preview.senderName || t("Nouveau message"),
        message:
          preview.type === 'text'
            ? preview.content
            : preview.type === 'audio'
            ? t("Message vocal")
            : preview.type === 'video'
            ? t("Video")
            : preview.type === 'image'
            ? t("Photo")
            : t("Fichier joint"),
        avatar: preview.senderAvatar,
        type: 'message',
        href: conversationPath
      });
    }

    socket.on('notification:new', handleNotification);
    socket.on('conversation:updated', handleConversationUpdated);

    return () => {
      socket.off('notification:new', handleNotification);
      socket.off('conversation:updated', handleConversationUpdated);
    };
  }, [socket, user, router.asPath, showToast]);

  return null;
}
