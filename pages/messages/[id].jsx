import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getUserFromRequest } from '@/lib/auth';
import { isParticipant, getOtherParticipants } from '@/lib/conversations';
import { getBlockStatus } from '@/lib/friends';
import AppLayout from '@/components/layout/appLayout';
import ChatWindow from '@/components/messages/chatWindow';
import CallButtons from '@/components/calls/callButtons';
import Avatar from '@/components/shared/avatar';
import { useSocket } from '@/lib/socketContext';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function ConversationPage({ conversationId, otherUser, relation: initialRelation }) {
  const { onlineUserIds } = useSocket();
  const [relation, setRelation] = useState(initialRelation);
  const isOnline = onlineUserIds.has(otherUser.id);

  return (
    <>
      <Head>
        <title>
          {pageTitle(`${otherUser.firstName} ${otherUser.lastName}`)}
        </title>
      </Head>
      <AppLayout noMobileChrome>
        <div className="w-full h-full md:max-w-2xl md:mx-auto bg-surface md:rounded-xl3 shadow-soft overflow-hidden flex flex-col h-[100dvh] md:h-[75vh] border-0 md:border border-slate-100">
          <div className="shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 bg-surface/80 backdrop-blur relative z-10 pt-[max(0.875rem,env(safe-area-inset-top))]">
            <Link href="/messages" className="text-slate-400 hover:text-brand-600 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <Link href={`/profile/${otherUser.id}`} className="flex items-center gap-2.5 group">
              <div className="relative">
                <Avatar src={otherUser.avatar} firstName={otherUser.firstName} lastName={otherUser.lastName} size="md" />
                {isOnline && (
                  <span className="absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                  {otherUser.firstName} {otherUser.lastName}{otherUser.verified && <VerifiedBadge size={14} />}
                </p>
                <p className="text-xs text-slate-400">{isOnline ? t("En ligne") : t("Hors ligne")}</p>
              </div>
            </Link>

            <CallButtons
              conversationId={conversationId}
              otherUser={otherUser}
              isOnline={isOnline}
              isBlocked={Boolean(relation?.blockedByMe || relation?.blockingMe)}
            />
          </div>

          <ChatWindow
            conversationId={conversationId}
            otherUser={otherUser}
            initialRelation={initialRelation}
            onRelationChange={setRelation}
          />
        </div>
      </AppLayout>
    </>
  );
}

export async function getServerSideProps(context) {
  const { req, params } = context;
  const payload = await getUserFromRequest(req);

  if (!payload) {
    return { redirect: { destination: '/login', permanent: false } };
  }

  const conversationId = Number(params.id);
  if (!Number.isInteger(conversationId)) {
    return { notFound: true };
  }

  const allowed = await isParticipant(conversationId, payload.id);
  if (!allowed) {
    return { notFound: true };
  }

  const participants = await getOtherParticipants(conversationId, payload.id);
  if (participants.length === 0) {
    return { notFound: true };
  }

  const relation = await getBlockStatus(payload.id, participants[0].id);

  return {
    props: {
      conversationId,
      otherUser: JSON.parse(JSON.stringify(participants[0])),
      relation
    }
  };
}
