import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, Loader2, Plus, Trash2, Users, X } from 'lucide-react';
import { inputClasses, primaryButton } from '@/components/servers/modal';
import { PERMISSIONS, PERMISSION_LABELS, hasPermission } from '@/lib/guildPermissions';
import { useConfirm } from '@/lib/confirmContext';

import { t } from '@/lib/i18n/runtime';
// Permissions "banales" cochees par defaut pour un nouveau role : parler
// dans les salons textuels/vocaux et inviter du monde. Le createur peut
// toujours les decocher ensuite ; seules les permissions sensibles
// (moderation, gestion) restent decochees par defaut.
const DEFAULT_NEW_ROLE_PERMISSIONS =
  PERMISSIONS.SEND_MESSAGES |
  PERMISSIONS.CONNECT |
  PERMISSIONS.SPEAK |
  PERMISSIONS.VIDEO |
  PERMISSIONS.SCREEN_SHARE |
  PERMISSIONS.CREATE_INVITE;

const PERMISSION_GROUPS = [
  { get title() { return t("General"); }, keys: ['ADMINISTRATOR', 'MANAGE_GUILD', 'MANAGE_CHANNELS', 'MANAGE_ROLES', 'KICK_MEMBERS', 'CREATE_INVITE'] },
  { get title() { return t("Salons textuels"); }, keys: ['SEND_MESSAGES', 'MANAGE_MESSAGES', 'MANAGE_SLOWMODE', 'BYPASS_SLOWMODE'] },
  { get title() { return t("Salons vocaux"); }, keys: ['CONNECT', 'SPEAK', 'VIDEO', 'SCREEN_SHARE', 'MUTE_MEMBERS'] }
];

const PRESET_COLORS = ['#99AAB5', '#4548D9', '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#1ABC9C', '#3498DB', '#9B59B6', '#E91E63'];

async function api(url, options) {
  try {
    const response = await fetch(url, options);
    return await response.json();
  } catch (error) {
    return { success: false, message: t("Impossible de contacter le serveur") };
  }
}

