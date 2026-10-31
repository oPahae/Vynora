import { useEffect, useState } from 'react';
import { Hash, Volume2, Lock, Loader2, Search } from 'lucide-react';
import Modal, { inputClasses, primaryButton, ghostButton } from '@/components/servers/modal';

import { t } from '@/lib/i18n/runtime';
// Creation / edition d'un salon : nom, type (creation uniquement),
// categorie, sujet, et acces prive (membres autorises).
export default function ChannelModal({ guildId, categories, channel, defaultCategoryId, onSaved, onClose }) {
  const isEdit = Boolean(channel);
  const [name, setName] = useState(channel?.name || '');
  const [type, setType] = useState(channel?.type || 'text');
  const [categoryId, setCategoryId] = useState(String(channel?.categoryId ?? defaultCategoryId ?? ''));
  const [topic, setTopic] = useState(channel?.topic || '');
  const [isPrivate, setIsPrivate] = useState(Boolean(channel?.isPrivate));
  const [members, setMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [roles, setRoles] = useState([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState(new Set());
  const [memberSearch, setMemberSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const membersRes = await fetch(`/api/guilds/${guildId}/members`).then((r) => r.json());
      if (!cancelled && membersRes.success) setMembers(membersRes.members);
      const rolesRes = await fetch(`/api/guilds/${guildId}/roles`).then((r) => r.json());
      if (!cancelled && rolesRes.success) setRoles(rolesRes.roles.filter((role) => !role.isDefault));
      if (isEdit) {
        const accessRes = await fetch(`/api/guilds/${guildId}/channels/${channel.id}`).then((r) => r.json());
        if (!cancelled && accessRes.success) {
          setSelectedIds(new Set(accessRes.access.userIds));
          setSelectedRoleIds(new Set(accessRes.access.roleIds));
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [guildId, isEdit, channel?.id]);

  function toggleMember(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRole(id) {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError('');
    const body = {
      name: name.trim(),
      topic,
      categoryId: categoryId ? Number(categoryId) : null,
      isPrivate,
      userIds: [...selectedIds],
      roleIds: [...selectedRoleIds]
    };
    if (!isEdit) body.type = type;
    try {
      const response = await fetch(
        isEdit ? `/api/guilds/${guildId}/channels/${channel.id}` : `/api/guilds/${guildId}/channels`,
        { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      const data = await response.json();
      if (!data.success) {
        setError(data.message || t("Une erreur est survenue"));
        return;
      }
      onSaved(data.channel);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredMembers = members.filter((m) =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(memberSearch.trim().toLowerCase())
  );

  return (
    <Modal
      title={isEdit ? t("Modifier #{name}", { name: channel.name }) : t("Creer un salon")}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostButton}>{t("Annuler")}</button>
          <button type="submit" form="channel-form" disabled={isSubmitting || !name.trim()} className={primaryButton}>
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? t("Enregistrer") : t("Creer")}
          </button>
        </>
      }
    >
      <form id="channel-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>}

        {!isEdit && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'text', label: t("Textuel"), icon: Hash },
              { value: 'voice', label: t("Vocal"), icon: Volume2 }
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={`flex items-center justify-center gap-2 rounded-xl2 border px-3 py-2.5 text-sm font-medium transition-all ${
                  type === option.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <option.icon size={16} />
                {option.label}
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Nom du salon")}</label>
          <input maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} autoFocus />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Categorie")}</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClasses}>
            <option value="">{t("Aucune categorie")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {(isEdit ? channel.type : type) === 'text' && (
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Sujet (optionnel)")}</label>
            <input maxLength={200} value={topic} onChange={(e) => setTopic(e.target.value)} className={inputClasses} />
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mt-1" />
          <span className="text-sm">
            <span className="flex items-center gap-1.5 font-medium text-slate-800">
              <Lock size={14} />{' '}{t("Salon prive")}</span>
            <span className="text-xs text-slate-500">{t("Visible uniquement par les administrateurs et les membres choisis ci-dessous.")}</span>
          </span>
        </label>

        {isPrivate && roles.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500">{t("Roles autorises")}</p>
            <ul className="max-h-36 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-xl2">
              {roles.map((role) => (
                <li key={role.id}>
                  <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={selectedRoleIds.has(role.id)} onChange={() => toggleRole(role.id)} />
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                    <span className="text-sm text-slate-700 truncate">{role.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isPrivate && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">{t("Membres autorises")}</p>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl2 px-3 py-2 border border-slate-100">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder={t("Rechercher un membre")}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <ul className="max-h-44 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-xl2">
              {filteredMembers.map((member) => (
                <li key={member.id}>
                  <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={selectedIds.has(member.id)} onChange={() => toggleMember(member.id)} />
                    <span className="text-sm text-slate-700 truncate">
                      {member.firstName} {member.lastName}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  );
}
