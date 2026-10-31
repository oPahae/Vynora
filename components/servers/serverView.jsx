import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Loader2, Plus, Copy, Check, ArrowLeft, Volume2 } from 'lucide-react';
import ChannelSidebar from '@/components/servers/channelSidebar';
import TextChannel from '@/components/servers/textChannel';
import MemberList from '@/components/servers/memberList';
import ChannelModal from '@/components/servers/channelModal';
import RolesModal from '@/components/servers/rolesModal';
import MemberModal from '@/components/servers/memberModal';
import VoiceChannel from '@/components/servers/voiceChannel';
import NameModal from '@/components/servers/nameModal';
import Modal, { inputClasses, primaryButton } from '@/components/servers/modal';
import { useSocket } from '@/lib/socketContext';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';

import { t } from '@/lib/i18n/runtime';
async function api(url, options) {
  try {
    const response = await fetch(url, options);
    return await response.json();
  } catch (error) {
    return { success: false, message: t("Impossible de contacter le serveur") };
  }
}

const jsonInit = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

function InviteModal({ guildId, onClose }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api(`/api/guilds/${guildId}/invite`, { method: 'POST' }).then((data) => {
      if (data.success) setCode(data.code);
      else setError(data.message || t("Impossible de creer une invitation"));
    });
  }, [guildId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // Presse-papiers indisponible : le code reste selectionnable.
    }
  }

  return (
    <Modal title={t("Inviter des personnes")} onClose={onClose}>
      <p className="text-sm text-slate-500">{t("Partagez ce code : il suffit de le saisir sur la page \"Serveurs\" pour rejoindre. Il expire dans 7 jours.")}</p>
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>}
      {!error && (
        <div className="flex items-center gap-2">
          <input readOnly value={code || '...'} onFocus={(e) => e.target.select()} className={`${inputClasses} font-mono tracking-wider`} />
          <button type="button" onClick={copy} disabled={!code} className={primaryButton}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>
      )}
    </Modal>
  );
}

