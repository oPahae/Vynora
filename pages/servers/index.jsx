import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Hash, Loader2, Plus, LogIn } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import NameModal from '@/components/servers/nameModal';
import { inputClasses, primaryButton } from '@/components/servers/modal';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
export default function ServersPage() {
  const router = useRouter();
  const [guilds, setGuilds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetch('/api/guilds').then((r) => r.json());
      setGuilds(data.success ? data.guilds : []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createGuild(name) {
    const data = await fetch('/api/guilds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }).then((r) => r.json());
    if (!data.success) return data.message || t("Une erreur est survenue");
    router.push(`/servers/${data.guildId}`);
    return null;
  }

  async function joinGuild(event) {
    event.preventDefault();
    setJoinError('');
    setIsJoining(true);
    try {
      const data = await fetch('/api/guilds/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      }).then((r) => r.json());
      if (!data.success) {
        setJoinError(data.message || t("Une erreur est survenue"));
        return;
      }
      router.push(`/servers/${data.guildId}`);
    } catch (error) {
      setJoinError(t("Impossible de contacter le serveur"));
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <>
      <Head>
        <title>{pageTitle(t("Serveurs"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-xl font-semibold text-slate-900 tracking-tight">{t("Mes serveurs")}</h1>
            <button type="button" onClick={() => setCreateOpen(true)} className={primaryButton}>
              <Plus size={16} />{' '}{t("Creer un serveur")}</button>
          </div>

          <form onSubmit={joinGuild} className="nx-card p-4 sm:p-5 space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <LogIn size={15} />{' '}{t("Rejoindre avec un code d'invitation")}</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("Code d'invitation")}
                className={`${inputClasses} font-mono`}
              />
              <button type="submit" disabled={isJoining || !code.trim()} className={`${primaryButton} justify-center`}>
                {isJoining && <Loader2 size={15} className="animate-spin" />}{t("Rejoindre")}</button>
            </div>
            {joinError && <p className="text-xs text-red-500">{joinError}</p>}
          </form>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-brand-400" />
            </div>
          ) : guilds.length === 0 ? (
            <div className="nx-card p-10 text-center text-sm text-slate-400">{t("Vous n'avez encore rejoint aucun serveur. Creez le votre ou utilisez un code d'invitation.")}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {guilds.map((guild) => (
                <Link
                  key={guild.id}
                  href={`/servers/${guild.id}`}
                  className="flex items-center gap-3 nx-card p-4 hover:border-brand-300 transition-colors"
                >
                  <span className="w-12 h-12 rounded-xl2 bg-brand-500 text-white flex items-center justify-center font-display font-semibold text-lg shrink-0">
                    {guild.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900 truncate">{guild.name}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Hash size={11} />{' '}{t("Ouvrir le serveur")}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {createOpen && (
          <NameModal
            title={t("Creer un serveur")}
            label={t("Nom du serveur")}
            submitLabel={t("Creer")}
            onSubmit={createGuild}
            onClose={() => setCreateOpen(false)}
          />
        )}
      </AppLayout>
    </>
  );
}
