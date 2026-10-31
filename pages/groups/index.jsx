import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { Users, Plus, Loader2, Globe, Lock, Check, X } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import Avatar from '@/components/shared/avatar';
import CreateGroupModal from '@/components/groups/createGroupModal';
import { useToast } from '@/lib/toastContext';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
const TABS = [
  { key: 'mine', get label() { return t("Mes groupes"); } },
  { key: 'invitations', get label() { return t("Invitations"); } },
  { key: 'discover', get label() { return t("Decouvrir"); } }
];

export default function GroupsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [tab, setTab] = useState('mine');
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [invitationCount, setInvitationCount] = useState(0);
  const [respondingId, setRespondingId] = useState(null);

  const load = useCallback(async (activeTab) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/groups?scope=${activeTab}&limit=24`);
      const data = await response.json();
      setGroups(data.success ? data.groups : []);
      if (activeTab === 'invitations' && data.success) {
        setInvitationCount(data.groups.length);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  // Charge le nombre d'invitations en attente independamment de l'onglet
  // actif, pour afficher le badge des le chargement de la page.
  useEffect(() => {
    fetch('/api/groups?scope=invitations&limit=24')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setInvitationCount(data.groups.length);
      });
  }, []);

  function handleCreated(groupId) {
    setIsCreateOpen(false);
    router.push(`/groups/${groupId}`);
  }

  async function handleAcceptInvite(groupId) {
    setRespondingId(groupId);
    try {
      const response = await fetch(`/api/groups/${groupId}/invitation`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setGroups((prev) => prev.filter((group) => group.id !== groupId));
        setInvitationCount((prev) => Math.max(0, prev - 1));
        showToast({ title: t("Vous avez rejoint le groupe"), type: 'success' });
      } else {
        showToast({ title: t("Erreur"), message: data.message, type: 'error' });
      }
    } finally {
      setRespondingId(null);
    }
  }

  async function handleDeclineInvite(groupId) {
    setRespondingId(groupId);
    try {
      const response = await fetch(`/api/groups/${groupId}/invitation`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setGroups((prev) => prev.filter((group) => group.id !== groupId));
        setInvitationCount((prev) => Math.max(0, prev - 1));
      } else {
        showToast({ title: t("Erreur"), message: data.message, type: 'error' });
      }
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <>
      <Head>
        <title>{pageTitle(t("Groupes"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl2 bg-brand-50 flex items-center justify-center text-brand-500">
                <Users size={18} />
              </div>
              <h1 className="font-display text-xl font-semibold text-slate-900 tracking-tight">{t("Groupes")}</h1>
            </div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 bg-brand-500 hover:shadow-glow text-white text-sm font-medium px-4 py-2.5 rounded-xl2 transition-all duration-200"
            >
              <Plus size={15} />{' '}{t("Creer un groupe")}</button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl2 p-1 w-fit mb-6">
            {TABS.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`relative px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  tab === item.key ? 'bg-surface text-slate-900 shadow-soft' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {item.label}
                {item.key === 'invitations' && invitationCount > 0 && (
                  <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-ember-500 text-white text-[10px] flex items-center justify-center">
                    {invitationCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={22} className="animate-spin text-brand-400" />
            </div>
          ) : groups.length === 0 ? (
            <div className="nx-card p-12 text-center">
              <p className="text-sm text-slate-400">
                {tab === 'mine' && t("Vous n'avez rejoint aucun groupe pour le moment.")}
                {tab === 'discover' && t("Aucun groupe public a decouvrir.")}
                {tab === 'invitations' && t("Vous n'avez aucune invitation en attente.")}
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {groups.map((group) =>
                tab === 'invitations' ? (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 nx-card !rounded-xl2 p-4"
                  >
                    <Link href={`/groups/${group.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar src={group.avatar} firstName={group.name} lastName="" size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{group.name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          {group.visibility === 'private' ? <Lock size={11} /> : <Globe size={11} />}{t(group.memberCount > 1 ? "{memberCount} membres" : "{memberCount} membre", { memberCount: group.memberCount })}
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAcceptInvite(group.id)}
                        disabled={respondingId === group.id}
                        title={t("Accepter")}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-brand-500 text-white disabled:opacity-60"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => handleDeclineInvite(group.id)}
                        disabled={respondingId === group.id}
                        title={t("Refuser")}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 disabled:opacity-60"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="flex items-center gap-3 nx-card-interactive !rounded-xl2 p-4"
                  >
                    <Avatar src={group.avatar} firstName={group.name} lastName="" size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{group.name}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        {group.visibility === 'private' ? <Lock size={11} /> : <Globe size={11} />}{t(group.memberCount > 1 ? "{memberCount} membres" : "{memberCount} membre", { memberCount: group.memberCount })}
                      </div>
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {isCreateOpen && <CreateGroupModal onClose={() => setIsCreateOpen(false)} onCreated={handleCreated} />}
        </AnimatePresence>
      </AppLayout>
    </>
  );
}
