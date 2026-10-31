import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Users, Globe, Lock, Loader2, LogIn, LogOut, Clock, Shield, Crown, UserMinus, Settings, Trash2, Camera, UserPlus } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import Avatar from '@/components/shared/avatar';
import PostList from '@/components/posts/postList';
import InviteMemberModal from '@/components/groups/inviteMemberModal';
import { useAuth } from '@/lib/authContext';
import { useConfirm } from '@/lib/confirmContext';
import { useToast } from '@/lib/toastContext';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
const TABS = [
  { key: 'posts', get label() { return t("Publications"); } },
  { key: 'members', get label() { return t("Membres"); } }
];

export default function GroupDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();

  const [group, setGroup] = useState(null);
  const [membership, setMembership] = useState(null);
  const [canViewContent, setCanViewContent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [tab, setTab] = useState('posts');
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const isAdminOrOwner = membership?.status === 'active' && ['owner', 'admin'].includes(membership.role);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/groups/${id}`);
      const data = await response.json();
      if (data.success) {
        setGroup(data.group);
        setMembership(data.membership);
        setCanViewContent(data.canViewContent);
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id || !canViewContent) return;
    if (tab === 'members') {
      fetch(`/api/groups/${id}/members`)
        .then((response) => response.json())
        .then((data) => setMembers(data.success ? data.members : []));
    }
  }, [id, tab, canViewContent]);

  useEffect(() => {
    if (!id || !isAdminOrOwner) return;
    fetch(`/api/groups/${id}/requests`)
      .then((response) => response.json())
      .then((data) => setPendingRequests(data.success ? data.requests : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAdminOrOwner]);

  async function handleJoin() {
    setIsJoining(true);
    try {
      const response = await fetch(`/api/groups/${id}/join`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        showToast({
          title: data.status === 'pending' ? t("Demande d'adhesion envoyee") : t("Vous avez rejoint le groupe"),
          type: 'success'
        });
        load();
      } else {
        showToast({ title: t("Erreur"), message: data.message, type: 'error' });
      }
    } finally {
      setIsJoining(false);
    }
  }

  async function handleAcceptInvite() {
    setIsJoining(true);
    try {
      const response = await fetch(`/api/groups/${id}/invitation`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        showToast({ title: t("Vous avez rejoint le groupe"), type: 'success' });
        load();
      } else {
        showToast({ title: t("Erreur"), message: data.message, type: 'error' });
      }
    } finally {
      setIsJoining(false);
    }
  }

  async function handleDeclineInvite() {
    setIsJoining(true);
    try {
      const response = await fetch(`/api/groups/${id}/invitation`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        router.push('/groups');
      } else {
        showToast({ title: t("Erreur"), message: data.message, type: 'error' });
      }
    } finally {
      setIsJoining(false);
    }
  }

  async function handleLeave() {
    const confirmed = await confirm({
      title: t("Quitter ce groupe ?"),
      message: t("Vous pourrez le rejoindre a nouveau plus tard."),
      confirmLabel: t("Quitter"),
      danger: true
    });
    if (!confirmed) return;

    const response = await fetch(`/api/groups/${id}/leave`, { method: 'POST' });
    const data = await response.json();
    if (data.success) {
      showToast({ title: t("Vous avez quitte le groupe"), type: 'success' });
      load();
    } else {
      showToast({ title: t("Erreur"), message: data.message, type: 'error' });
    }
  }

  async function handleApprove(userId) {
    const response = await fetch(`/api/groups/${id}/requests/${userId}`, { method: 'POST' });
    const data = await response.json();
    if (data.success) {
      setPendingRequests((prev) => prev.filter((item) => item.id !== userId));
      showToast({ title: t("Demande approuvee"), type: 'success' });
    }
  }

  async function handleReject(userId) {
    const response = await fetch(`/api/groups/${id}/requests/${userId}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) {
      setPendingRequests((prev) => prev.filter((item) => item.id !== userId));
    }
  }

  async function handleRemoveMember(userId) {
    const confirmed = await confirm({
      title: t("Exclure ce membre ?"),
      message: t("Il pourra demander a rejoindre le groupe a nouveau."),
      confirmLabel: t("Exclure"),
      danger: true
    });
    if (!confirmed) return;

    const response = await fetch(`/api/groups/${id}/members/${userId}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) {
      setMembers((prev) => prev.filter((item) => item.id !== userId));
    } else {
      showToast({ title: t("Erreur"), message: data.message, type: 'error' });
    }
  }

  async function handleSetRole(userId, role) {
    const response = await fetch(`/api/groups/${id}/members/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    const data = await response.json();
    if (data.success) {
      setMembers((prev) => prev.map((item) => (item.id === userId ? { ...item, role } : item)));
    } else {
      showToast({ title: t("Erreur"), message: data.message, type: 'error' });
    }
  }

  async function handleDeleteGroup() {
    const confirmed = await confirm({
      title: t("Supprimer definitivement ce groupe ?"),
      message: t("Toutes ses publications seront supprimees. Cette action est irreversible."),
      confirmLabel: t("Supprimer"),
      danger: true
    });
    if (!confirmed) return;

    const response = await fetch(`/api/groups/${id}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) {
      router.push('/groups');
    } else {
      showToast({ title: t("Erreur"), message: data.message, type: 'error' });
    }
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('media', file);
      const response = await fetch(`/api/groups/${id}/avatar`, { method: 'POST', body: formData });
      const data = await response.json();
      if (data.success) {
        setGroup((prev) => ({ ...prev, avatar: data.avatar }));
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-brand-400" />
        </div>
      </AppLayout>
    );
  }

  if (!group) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto nx-card p-12 text-center">
          <p className="text-sm text-slate-400">{t("Groupe introuvable.")}</p>
        </div>
      </AppLayout>
    );
  }

  const isMember = membership?.status === 'active';
  const isPending = membership?.status === 'pending';
  const isInvited = membership?.status === 'invited';

  return (
    <>
      <Head>
        <title>{pageTitle(group.name)}</title>
      </Head>
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <div className="nx-card overflow-hidden mb-6">
            <div
              className="h-32 sm:h-44 bg-brand-500 bg-cover bg-center"
              style={group.cover ? { backgroundImage: `url(${group.cover})` } : undefined}
            />
            <div className="px-5 sm:px-6 pb-5 -mt-10">
              <div className="flex items-end justify-between flex-wrap gap-3">
                <div className="relative">
                  <Avatar src={group.avatar} firstName={group.name} lastName="" size="xl" ring />
                  {isAdminOrOwner && (
                    <label className="absolute -bottom-1 -end-1 w-8 h-8 rounded-full bg-surface shadow-card flex items-center justify-center cursor-pointer text-slate-500 hover:text-brand-600">
                      {avatarUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </label>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isAdminOrOwner && (
                    <button
                      onClick={() => setIsSettingsOpen((prev) => !prev)}
                      className="nx-btn-secondary"
                    >
                      <Settings size={14} />{' '}{t("Parametres")}</button>
                  )}
                  {isMember && membership.role !== 'owner' && (
                    <button
                      onClick={handleLeave}
                      className="nx-btn-secondary"
                    >
                      <LogOut size={14} />{' '}{t("Quitter")}</button>
                  )}
                  {isPending && (
                    <span className="flex items-center gap-1.5 text-sm text-slate-400 px-4 py-2.5">
                      <Clock size={14} />{' '}{t("Demande envoyee")}</span>
                  )}
                  {isInvited && (
                    <>
                      <button
                        onClick={handleAcceptInvite}
                        disabled={isJoining}
                        className="nx-btn-primary"
                      >
                        {isJoining ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}{t("Accepter l'invitation")}</button>
                      <button
                        onClick={handleDeclineInvite}
                        disabled={isJoining}
                        className="nx-btn-secondary"
                      >{t("Refuser")}</button>
                    </>
                  )}
                  {!isMember && !isPending && !isInvited && (
                    <button
                      onClick={handleJoin}
                      disabled={isJoining}
                      className="nx-btn-primary"
                    >
                      {isJoining ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                      {group.visibility === 'private' ? t("Demander a rejoindre") : t("Rejoindre")}
                    </button>
                  )}
                </div>
              </div>

              <h1 className="font-display text-xl font-semibold text-slate-900 mt-3">{group.name}</h1>
              {group.description && <p className="text-sm text-slate-500 mt-1">{group.description}</p>}
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                <span className="flex items-center gap-1">
                  {group.visibility === 'private' ? <Lock size={12} /> : <Globe size={12} />}
                  {group.visibility === 'private' ? t("Groupe prive") : t("Groupe public")}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={12} />{' '}{t(group.memberCount > 1 ? "{memberCount} membres" : "{memberCount} membre", { memberCount: group.memberCount })}
                </span>
              </div>
            </div>
          </div>

          {isSettingsOpen && isAdminOrOwner && (
            <GroupSettingsPanel
              group={group}
              groupId={id}
              onUpdated={(updated) => {
                setGroup((prev) => ({ ...prev, ...updated }));
                setIsSettingsOpen(false);
              }}
              onDelete={membership.role === 'owner' ? handleDeleteGroup : null}
            />
          )}

          {!canViewContent ? (
            <div className="nx-card p-12 text-center">
              <Lock size={22} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400 max-w-xs mx-auto">
                {isInvited
                  ? t("Vous avez ete invite a ce groupe prive. Acceptez l'invitation pour voir ses publications et ses membres.")
                  : t("Ce groupe est prive. Rejoignez-le pour voir ses publications et ses membres.")}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl2 p-1 w-fit mb-6">
                {TABS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                      tab === item.key ? 'bg-surface text-slate-900 shadow-soft' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                {isAdminOrOwner && (
                  <button
                    onClick={() => setTab('requests')}
                    className={`relative px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                      tab === 'requests' ? 'bg-surface text-slate-900 shadow-soft' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >{t("Demandes")}{pendingRequests.length > 0 && (
                      <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-ember-500 text-white text-[10px] flex items-center justify-center">
                        {pendingRequests.length}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {tab === 'posts' && (
                <PostList
                  endpoint={`/api/groups/${id}/posts`}
                  canCompose={isMember}
                  groupId={id}
                  emptyLabel={t("Aucune publication dans ce groupe pour le moment.")}
                />
              )}

              {tab === 'members' && (
                <div className="space-y-2">
                  {isAdminOrOwner && (
                    <button
                      onClick={() => setIsInviteOpen(true)}
                      className="w-full flex items-center justify-center gap-2 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl2 py-2.5 mb-1 transition-colors"
                    >
                      <UserPlus size={15} />{' '}{t("Inviter des personnes")}</button>
                  )}
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3 nx-card !rounded-xl2 p-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={member.avatar} firstName={member.firstName} lastName={member.lastName} size="md" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {member.firstName} {member.lastName}{member.verified && <VerifiedBadge size={14} />}
                          </p>
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            {member.role === 'owner' && <Crown size={11} />}
                            {member.role === 'admin' && <Shield size={11} />}
                            {member.role === 'owner' ? t("Proprietaire") : member.role === 'admin' ? t("Admin") : t("Membre")}
                          </p>
                        </div>
                      </div>

                      {membership?.role === 'owner' && member.role !== 'owner' && member.id !== user?.id && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleSetRole(member.id, member.role === 'admin' ? 'member' : 'admin')}
                            className="text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-xl2"
                          >
                            {member.role === 'admin' ? t("Retirer admin") : t("Rendre admin")}
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-slate-400 hover:text-ember-500 p-1.5"
                          >
                            <UserMinus size={15} />
                          </button>
                        </div>
                      )}
                      {isAdminOrOwner && membership?.role !== 'owner' && member.role === 'member' && member.id !== user?.id && (
                        <button onClick={() => handleRemoveMember(member.id)} className="text-slate-400 hover:text-ember-500 p-1.5 shrink-0">
                          <UserMinus size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tab === 'requests' && isAdminOrOwner && (
                <div className="space-y-2">
                  {pendingRequests.length === 0 ? (
                    <div className="nx-card p-8 text-center">
                      <p className="text-sm text-slate-400">{t("Aucune demande en attente.")}</p>
                    </div>
                  ) : (
                    pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between gap-3 nx-card !rounded-xl2 p-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar src={request.avatar} firstName={request.firstName} lastName={request.lastName} size="md" />
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {request.firstName} {request.lastName}{request.verified && <VerifiedBadge size={14} />}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleApprove(request.id)}
                            className="text-xs font-medium text-white bg-brand-500 px-3 py-1.5 rounded-xl2"
                          >{t("Approuver")}</button>
                          <button
                            onClick={() => handleReject(request.id)}
                            className="text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl2"
                          >{t("Refuser")}</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </AppLayout>

      {isInviteOpen && (
        <InviteMemberModal
          groupId={id}
          existingMemberIds={members.map((member) => member.id)}
          onClose={() => setIsInviteOpen(false)}
        />
      )}
    </>
  );
}

function GroupSettingsPanel({ group, groupId, onUpdated, onDelete }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [visibility, setVisibility] = useState(group.visibility);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, visibility })
      });
      const data = await response.json();
      if (data.success) onUpdated({ name, description, visibility });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="nx-card p-5 mb-6 space-y-3">
      <input
        value={name}
        onChange={(event) => setName(event.target.value.slice(0, 100))}
        className="w-full text-sm rounded-xl2 border border-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value.slice(0, 2000))}
        rows={2}
        className="w-full text-sm rounded-xl2 border border-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none"
      />
      <select
        value={visibility}
        onChange={(event) => setVisibility(event.target.value)}
        className="text-sm rounded-xl2 border border-slate-200 px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        <option value="public">{t("Public")}</option>
        <option value="private">{t("Prive")}</option>
      </select>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 bg-brand-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl2"
        >
          {isSaving && <Loader2 size={14} className="animate-spin" />}{' '}{t("Enregistrer")}</button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-ember-600 bg-ember-50 hover:bg-ember-100 text-sm font-medium px-4 py-2.5 rounded-xl2"
          >
            <Trash2 size={14} />{' '}{t("Supprimer le groupe")}</button>
        )}
      </div>
    </div>
  );
}
