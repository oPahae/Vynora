import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useEffect, useState } from 'react';
import { Loader2, Crown, UserMinus } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import Modal, { primaryButton, ghostButton } from '@/components/servers/modal';
import { PERMISSIONS, hasPermission } from '@/lib/guildPermissions';
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

// Fiche d'un membre : ses roles (attribuables selon la hierarchie) et
// l'expulsion. Les droits sont revalides cote serveur.
export default function MemberModal({ guildId, member, currentUserId, actorPermissions, actorTopPosition, isOwner, onClose, onChanged }) {
  const confirm = useConfirm();
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const canManageRoles = hasPermission(actorPermissions, PERMISSIONS.MANAGE_ROLES);
  const canKick = hasPermission(actorPermissions, PERMISSIONS.KICK_MEMBERS);
  const targetTop = member.isOwner ? Infinity : member.topRole ? member.topRole.position : 0;
  const outranks = isOwner || (!member.isOwner && (member.id === currentUserId || targetTop < actorTopPosition));
  const editableRoles = canManageRoles && outranks && (!member.isOwner || member.id === currentUserId);
  const kickable = canKick && member.id !== currentUserId && !member.isOwner && (isOwner || targetTop < actorTopPosition);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const rolesRes = await api(`/api/guilds/${guildId}/roles`);
      if (!cancelled && rolesRes.success) setRoles(rolesRes.roles.filter((role) => !role.isDefault));
      if (canManageRoles) {
        const mine = await api(`/api/guilds/${guildId}/members/${member.id}/roles`);
        if (!cancelled && mine.success) setSelected(new Set(mine.roleIds));
      } else {
        setSelected(new Set(member.roles.map((role) => role.id)));
      }
      if (!cancelled) setIsLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [guildId, member.id, canManageRoles, member.roles]);

  function toggle(role) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role.id)) next.delete(role.id);
      else next.add(role.id);
      return next;
    });
  }

  async function save() {
    setIsSaving(true);
    setError('');
    const data = await api(`/api/guilds/${guildId}/members/${member.id}/roles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleIds: [...selected] })
    });
    setIsSaving(false);
    if (!data.success) {
      setError(data.message || t("Une erreur est survenue"));
      return;
    }
    onChanged();
    onClose();
  }

  async function kick() {
    const ok = await confirm({
      title: t("Expulser {firstName} {lastName} ?", { firstName: member.firstName, lastName: member.lastName }),
      message: t("Cette personne devra etre invitee a nouveau pour revenir."),
      confirmLabel: t("Expulser")
    });
    if (!ok) return;
    const data = await api(`/api/guilds/${guildId}/members/${member.id}`, { method: 'DELETE' });
    if (!data.success) {
      setError(data.message || t("Une erreur est survenue"));
      return;
    }
    onChanged();
    onClose();
  }

  return (
    <Modal
      title={t("Membre")}
      onClose={onClose}
      footer={
        editableRoles ? (
          <>
            <button type="button" onClick={onClose} className={ghostButton}>{t("Annuler")}</button>
            <button type="button" onClick={save} disabled={isSaving || isLoading} className={primaryButton}>
              {isSaving && <Loader2 size={15} className="animate-spin" />}{t("Enregistrer")}</button>
          </>
        ) : null
      }
    >
      <div className="flex items-center gap-3">
        <Avatar src={member.avatar} firstName={member.firstName} lastName={member.lastName} size="md" />
        <div className="min-w-0">
          <p className="font-medium text-slate-900 truncate flex items-center gap-1.5">
            {member.firstName} {member.lastName}{member.verified && <VerifiedBadge size={14} />}
            {member.isOwner && <Crown size={14} className="text-amber-500" />}
          </p>
          <p className="text-xs text-slate-400">{member.isOwner ? t("Proprietaire du serveur") : t("Membre")}</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>}

      <div>
        <p className="text-[11px] font-semibold  text-slate-400 mb-1.5">{t("Roles")}</p>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={18} className="animate-spin text-brand-400" />
          </div>
        ) : roles.length === 0 ? (
          <p className="text-sm text-slate-400">{t("Aucun role n'existe sur ce serveur.")}</p>
        ) : (
          <div className="divide-y divide-slate-50 border border-slate-100 rounded-xl2 max-h-64 overflow-y-auto">
            {roles.map((role) => {
              // Seuls les roles plus bas que le sien sont attribuables.
              const allowed = editableRoles && (isOwner || role.position < actorTopPosition);
              return (
                <label key={role.id} className={`flex items-center gap-3 px-3 py-2.5 ${allowed ? 'cursor-pointer' : 'opacity-50'}`}>
                  <input type="checkbox" checked={selected.has(role.id)} disabled={!allowed} onChange={() => toggle(role)} />
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                  <span className="text-sm text-slate-700 truncate">{role.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {kickable && (
        <button type="button" onClick={kick} className="flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl2">
          <UserMinus size={15} />{' '}{t("Expulser du serveur")}</button>
      )}
    </Modal>
  );
}
