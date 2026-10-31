import { memo } from 'react';
import Link from 'next/link';
import {
  FilePlus2, Pencil, Trash2, Share2, MessageCircle, Reply, UserPlus, UserCheck, UserX, UserMinus, Ban, ShieldCheck,
  Clapperboard, Users, FolderPlus, Flag, LogIn, Radio, Heart
} from 'lucide-react';
import REACTIONS from '@/components/shared/reactionTypes';
import { formatRelativeTime } from '@/lib/dateUtils';
import { t } from '@/lib/i18n/runtime';

const TARGET_LABEL = {
  post: () => t("une publication"),
  comment: () => t("un commentaire"),
  reel: () => t("un reel"),
  reelComment: () => t("un commentaire de reel"),
  story: () => t("une story")
};

// Description, icone, couleur et lien de chaque type d'activite.
export function describeActivity(item) {
  const meta = item.meta || {};
  const name = item.otherUser ? `${item.otherUser.firstName} ${item.otherUser.lastName}` : t("un utilisateur");
  const userHref = item.otherUser ? `/profile/${item.otherUser.id}` : null;

  switch (item.action) {
    case 'post_create':
      return { icon: FilePlus2, color: '#3D63E8', text: meta.groupId ? t("Vous avez publie dans un groupe") : t("Vous avez publie une publication"), detail: meta.snippet, href: `/post/${item.targetId}` };
    case 'post_edit':
      return { icon: Pencil, color: '#0ea5e9', text: t("Vous avez modifie une publication"), detail: meta.snippet, href: `/post/${item.targetId}` };
    case 'post_delete':
      return { icon: Trash2, color: '#ef4444', text: t("Vous avez supprime une publication"), detail: meta.snippet };
    case 'post_share':
      return { icon: Share2, color: '#0ea5e9', text: t("Vous avez partage une publication"), href: `/post/${item.targetId}` };
    case 'story_create':
      return { icon: Radio, color: '#f59e0b', text: t("Vous avez publie une story"), detail: meta.snippet };
    case 'reaction': {
      const reaction = REACTIONS.find((r) => r.type === meta.type);
      const target = (TARGET_LABEL[item.targetType] || TARGET_LABEL.post)();
      let href = null;
      if (item.targetType === 'post') href = `/post/${item.targetId}`;
      if (item.targetType === 'comment' && meta.postId) href = `/post/${meta.postId}`;
      if (item.targetType === 'reel') href = `/reels?id=${item.targetId}`;
      if (item.targetType === 'reelComment' && meta.reelId) href = `/reels?id=${meta.reelId}&comments=1`;
      return {
        icon: reaction ? reaction.icon : Heart,
        color: reaction ? reaction.color : '#ef4444',
        text: t("Vous avez reagi ({reaction}) a {target}", { reaction: reaction ? reaction.label : '', target }),
        href
      };
    }
    case 'comment_create': {
      const onReel = item.targetType === 'reelComment';
      const href = onReel ? `/reels?id=${meta.reelId}&comments=1` : `/post/${meta.postId}`;
      if (meta.isReply) return { icon: Reply, color: '#3D63E8', text: onReel ? t("Vous avez repondu a un commentaire de reel") : t("Vous avez repondu a un commentaire"), detail: meta.snippet, href };
      return { icon: MessageCircle, color: '#3D63E8', text: onReel ? t("Vous avez commente un reel") : t("Vous avez commente une publication"), detail: meta.snippet, href };
    }
    case 'comment_delete':
      return { icon: Trash2, color: '#ef4444', text: t("Vous avez supprime un commentaire"), detail: meta.snippet };
    case 'friend_request_sent':
      return { icon: UserPlus, color: '#3D63E8', text: t("Vous avez envoye une invitation a {name}", { name }), href: userHref };
    case 'friend_request_accepted':
      return { icon: UserCheck, color: '#10b981', text: t("Vous avez accepte l'invitation de {name}", { name }), href: userHref };
    case 'friend_request_received_accepted':
      return { icon: UserCheck, color: '#10b981', text: t("{name} a accepte votre invitation", { name }), href: userHref };
    case 'friend_request_declined':
      return { icon: UserX, color: '#f59e0b', text: t("Vous avez refuse l'invitation de {name}", { name }), href: userHref };
    case 'friend_request_cancelled':
      return { icon: UserX, color: '#94a3b8', text: t("Vous avez annule votre invitation a {name}", { name }), href: userHref };
    case 'friend_removed':
      return { icon: UserMinus, color: '#ef4444', text: t("Vous avez retire {name} de vos amis", { name }), href: userHref };
    case 'user_block':
      return { icon: Ban, color: '#ef4444', text: t("Vous avez bloque {name}", { name }) };
    case 'user_unblock':
      return { icon: ShieldCheck, color: '#10b981', text: t("Vous avez debloque {name}", { name }) };
    case 'reel_create':
      return { icon: Clapperboard, color: '#e11d48', text: t("Vous avez publie un reel"), detail: meta.snippet, href: `/reels?id=${item.targetId}` };
    case 'reel_delete':
      return { icon: Trash2, color: '#ef4444', text: t("Vous avez supprime un reel"), detail: meta.snippet };
    case 'group_create':
      return { icon: Users, color: '#3D63E8', text: t("Vous avez cree un groupe"), detail: meta.name, href: `/groups/${item.targetId}` };
    case 'group_join':
      return { icon: Users, color: '#10b981', text: meta.status === 'pending' ? t("Vous avez demande a rejoindre un groupe") : t("Vous avez rejoint un groupe"), href: `/groups/${item.targetId}` };
    case 'collection_create':
      return { icon: FolderPlus, color: '#7c6cf8', text: meta.kind === 'folder' ? t("Vous avez cree un dossier") : t("Vous avez cree une playlist"), detail: meta.name, href: `/collections/${item.targetId}` };
    case 'report_submit':
      return { icon: Flag, color: '#f59e0b', text: t("Vous avez signale un contenu") };
    case 'login':
      return { icon: LogIn, color: '#64748b', text: t("Connexion a votre compte") };
    default:
      return { icon: Radio, color: '#64748b', text: item.action };
  }
}

function ActivityItem({ item }) {
  const { icon: Icon, color, text, detail, href } = describeActivity(item);

  const body = (
    <div className="flex items-start gap-3.5 px-4 py-3 hover:bg-slate-50/70 transition-colors">
      <span className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1F`, color }}>
        <Icon size={18} strokeWidth={2.1} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800">{text}</p>
        {detail && <p className="text-sm text-slate-500 mt-0.5 line-clamp-2 break-words">{detail}</p>}
      </div>
      <span className="text-xs text-slate-400 shrink-0 mt-0.5 whitespace-nowrap">{formatRelativeTime(item.createdAt)}</span>
    </div>
  );

  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export default memo(ActivityItem);
