import { useState } from 'react';
import Link from 'next/link';
import { Hash, Volume2, Lock, ChevronDown, Plus, Pencil, Trash2, UserPlus, LogOut, FolderPlus, Settings2, ShieldCheck, MicOff } from 'lucide-react';
import Avatar from '@/components/shared/avatar';
import { PERMISSIONS, hasPermission } from '@/lib/guildPermissions';

import { t } from '@/lib/i18n/runtime';
function ChannelRow({ channel, active, unread, canManage, onSelect, onEdit, onDelete }) {
  const Icon = channel.type === 'voice' ? Volume2 : Hash;
  return (
    <div
      className={`group flex items-center gap-1 rounded-xl2 pe-1 ${
        active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(channel)}
        className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 text-sm text-start"
      >
        <Icon size={16} className="shrink-0 opacity-70" />
        <span className={`truncate ${unread && !active ? 'font-bold text-slate-900' : 'font-medium'}`}>{channel.name}</span>
        {channel.isPrivate && <Lock size={12} className="shrink-0 opacity-60" />}
        {unread && !active && <span className="ms-auto w-2 h-2 rounded-full bg-brand-500 shrink-0" />}
      </button>
      {canManage && (
        <div className="flex items-center md:opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={() => onEdit(channel)} className="p-1.5 text-slate-400 hover:text-slate-700" title={t("Modifier")}>
            <Pencil size={13} />
          </button>
          <button type="button" onClick={() => onDelete(channel)} className="p-1.5 text-slate-400 hover:text-red-500" title={t("Supprimer")}>
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// Personnes actuellement connectees a un salon vocal, sous le nom du salon
// (visible meme pour ceux qui n'ont pas rejoint le salon).
function VoiceOccupants({ users }) {
  if (!users || users.length === 0) return null;
  return (
    <ul className="ps-8 pe-2 pb-1 space-y-0.5">
      {users.map((occupant) => (
        <li key={occupant.userId} className="flex items-center gap-2 py-0.5 text-slate-500">
          <Avatar src={occupant.avatar} firstName={occupant.firstName} lastName={occupant.lastName} size="xs" />
          <span className="text-xs truncate flex-1 min-w-0">
            {occupant.firstName} {occupant.lastName}
          </span>
          {occupant.muted && <MicOff size={11} className="shrink-0 text-red-400" />}
        </li>
      ))}
    </ul>
  );
}

// Colonne des salons : en-tete du serveur (menu), categories repliables et
// salons. Les actions de gestion n'apparaissent qu'avec la permission.
export default function ChannelSidebar({
  overview,
  guilds,
  activeChannelId,
  unreadChannelIds,
  voiceOccupants,
  onSelectChannel,
  onCreateChannel,
  onEditChannel,
  onDeleteChannel,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onInvite,
  onManageRoles,
  onLeave,
  onDeleteGuild
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(new Set());
  const { guild, categories, channels, permissions, isOwner } = overview;
  const canManageChannels = hasPermission(permissions, PERMISSIONS.MANAGE_CHANNELS);
  const canInvite = hasPermission(permissions, PERMISSIONS.CREATE_INVITE);
  const canManageRoles = hasPermission(permissions, PERMISSIONS.MANAGE_ROLES);

  function toggleCategory(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const uncategorized = channels.filter((channel) => !channel.categoryId);

  const renderChannel = (channel) => (
    <div key={channel.id}>
      <ChannelRow
        channel={channel}
        active={channel.id === activeChannelId}
        unread={unreadChannelIds.has(channel.id)}
        canManage={canManageChannels}
        onSelect={onSelectChannel}
        onEdit={onEditChannel}
        onDelete={onDeleteChannel}
      />
      {channel.type === 'voice' && <VoiceOccupants users={voiceOccupants ? voiceOccupants[channel.id] : null} />}
    </div>
  );

  const menuItem = 'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-start hover:bg-slate-50';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Selecteur de serveur horizontal (mobile uniquement : la colonne
          verticale n'est affichee que sur ecran moyen et plus). */}
      <div className="md:hidden flex items-center gap-2 px-3 py-2 overflow-x-auto shrink-0 border-b border-slate-100">
        <Link href="/servers" className="shrink-0 w-10 h-10 rounded-xl2 bg-slate-100 text-slate-500 flex items-center justify-center" title={t("Mes serveurs")}>
          <Plus size={18} />
        </Link>
        {guilds.map((g) => (
          <Link
            key={g.id}
            href={`/servers/${g.id}`}
            className={`shrink-0 w-10 h-10 rounded-xl2 flex items-center justify-center font-display font-semibold text-sm ${
              g.id === guild.id ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
            title={g.name}
          >
            {g.name.charAt(0).toUpperCase()}
          </Link>
        ))}
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="w-full flex items-center justify-between gap-2 px-4 h-14 border-b border-slate-100 hover:bg-slate-50"
        >
          <span className="font-display font-semibold text-slate-900 truncate">{guild.name}</span>
          <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen && (
          <>
            <button type="button" aria-label={t("Fermer le menu")} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute start-2 end-2 top-[calc(100%+4px)] z-20 nx-card !rounded-xl2 overflow-hidden"
              onClick={() => setMenuOpen(false)}
            >
              {canInvite && (
                <button type="button" className={`${menuItem} text-brand-700`} onClick={onInvite}>
                  <UserPlus size={15} />{' '}{t("Inviter des personnes")}</button>
              )}
              {canManageChannels && (
                <>
                  <button type="button" className={menuItem} onClick={() => onCreateChannel(null)}>
                    <Plus size={15} />{' '}{t("Creer un salon")}</button>
                  <button type="button" className={menuItem} onClick={onCreateCategory}>
                    <FolderPlus size={15} />{' '}{t("Creer une categorie")}</button>
                </>
              )}
              {canManageRoles && (
                <button type="button" className={menuItem} onClick={onManageRoles}>
                  <ShieldCheck size={15} />{' '}{t("Gerer les roles")}</button>
              )}
              {isOwner ? (
                <button type="button" className={`${menuItem} text-red-600`} onClick={onDeleteGuild}>
                  <Trash2 size={15} />{' '}{t("Supprimer le serveur")}</button>
              ) : (
                <button type="button" className={`${menuItem} text-red-600`} onClick={onLeave}>
                  <LogOut size={15} />{' '}{t("Quitter le serveur")}</button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {uncategorized.length > 0 && <div className="space-y-0.5">{uncategorized.map(renderChannel)}</div>}

        {categories.map((category) => {
          const categoryChannels = channels.filter((channel) => channel.categoryId === category.id);
          const isCollapsed = collapsed.has(category.id);
          // Une categorie vide n'est montree qu'a ceux qui peuvent la gerer
          // (ou parce que ses salons prives leur sont caches).
          if (categoryChannels.length === 0 && !canManageChannels) return null;
          return (
            <div key={category.id}>
              <div className="group flex items-center pe-1">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="flex-1 min-w-0 flex items-center gap-1 px-1.5 py-1 text-[11px] font-semibold  text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown size={12} className={`shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  <span className="truncate">{category.name}</span>
                </button>
                {canManageChannels && (
                  <div className="flex items-center md:opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <button type="button" onClick={() => onCreateChannel(category.id)} className="p-1 text-slate-400 hover:text-slate-700" title={t("Creer un salon")}>
                      <Plus size={14} />
                    </button>
                    <button type="button" onClick={() => onRenameCategory(category)} className="p-1 text-slate-400 hover:text-slate-700" title={t("Renommer")}>
                      <Settings2 size={13} />
                    </button>
                    <button type="button" onClick={() => onDeleteCategory(category)} className="p-1 text-slate-400 hover:text-red-500" title={t("Supprimer")}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
              {!isCollapsed && <div className="space-y-0.5">{categoryChannels.map(renderChannel)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
