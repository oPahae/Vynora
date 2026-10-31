import { memo } from 'react';
import Link from 'next/link';
import { UserPlus, UserCheck, MessageCircle, Share2, AtSign, Radio, Users, UserMinus, Shield, ShieldAlert, MapPinned, Crown } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import REACTIONS from '@/components/shared/reactionTypes';
import { getNotificationText, getNotificationHref } from '@/components/notifications/notificationMeta';
import { formatRelativeTime } from '@/lib/dateUtils';

const TYPE_ICONS = {
  friendRequest: { icon: UserPlus, color: '#3D63E8' },
  friendAccept: { icon: UserCheck, color: '#10b981' },
  comment: { icon: MessageCircle, color: '#3D63E8' },
  reply: { icon: MessageCircle, color: '#3D63E8' },
  mention: { icon: AtSign, color: '#7C8CF6' },
  share: { icon: Share2, color: '#0ea5e9' },
  status: { icon: Radio, color: '#f59e0b' },
  message: { icon: MessageCircle, color: '#3D63E8' },
  groupInvite: { icon: Users, color: '#3D63E8' },
  groupRemoved: { icon: UserMinus, color: '#ef4444' },
  groupRoleChange: { icon: Shield, color: '#f59e0b' }
};

function getIconMeta(notification) {
  if (notification.type === 'like') {
    return { icon: REACTIONS[0].icon, color: '#ef4444' };
  }
  return TYPE_ICONS[notification.type] || { icon: MessageCircle, color: '#64748b' };
}

function NotificationItem({ notification, onRead }) {
  const href = getNotificationHref(notification);
  const { icon: Icon, color } = getIconMeta(notification);

  const content = (
    <div
      className={`flex items-start gap-3 px-4 py-3 hover:bg-brand-50/50 transition-colors ${
        !notification.isRead ? 'bg-brand-50/40' : ''
      }`}
    >
      <div className="relative shrink-0">
        {notification.type === 'moderation' || notification.type === 'loginAlert' || notification.type === 'premiumWelcome' ? (
          <span className={`w-10 h-10 rounded-full flex items-center justify-center ${notification.type === 'moderation' ? 'bg-ember-50 text-ember-600' : 'bg-amber-50 text-amber-600'}`}>
            {notification.type === 'loginAlert' ? <MapPinned size={20} /> : notification.type === 'premiumWelcome' ? <Crown size={20} /> : <ShieldAlert size={20} />}
          </span>
        ) : (
        <Avatar
          src={notification.actor.avatar}
          firstName={notification.actor.firstName}
          lastName={notification.actor.lastName}
          size="md"
        />
        )}
        <span
          className={`absolute -bottom-1 -end-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-surface ${notification.type === 'moderation' || notification.type === 'loginAlert' || notification.type === 'premiumWelcome' ? 'hidden' : ''}`}
          style={{ backgroundColor: color }}
        >
          <Icon size={11} className="text-white" />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700">{getNotificationText(notification)}</p>
        <p className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(notification.createdAt)}</p>
      </div>
      {!notification.isRead && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-2" />}
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={() => onRead(notification.id)}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={() => onRead(notification.id)} className="w-full text-start">
      {content}
    </button>
  );
}

export default memo(NotificationItem);
