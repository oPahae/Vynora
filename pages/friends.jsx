import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { Search, ShieldOff, Loader2, Users, ScanLine } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import QrScannerModal from '@/components/search/qrScannerModal';
import AppLayout from '@/components/layout/appLayout';
import PageHeader from '@/components/shared/pageHeader';
import Segmented from '@/components/shared/segmented';
import EmptyState from '@/components/shared/emptyState';
import FriendCard from '@/components/friends/friendCard';
import FriendButton from '@/components/friends/friendButton';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
const TABS = [
  { key: 'friends', get label() { return t("Mes amis"); } },
  { key: 'requests', get label() { return t("Invitations recues"); } },
  { key: 'sent', get label() { return t("Invitations envoyees"); } },
  { key: 'suggestions', get label() { return t("Suggestions"); } },
  { key: 'blocked', get label() { return t("Bloques"); } }
];

const ENDPOINTS = {
  friends: '/api/friends',
  requests: '/api/friends/requests',
  sent: '/api/friends/sent',
  suggestions: '/api/friends/suggestions',
  blocked: '/api/block'
};

// Normalise une chaine (accents/casse) pour un filtrage local tolerant.
function normalize(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function FriendsPage() {
  const [activeTab, setActiveTab] = useState('friends');
  const [items, setItems] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  // Filtre local (cote client) applique a la liste de l'onglet courant,
  // distinct de la recherche globale ci-dessus qui interroge tout le
  // reseau pour ajouter de nouvelles personnes.
  const [listFilter, setListFilter] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { loading, user } apres un scan

  const loadTab = useCallback(async (tab) => {
    setIsLoading(true);
    try {
      const response = await fetch(ENDPOINTS[tab]);
      const data = await response.json();
      const loadedItems = data.success ? data.items : [];
      setItems(loadedItems);

      if (tab === 'friends' && loadedItems.length > 0) {
        const idsParam = loadedItems.map((item) => item.id).join(',');
        const statusResponse = await fetch(`/api/status/batch?userIds=${idsParam}`);
        const statusData = await statusResponse.json();
        setStatuses(statusData.success ? statusData.statuses : {});
      } else {
        setStatuses({});
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTab(activeTab);
    setListFilter('');
  }, [activeTab, loadTab]);

  const filteredItems = useMemo(() => {
    const term = normalize(listFilter.trim());
    if (!term) return items;
    return items.filter((item) => normalize(`${item.firstName} ${item.lastName}`).includes(term));
  }, [items, listFilter]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return undefined;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`);
      const data = await response.json();
      setSearchResults(data.success ? data.users : []);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  async function handleScannedProfile(userId) {
    setIsScannerOpen(false);
    setScanResult({ loading: true, user: null });
    try {
      const response = await fetch(`/api/users/search?id=${userId}`);
      const data = await response.json();
      setScanResult({ loading: false, user: data.success && data.users[0] ? data.users[0] : null });
    } catch (error) {
      setScanResult({ loading: false, user: null });
    }
  }

  function handleUnblock(userId) {
    fetch(`/api/block/${userId}`, { method: 'DELETE' }).then(() => loadTab('blocked'));
  }

  function handleFriendStatusChange(userId, newStatus) {
    if (['friends', 'requests', 'sent'].includes(activeTab)) {
      setItems((prev) => prev.filter((item) => item.id !== userId));
      return;
    }
    setItems((prev) => prev.map((item) => (item.id === userId ? { ...item, status: newStatus } : item)));
  }

  function handleSearchStatusChange(userId, newStatus) {
    setSearchResults((prev) => prev.map((item) => (item.id === userId ? { ...item, status: newStatus } : item)));
  }

  const isSearchMode = searchQuery.trim().length >= 2;

  return (
    <>
      <Head>
        <title>{pageTitle(t("Amis"))}</title>
      </Head>
      <AppLayout>
        <PageHeader icon={Users} title={t("Amis")} />
        <div className="flex items-center gap-2 mb-6 max-w-md">
        <div className="flex-1 flex items-center gap-2.5 nx-card !rounded-xl2 px-4 py-3 transition-all focus-within:ring-4 focus-within:ring-brand-500/10 focus-within:border-brand-300">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder={t("Rechercher des personnes")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          {isSearching && <Loader2 size={16} className="animate-spin text-slate-400" />}
        </div>
        <button
          type="button"
          onClick={() => setIsScannerOpen(true)}
          title={t("Scanner un QR code")}
          aria-label={t("Scanner un QR code")}
          className="nx-card !rounded-xl2 w-12 h-12 flex items-center justify-center text-brand-600 hover:bg-brand-50 transition-colors shrink-0"
        >
          <ScanLine size={20} />
        </button>
        </div>

        {scanResult && (
          <div className="mb-6 max-w-md">
            <p className="text-xs font-medium text-slate-500 mb-2">{t("Resultat du scan")}</p>
            {scanResult.loading ? (
              <Loader2 size={18} className="animate-spin text-brand-400" />
            ) : scanResult.user ? (
              <FriendCard
                user={scanResult.user}
                subtitle={scanResult.user.mutualFriendsCount > 0 ? t("{mutualFriendsCount} amis en commun", { mutualFriendsCount: scanResult.user.mutualFriendsCount }) : null}
                actions={
                  scanResult.user.status === 'blockedByMe' || scanResult.user.status === 'blockingMe' ? null : (
                    <FriendButton
                      userId={scanResult.user.id}
                      status={scanResult.user.status}
                      onStatusChange={(userId, status) => setScanResult((prev) => ({ ...prev, user: { ...prev.user, status } }))}
                    />
                  )
                }
              />
            ) : (
              <p className="text-sm text-slate-400">{t("Aucun profil correspondant a ce QR code.")}</p>
            )}
          </div>
        )}

        {isSearchMode ? (
          <div className="space-y-3">
            {searchResults.length === 0 && !isSearching && (
              <p className="text-sm text-slate-400">{t("Aucun resultat pour \"{searchQuery}\"", { searchQuery })}</p>
            )}
            {searchResults.map((item) => (
              <FriendCard
                key={item.id}
                user={item}
                subtitle={item.mutualFriendsCount > 0 ? t("{mutualFriendsCount} amis en commun", { mutualFriendsCount: item.mutualFriendsCount }) : null}
                actions={
                  item.status === 'blockedByMe' || item.status === 'blockingMe' ? null : (
                    <FriendButton userId={item.id} status={item.status} onStatusChange={handleSearchStatusChange} />
                  )
                }
              />
            ))}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
              <Segmented
                value={activeTab}
                onChange={setActiveTab}
                items={TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
                className="min-w-max"
              />
            </div>

            {!isLoading && items.length > 0 && (
              <div className="flex items-center gap-2 nx-card !rounded-xl2 px-3 py-2 mb-4 max-w-xs focus-within:ring-4 focus-within:ring-brand-500/10 focus-within:border-brand-300">
                <Search size={15} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder={t("Filtrer cette liste")}
                  value={listFilter}
                  onChange={(event) => setListFilter(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={24} className="animate-spin text-brand-400" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t("Aucun element a afficher pour le moment.")}
                action={
                  activeTab === 'friends' ? (
                    <button type="button" onClick={() => setActiveTab('suggestions')} className="nx-btn-primary">
                      {t("Suggestions")}
                    </button>
                  ) : null
                }
              />
            ) : filteredItems.length === 0 ? (
              <EmptyState icon={Search} tone="neutral" title={t("Aucun resultat pour \"{listFilter}\" dans cette liste.", { listFilter })} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                  <FriendCard
                    key={item.id}
                    user={item}
                    status={activeTab === 'friends' ? statuses[item.id] : null}
                    subtitle={
                      activeTab === 'suggestions' && item.mutualFriendsCount > 0
                        ? t("{mutualFriendsCount} amis en commun", { mutualFriendsCount: item.mutualFriendsCount })
                        : null
                    }
                    actions={
                      activeTab === 'blocked' ? (
                        <button
                          onClick={() => handleUnblock(item.id)}
                          className="nx-btn-secondary nx-btn-sm"
                        >
                          <ShieldOff size={14} />{' '}{t("Debloquer")}</button>
                      ) : (
                        <FriendButton userId={item.id} status={item.status} onStatusChange={handleFriendStatusChange} />
                      )
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
        <AnimatePresence>
          {isScannerOpen && <QrScannerModal onClose={() => setIsScannerOpen(false)} onProfileId={handleScannedProfile} />}
        </AnimatePresence>
      </AppLayout>
    </>
  );
}
