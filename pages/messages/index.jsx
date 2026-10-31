import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Loader2, MessageCircleOff, Search, X, Star, MessageSquareText } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import ConversationListItem from '@/components/messages/conversationListItem';
import Avatar from '@/components/shared/avatar';
import Segmented from '@/components/shared/segmented';
import { useSocket } from '@/lib/socketContext';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
const SEARCH_DEBOUNCE_MS = 300;

export default function MessagesPage() {
  const { socket } = useSocket();
  const [tab, setTab] = useState('active');
  const [conversations, setConversations] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef(null);

  const load = useCallback(async (activeTab) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/conversations${activeTab === 'archived' ? '?archived=1' : ''}`);
      const data = await response.json();
      const loaded = data.success ? data.conversations : [];
      setConversations(loaded);

      const otherIds = loaded.map((conversation) => conversation.participants[0]?.id).filter(Boolean);
      if (otherIds.length > 0) {
        const statusResponse = await fetch(`/api/status/batch?userIds=${otherIds.join(',')}`);
        const statusData = await statusResponse.json();
        setStatuses(statusData.success ? statusData.statuses : {});
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    setIsLoadingFavorites(true);
    try {
      const response = await fetch('/api/messages/favorites');
      const data = await response.json();
      setFavorites(data.success ? data.messages : []);
    } finally {
      setIsLoadingFavorites(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (tab === 'favorites') {
      loadFavorites().then(() => {
        if (!isMounted) return;
      });
    } else {
      load(tab).then(() => {
        if (!isMounted) return;
      });
    }
    return () => {
      isMounted = false;
    };
  }, [tab, load, loadFavorites]);

  // Recherche de personnes/messages a travers les conversations, avec
  // debounce, comme la recherche globale du header.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return undefined;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/conversations/search?q=${encodeURIComponent(trimmed)}`);
        const data = await response.json();
        if (data.success) setSearchResults(data);
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchTerm]);

  useEffect(() => {
    if (!socket) return undefined;

    function refresh() {
      load(tab);
    }

    socket.on('message:new', refresh);
    socket.on('conversation:updated', refresh);

    return () => {
      socket.off('message:new', refresh);
      socket.off('conversation:updated', refresh);
    };
  }, [socket, tab, load]);

  async function handleArchive(conversation, archived) {
    setConversations((prev) => prev.filter((item) => item.id !== conversation.id));
    try {
      await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived })
      });
    } catch (error) {
      load(tab);
    }
  }

  async function handleDelete(conversation) {
    setConversations((prev) => prev.filter((item) => item.id !== conversation.id));
    try {
      await fetch(`/api/conversations/${conversation.id}`, { method: 'DELETE' });
    } catch (error) {
      load(tab);
    }
  }

  const emptyLabel =
    tab === 'archived'
      ? t("Aucune conversation archivee.")
      : t("Aucune conversation. Discutez avec vos amis depuis leur profil.");

  return (
    <>
      <Head>
        <title>{pageTitle(t("Messages"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-2xl mx-auto nx-card p-2">
          <div className="flex items-center justify-between px-4 pt-3">
            <h1 className="font-display text-lg font-semibold text-slate-900 tracking-tight">{t("Messages")}</h1>
          </div>

          <div className="px-4 pb-2">
            <div className="relative">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("Rechercher des messages ou des personnes...")}
                className="nx-field !rounded-full ps-9 pe-8"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {searchTerm.trim().length >= 2 ? (
            <div className="px-2 pb-3">
              {isSearching ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-brand-400" />
                </div>
              ) : (
                <>
                  {searchResults?.people?.length > 0 && (
                    <div className="mb-2">
                      <p className="px-2 py-1.5 text-xs font-semibold text-slate-400 ">{t("Personnes")}</p>
                      {searchResults.people.map((person) => (
                        <Link
                          key={person.conversationId}
                          href={`/messages/${person.conversationId}`}
                          className="flex items-center gap-3 px-2 py-2 hover:bg-slate-50 rounded-xl2"
                        >
                          <Avatar src={person.avatar} firstName={person.firstName} lastName={person.lastName} size="sm" />
                          <span className="text-sm text-slate-800 truncate">
                            {person.firstName} {person.lastName}{person.verified && <VerifiedBadge size={14} />}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                  {searchResults?.messages?.length > 0 && (
                    <div>
                      <p className="px-2 py-1.5 text-xs font-semibold text-slate-400 ">{t("Messages")}</p>
                      {searchResults.messages.map((message) => (
                        <Link
                          key={message.id}
                          href={`/messages/${message.conversationId}`}
                          className="flex items-start gap-2.5 px-2 py-2 hover:bg-slate-50 rounded-xl2"
                        >
                          <MessageSquareText size={15} className="text-slate-300 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs text-slate-400">{message.senderName}</p>
                            <p className="text-sm text-slate-700 line-clamp-2">
                              {message.type === 'text' ? message.content : t("Piece jointe")}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {!isSearching &&
                    (!searchResults || (searchResults.people.length === 0 && searchResults.messages.length === 0)) && (
                      <p className="text-sm text-slate-400 text-center py-10">{t("Aucun resultat pour \"{searchTerm}\".", { searchTerm })}</p>
                    )}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="px-4 pb-3 pt-1 overflow-x-auto scrollbar-none">
                <Segmented
                  value={tab}
                  onChange={setTab}
                  className="min-w-max"
                  items={[
                    { key: 'active', label: t("Actives") },
                    { key: 'archived', label: t("Archivees") },
                    { key: 'favorites', icon: Star, label: t("Favoris") }
                  ]}
                />
              </div>

              {tab === 'favorites' ? (
                isLoadingFavorites ? (
                  <div className="flex justify-center py-16">
                    <Loader2 size={22} className="animate-spin text-brand-400" />
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
                    <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center">
                      <Star size={22} className="text-brand-400" />
                    </div>
                    <p className="text-sm text-center px-6">{t("Aucun message favori pour le moment.")}</p>
                  </div>
                ) : (
                  <div className="space-y-1 px-1 pb-2">
                    {favorites.map((message) => {
                      const other = message.conversationParticipants?.[0];
                      return (
                        <Link
                          key={message.id}
                          href={`/messages/${message.conversationId}`}
                          className="flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl2"
                        >
                          <Avatar src={other?.avatar} firstName={other?.firstName} lastName={other?.lastName} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-400">
                              {other ? `${other.firstName} ${other.lastName}` : t("Conversation")}
                            </p>
                            <p className="text-sm text-slate-700 line-clamp-2">
                              {message.type === 'text' ? message.content : t("Piece jointe")}
                            </p>
                          </div>
                          <Star size={14} fill="currentColor" className="text-amber-400 shrink-0 mt-1" />
                        </Link>
                      );
                    })}
                  </div>
                )
              ) : isLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 size={22} className="animate-spin text-brand-400" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
                  <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center">
                    <MessageCircleOff size={24} className="text-brand-400" />
                  </div>
                  <p className="text-sm text-center px-6">{emptyLabel}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conversation) => (
                    <ConversationListItem
                      key={conversation.id}
                      conversation={conversation}
                      status={statuses[conversation.participants[0]?.id]}
                      onArchive={handleArchive}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </AppLayout>
    </>
  );
}