export default function ServerView({ guildId }) {
  const router = useRouter();
  const { user } = useAuth();
  const { socket } = useSocket();
  const confirm = useConfirm();

  const [guilds, setGuilds] = useState([]);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [joinedVoiceChannelId, setJoinedVoiceChannelId] = useState(null);
  const [panel, setPanel] = useState('channels'); // mobile : 'channels' | 'chat' | 'members'
  const [unread, setUnread] = useState(new Set());
  const [voiceOccupants, setVoiceOccupants] = useState({}); // channelId -> [{ userId, firstName, lastName, avatar, muted }]
  const [membersKey, setMembersKey] = useState(0);
  const [channelModal, setChannelModal] = useState(null); // { channel?, categoryId? }
  const [nameModal, setNameModal] = useState(null); // { mode: 'create' | 'rename', category? }
  const [inviteOpen, setInviteOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  const loadOverview = useCallback(async () => {
    const data = await api(`/api/guilds/${guildId}`);
    if (!data.success) {
      setError(data.message || t("Serveur introuvable"));
      return;
    }
    setError('');
    setOverview(data);
  }, [guildId]);

  useEffect(() => {
    setOverview(null);
    setActiveChannelId(null);
    setJoinedVoiceChannelId(null);
    setUnread(new Set());
    setPanel('channels');
    loadOverview();
    api('/api/guilds').then((data) => data.success && setGuilds(data.guilds));
  }, [guildId, loadOverview]);

  // Salon actif : le premier salon textuel par defaut, ou un autre si le
  // salon courant a disparu ou est devenu inaccessible.
  useEffect(() => {
    if (!overview) return;
    const stillThere = overview.channels.some((channel) => channel.id === activeChannelId);
    if (!stillThere) {
      const first = overview.channels.find((channel) => channel.type === 'text') || overview.channels[0];
      setActiveChannelId(first ? first.id : null);
    }
  }, [overview, activeChannelId]);

  useEffect(() => {
    if (!socket) return undefined;
    const join = () => socket.emit('guild:join', guildId);
    join();
    socket.on('connect', join);

    const onUpdated = (payload) => payload.guildId === guildId && loadOverview();
    const onMembers = (payload) => {
      if (payload.guildId !== guildId) return;
      setMembersKey((key) => key + 1);
      loadOverview();
    };
    const onDeleted = (payload) => payload.guildId === guildId && router.replace('/servers');
    socket.on('guild:updated', onUpdated);
    socket.on('guild:members-changed', onMembers);
    socket.on('guild:deleted', onDeleted);

    return () => {
      socket.emit('guild:leave', guildId);
      socket.off('connect', join);
      socket.off('guild:updated', onUpdated);
      socket.off('guild:members-changed', onMembers);
      socket.off('guild:deleted', onDeleted);
    };
  }, [socket, guildId, loadOverview, router]);

  // Personnes presentes dans les salons vocaux (visibles sous le nom du
  // salon meme sans l'avoir rejoint) : etat initial via `voice:list`, puis
  // mises a jour en direct via `voice:occupants`.
  useEffect(() => {
    if (!socket) return undefined;
    setVoiceOccupants({});
    let cancelled = false;

    const load = () => {
      socket.emit('voice:list', { guildId }, (result) => {
        if (!cancelled && result && result.ok) setVoiceOccupants(result.occupants || {});
      });
    };
    load();
    socket.on('connect', load);

    const onOccupants = (payload) => {
      if (payload.guildId !== guildId) return;
      setVoiceOccupants((prev) => {
        const next = { ...prev };
        if (payload.users.length > 0) next[payload.channelId] = payload.users;
        else delete next[payload.channelId];
        return next;
      });
    };
    socket.on('voice:occupants', onOccupants);

    return () => {
      cancelled = true;
      socket.off('connect', load);
      socket.off('voice:occupants', onOccupants);
    };
  }, [socket, guildId]);

  useEffect(() => {
    if (!socket) return undefined;
    const onMessage = (message) => {
      if (message.guildId !== guildId || message.channelId === activeChannelId) return;
      if (message.sender.id === user?.id) return;
      setUnread((prev) => new Set(prev).add(message.channelId));
    };
    socket.on('guild:message', onMessage);
    return () => socket.off('guild:message', onMessage);
  }, [socket, guildId, activeChannelId, user?.id]);

  const activeChannel = useMemo(
    () => overview?.channels.find((channel) => channel.id === activeChannelId) || null,
    [overview, activeChannelId]
  );

  function selectChannel(channel) {
    setActiveChannelId(channel.id);
    // Choisir un salon vocal le rejoint aussitot (comme sur Discord).
    if (channel.type === 'voice') setJoinedVoiceChannelId(channel.id);
    setUnread((prev) => {
      const next = new Set(prev);
      next.delete(channel.id);
      return next;
    });
    setPanel('chat');
  }

  async function deleteChannel(channel) {
    const ok = await confirm({
      title: t("Supprimer #{name} ?", { name: channel.name }),
      message: t("Le salon et tous ses messages seront supprimes definitivement."),
      confirmLabel: t("Supprimer")
    });
    if (ok) await api(`/api/guilds/${guildId}/channels/${channel.id}`, { method: 'DELETE' });
  }

  async function deleteCategory(category) {
    const ok = await confirm({
      title: t("Supprimer la categorie {name} ?", { name: category.name }),
      message: t("Ses salons ne seront pas supprimes : ils deviendront sans categorie."),
      confirmLabel: t("Supprimer")
    });
    if (ok) await api(`/api/guilds/${guildId}/categories/${category.id}`, { method: 'DELETE' });
  }

  async function leaveGuild() {
    const ok = await confirm({
      title: t("Quitter ce serveur ?"),
      message: t("Vous devrez etre invite a nouveau pour le rejoindre."),
      confirmLabel: t("Quitter")
    });
    if (!ok) return;
    const data = await api(`/api/guilds/${guildId}/leave`, { method: 'POST' });
    if (data.success) router.replace('/servers');
  }

  async function deleteGuild() {
    const ok = await confirm({
      title: t("Supprimer ce serveur ?"),
      message: t("Tous les salons, messages et roles seront supprimes definitivement."),
      confirmLabel: t("Supprimer")
    });
    if (ok) await api(`/api/guilds/${guildId}`, { method: 'DELETE' });
  }

  async function submitCategory(name) {
    const data =
      nameModal.mode === 'create'
        ? await api(`/api/guilds/${guildId}/categories`, jsonInit('POST', { name }))
        : await api(`/api/guilds/${guildId}/categories/${nameModal.category.id}`, jsonInit('PUT', { name }));
    if (!data.success) return data.message || t("Une erreur est survenue");
    setNameModal(null);
    loadOverview();
    return null;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
        <p className="text-sm text-slate-500">{error}</p>
        <Link href="/servers" className="text-sm text-brand-600 font-medium hover:underline">{t("Retour a mes serveurs")}</Link>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-surface">
      {/* Colonne des serveurs (ecran moyen et plus) */}
      <nav className="hidden md:flex flex-col items-center gap-2 w-[68px] shrink-0 py-3 bg-slate-50 border-e border-slate-100 overflow-y-auto">
        {guilds.map((g) => (
          <Link
            key={g.id}
            href={`/servers/${g.id}`}
            title={g.name}
            className={`w-11 h-11 flex items-center justify-center font-display font-semibold transition-all ${
              g.id === guildId
                ? 'rounded-xl2 bg-surface text-slate-900 shadow-soft'
                : 'rounded-full bg-surface text-slate-600 hover:rounded-xl2 hover:bg-brand-50 border border-slate-100'
            }`}
          >
            {g.name.charAt(0).toUpperCase()}
          </Link>
        ))}
        <Link
          href="/servers"
          title={t("Creer ou rejoindre un serveur")}
          className="w-11 h-11 rounded-full bg-surface border border-dashed border-slate-300 text-slate-400 hover:text-brand-600 hover:border-brand-400 flex items-center justify-center"
        >
          <Plus size={18} />
        </Link>
      </nav>

      {/* Sur mobile/tablette, les 3 panneaux sont superposes et glissent au
          lieu d'apparaitre/disparaitre brutalement ; a partir de lg (quand
          les membres deviennent une colonne fixe), ce wrapper s'efface
          (display:contents) et les 3 panneaux retrouvent une disposition
          normale en colonnes cote a cote. */}
      <div className="relative flex flex-1 min-w-0 min-h-0 overflow-hidden lg:contents">
        {/* Salons */}
        <aside
          className={`absolute md:relative inset-0 md:inset-auto flex flex-col w-full md:w-60 md:shrink-0 min-h-0 bg-surface md:border-e border-slate-100 transition-[transform,visibility] duration-300 ease-out will-change-transform ${
            panel === 'channels' ? 'translate-x-0' : '-translate-x-full max-md:invisible'
          } md:translate-x-0`}
        >
          <ChannelSidebar
            overview={overview}
            guilds={guilds}
            activeChannelId={activeChannelId}
            unreadChannelIds={unread}
            voiceOccupants={voiceOccupants}
            onSelectChannel={selectChannel}
            onCreateChannel={(categoryId) => setChannelModal({ categoryId })}
            onEditChannel={(channel) => setChannelModal({ channel })}
            onDeleteChannel={deleteChannel}
            onCreateCategory={() => setNameModal({ mode: 'create' })}
            onRenameCategory={(category) => setNameModal({ mode: 'rename', category })}
            onDeleteCategory={deleteCategory}
            onInvite={() => setInviteOpen(true)}
            onManageRoles={() => setRolesOpen(true)}
            onLeave={leaveGuild}
            onDeleteGuild={deleteGuild}
          />
        </aside>

        {/* Salon actif */}
        <section
          className={`absolute md:relative inset-0 md:inset-auto flex flex-col flex-1 min-w-0 min-h-0 bg-surface transition-[transform,visibility] duration-300 ease-out will-change-transform ${
            panel === 'chat'
              ? 'translate-x-0'
              : panel === 'members'
                ? '-translate-x-full max-md:invisible'
                : 'translate-x-full max-md:invisible'
          } md:translate-x-0`}
        >
          {activeChannel && activeChannel.type === 'text' && (
            <TextChannel
              key={activeChannel.id}
              guildId={guildId}
              channel={activeChannel}
              permissions={overview.permissions}
              currentUser={user}
              onBack={() => setPanel('channels')}
              onOpenMembers={() => setPanel('members')}
              onStructureChanged={loadOverview}
            />
          )}
          {activeChannel && activeChannel.type === 'voice' && joinedVoiceChannelId === activeChannel.id && (
            <VoiceChannel
              key={activeChannel.id}
              guildId={guildId}
              channel={activeChannel}
              onBack={() => setPanel('channels')}
              onHangup={() => setJoinedVoiceChannelId(null)}
            />
          )}
          {activeChannel && activeChannel.type === 'voice' && joinedVoiceChannelId !== activeChannel.id && (
            <div className="flex flex-col h-full bg-ink items-center justify-center gap-4 text-center p-8">
              <button type="button" onClick={() => setPanel('channels')} className="md:hidden self-start -mt-4 -ms-4 p-2 text-white/70" aria-label={t("Retour aux salons")}>
                <ArrowLeft size={20} />
              </button>
              <Volume2 size={32} className="text-white/40" />
              <p className="text-sm text-white/60">{t("Vous avez quitte #{name}.", { name: activeChannel.name })}</p>
              <button
                type="button"
                onClick={() => setJoinedVoiceChannelId(activeChannel.id)}
                className="bg-brand-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl2 hover:shadow-glow transition-all"
              >{t("Rejoindre le salon vocal")}</button>
            </div>
          )}
          {!activeChannel && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8 text-slate-400">
              <p className="text-sm">{t("Aucun salon disponible pour le moment.")}</p>
              <button type="button" onClick={() => setPanel('channels')} className="md:hidden text-sm text-brand-600 font-medium">{t("Voir les salons")}</button>
            </div>
          )}
        </section>

        {/* Membres : colonne fixe a partir de lg, panneau glissant avant */}
        <aside
          className={`absolute lg:relative inset-y-0 end-0 lg:inset-auto z-10 lg:z-auto flex flex-col w-full md:w-60 shrink-0 min-h-0 bg-surface border-s border-slate-100 md:shadow-card lg:shadow-none transition-[transform,visibility] duration-300 ease-out will-change-transform ${
            panel === 'members' ? 'translate-x-0' : 'translate-x-full max-lg:invisible'
          } lg:translate-x-0`}
        >
          <MemberList guildId={guildId} refreshKey={membersKey} onClose={() => setPanel('chat')} onSelectMember={setSelectedMember} />
        </aside>
      </div>

      {channelModal && (
        <ChannelModal
          guildId={guildId}
          categories={overview.categories}
          channel={channelModal.channel}
          defaultCategoryId={channelModal.categoryId}
          onClose={() => setChannelModal(null)}
          onSaved={(channel) => {
            setChannelModal(null);
            loadOverview();
            if (channel && !channelModal.channel) selectChannel(channel);
          }}
        />
      )}
      {nameModal && (
        <NameModal
          title={nameModal.mode === 'create' ? t("Creer une categorie") : t("Renommer la categorie")}
          label={t("Nom de la categorie")}
          initialValue={nameModal.category?.name || ''}
          submitLabel={nameModal.mode === 'create' ? t("Creer") : t("Enregistrer")}
          onSubmit={submitCategory}
          onClose={() => setNameModal(null)}
        />
      )}
      {inviteOpen && <InviteModal guildId={guildId} onClose={() => setInviteOpen(false)} />}
      {rolesOpen && (
        <RolesModal
          guildId={guildId}
          actorPermissions={overview.permissions}
          actorTopPosition={overview.topPosition}
          isOwner={overview.isOwner}
          onClose={() => setRolesOpen(false)}
        />
      )}
      {selectedMember && (
        <MemberModal
          guildId={guildId}
          member={selectedMember}
          currentUserId={user?.id}
          actorPermissions={overview.permissions}
          actorTopPosition={overview.topPosition}
          isOwner={overview.isOwner}
          onClose={() => setSelectedMember(null)}
          onChanged={() => {
            setMembersKey((key) => key + 1);
            loadOverview();
          }}
        />
      )}
    </div>
  );
}