const jsonInit = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Gestion des roles : liste hierarchisee a gauche, editeur a droite (sur
// mobile, on affiche l'un OU l'autre en plein ecran).
export default function RolesModal({ guildId, actorPermissions, actorTopPosition, isOwner, onClose }) {
  const confirm = useConfirm();
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [mobileEditing, setMobileEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await api(`/api/guilds/${guildId}/roles`);
    if (data.success) setRoles(data.roles);
    setIsLoading(false);
    return data.success ? data.roles : [];
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = roles.find((role) => role.id === selectedId) || null;

  useEffect(() => {
    setError('');
    setDraft(selected ? { name: selected.name, color: selected.color, permissions: selected.permissions } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, roles]);

  const canEditRole = (role) => (isOwner ? true : !role.isDefault && role.position < actorTopPosition);
  // @everyone : modifiable seulement par le proprietaire ou un administrateur.
  const canEditSelected =
    selected && (selected.isDefault ? isOwner || hasPermission(actorPermissions, PERMISSIONS.ADMINISTRATOR) : canEditRole(selected));

  function select(role) {
    setSelectedId(role.id);
    setMobileEditing(true);
  }

  // Permissions par defaut du nouveau role, limitees a celles que le
  // createur possede reellement (un administrateur les possede toutes).
  function grantableDefaults() {
    return Object.values(PERMISSIONS).reduce(
      (mask, bit) => ((DEFAULT_NEW_ROLE_PERMISSIONS & bit) === bit && hasPermission(actorPermissions, bit) ? mask | bit : mask),
      0
    );
  }

  async function createRole() {
    const data = await api(
      `/api/guilds/${guildId}/roles`,
      jsonInit('POST', { name: t("Nouveau role"), permissions: grantableDefaults() })
    );
    if (!data.success) {
      setError(data.message || t("Une erreur est survenue"));
      return;
    }
    await load();
    select(data.role);
  }

  async function save() {
    if (!draft || !canEditSelected) return;
    setIsSaving(true);
    setError('');
    const body = selected.isDefault ? { permissions: draft.permissions } : draft;
    const data = await api(`/api/guilds/${guildId}/roles/${selected.id}`, jsonInit('PUT', body));
    setIsSaving(false);
    if (!data.success) {
      setError(data.message || t("Une erreur est survenue"));
      return;
    }
    load();
  }

  async function removeRole() {
    const ok = await confirm({
      title: t("Supprimer le role {name} ?", { name: selected.name }),
      message: t("Il sera retire a tous ses membres."),
      confirmLabel: t("Supprimer")
    });
    if (!ok) return;
    const data = await api(`/api/guilds/${guildId}/roles/${selected.id}`, { method: 'DELETE' });
    if (!data.success) {
      setError(data.message || t("Une erreur est survenue"));
      return;
    }
    setSelectedId(null);
    setMobileEditing(false);
    load();
  }

  async function move(role, direction) {
    const data = await api(`/api/guilds/${guildId}/roles/${role.id}/move`, jsonInit('POST', { direction }));
    if (!data.success) setError(data.message || t("Deplacement impossible"));
    else load();
  }

  function togglePermission(key) {
    const bit = PERMISSIONS[key];
    setDraft((prev) => ({ ...prev, permissions: (prev.permissions & bit) === bit ? prev.permissions & ~bit : prev.permissions | bit }));
  }

  const customRoles = roles.filter((role) => !role.isDefault);
  const everyone = roles.find((role) => role.isDefault);
  const isDirty = selected && draft && (draft.name !== selected.name || draft.color !== selected.color || draft.permissions !== selected.permissions);

  const roleRow = (role, index) => (
    <div
      key={role.id}
      className={`flex items-center gap-1 rounded-xl2 pe-1 ${role.id === selectedId ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
    >
      <button type="button" onClick={() => select(role)} className="flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-2.5 text-start">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
        <span className="text-sm font-medium text-slate-800 truncate">{role.name}</span>
        <span className="ms-auto flex items-center gap-0.5 text-[11px] text-slate-400 shrink-0">
          <Users size={11} /> {role.memberCount}
        </span>
      </button>
      {!role.isDefault && canEditRole(role) && (
        <div className="flex flex-col shrink-0">
          <button type="button" disabled={index === 0} onClick={() => move(role, 'up')} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25" aria-label={t("Monter")}>
            <ArrowUp size={13} />
          </button>
          <button type="button" disabled={index === customRoles.length - 1} onClick={() => move(role, 'down')} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25" aria-label={t("Descendre")}>
            <ArrowDown size={13} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label={t("Fermer")} onClick={onClose} className="absolute inset-0 bg-ink/50" />
      <div className="relative w-full sm:max-w-3xl bg-surface sm:rounded-xl3 shadow-soft h-[100dvh] sm:h-[80vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-2 px-4 h-14 shrink-0 border-b border-slate-100">
          {mobileEditing && (
            <button type="button" onClick={() => setMobileEditing(false)} className="sm:hidden p-1.5 -ms-1.5 text-slate-500" aria-label={t("Retour")}>
              <ArrowLeft size={20} />
            </button>
          )}
          <h3 className="font-display font-semibold text-slate-900 flex-1">{t("Roles")}</h3>
          <button type="button" onClick={onClose} className="p-1.5 -me-1.5 text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className={`${mobileEditing ? 'hidden' : 'flex'} sm:flex flex-col w-full sm:w-64 sm:shrink-0 sm:border-e border-slate-100 min-h-0`}>
            <div className="p-3 shrink-0">
              <button type="button" onClick={createRole} className={`${primaryButton} w-full justify-center`}>
                <Plus size={15} />{' '}{t("Nouveau role")}</button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
              {isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-brand-400" />
                </div>
              )}
              {customRoles.map(roleRow)}
              {everyone && <div className="pt-2 mt-2 border-t border-slate-100">{roleRow(everyone, -1)}</div>}
              {!isLoading && customRoles.length === 0 && (
                <p className="text-xs text-slate-400 px-2 py-3">{t("Aucun role personnalise. Creez-en un pour commencer.")}</p>
              )}
            </div>
          </div>

          <div className={`${mobileEditing ? 'flex' : 'hidden'} sm:flex flex-col flex-1 min-w-0 min-h-0`}>
            {!selected || !draft ? (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400 p-6 text-center">{t("Selectionnez un role pour le modifier.")}</div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>}
                  {!canEditSelected && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-xl2 px-3 py-2">{t("Ce role est au-dessus du votre ou reserve : vous pouvez le consulter mais pas le modifier.")}</p>
                  )}

                  {!selected.isDefault && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Nom du role")}</label>
                        <input
                          value={draft.name}
                          maxLength={50}
                          disabled={!canEditSelected}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          className={inputClasses}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">{t("Couleur")}</label>
                        <div className="flex flex-wrap items-center gap-2">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              disabled={!canEditSelected}
                              onClick={() => setDraft({ ...draft, color })}
                              className={`w-7 h-7 rounded-full border-2 ${draft.color.toLowerCase() === color.toLowerCase() ? 'border-slate-900' : 'border-transparent'}`}
                              style={{ backgroundColor: color }}
                              aria-label={color}
                            />
                          ))}
                          <input
                            type="color"
                            value={draft.color}
                            disabled={!canEditSelected}
                            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                            className="w-8 h-8 rounded-lg border border-slate-200 bg-surface p-0.5"
                            aria-label={t("Couleur personnalisee")}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {selected.isDefault && (
                    <p className="text-xs text-slate-500">{t("@everyone s'applique a tous les membres du serveur. Ses permissions sont la base de tous les autres roles.")}</p>
                  )}

                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.title}>
                      <p className="text-[11px] font-semibold  text-slate-400 mb-1">{group.title}</p>
                      <div className="divide-y divide-slate-50 border border-slate-100 rounded-xl2">
                        {group.keys.map((key) => {
                          const bit = PERMISSIONS[key];
                          const checked = (draft.permissions & bit) === bit;
                          // On ne peut modifier que les droits que l'on possede.
                          const allowed = canEditSelected && hasPermission(actorPermissions, bit);
                          return (
                            <label key={key} className={`flex items-center gap-3 px-3 py-2.5 ${allowed ? 'cursor-pointer' : 'opacity-50'}`}>
                              <input type="checkbox" checked={checked} disabled={!allowed} onChange={() => togglePermission(key)} />
                              <span className="text-sm text-slate-700">{PERMISSION_LABELS[key]}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {canEditSelected && (
                  <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-100">
                    {!selected.isDefault ? (
                      <button type="button" onClick={removeRole} className="flex items-center gap-1.5 text-sm text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl2">
                        <Trash2 size={14} />{' '}{t("Supprimer")}</button>
                    ) : (
                      <span />
                    )}
                    <button type="button" onClick={save} disabled={isSaving || !isDirty || !draft.name.trim()} className={primaryButton}>
                      {isSaving && <Loader2 size={15} className="animate-spin" />}{t("Enregistrer")}</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
