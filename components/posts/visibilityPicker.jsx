import { useState, useEffect } from 'react';
import { Globe2, Users, Lock, UserMinus, UserCheck2, ChevronDown } from 'lucide-react';
import Avatar from '@/components/shared/avatar';

import { t } from '@/lib/i18n/runtime';
const OPTIONS = [
  { value: 'public', get label() { return t("Public"); }, icon: Globe2, get description() { return t("Tout le monde peut voir cette publication"); } },
  { value: 'friends', get label() { return t("Amis"); }, icon: Users, get description() { return t("Seuls vos amis peuvent voir cette publication"); } },
  { value: 'private', get label() { return t("Prive"); }, icon: Lock, get description() { return t("Vous seul pouvez voir cette publication"); } },
  {
    value: 'exceptFor',
    get label() { return t("Tout le monde sauf..."); },
    icon: UserMinus,
    get description() { return t("Visible par tous sauf les personnes selectionnees"); }
  },
  {
    value: 'onlyFor',
    get label() { return t("Personnes precises"); },
    icon: UserCheck2,
    get description() { return t("Visible uniquement par les personnes selectionnees"); }
  }
];

export default function VisibilityPicker({ value, onChange, selectedUserIds, onSelectedUserIdsChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const needsUserPicker = value === 'exceptFor' || value === 'onlyFor';

  useEffect(() => {
    if (needsUserPicker && friends.length === 0) {
      fetch('/api/friends')
        .then((response) => response.json())
        .then((data) => setFriends(data.success ? data.items : []));
    }
  }, [needsUserPicker, friends.length]);

  const current = OPTIONS.find((option) => option.value === value) || OPTIONS[0];

  function toggleUser(userId) {
    if (selectedUserIds.includes(userId)) {
      onSelectedUserIdsChange(selectedUserIds.filter((id) => id !== userId));
    } else {
      onSelectedUserIdsChange([...selectedUserIds, userId]);
    }
  }

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="nx-chip h-9 px-3 gap-2"
        >
          <current.icon size={14} />
          {current.label}
          <ChevronDown size={14} />
        </button>

        {isOpen && (
          <div className="absolute start-0 mt-2 w-72 max-w-[calc(100vw-3rem)] nx-pop rounded-2xl p-1.5 z-30 animate-pop-in">
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-start hover:bg-slate-50 transition-colors ${
                  option.value === value ? 'bg-brand-50' : ''
                }`}
              >
                <option.icon size={16} className={option.value === value ? 'text-brand-600' : 'text-slate-400'} />
                <span>
                  <span
                    className={`block text-sm font-medium ${
                      option.value === value ? 'text-brand-600' : 'text-slate-800'
                    }`}
                  >
                    {option.label}
                  </span>
                  <span className="block text-xs text-slate-400">{option.description}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {needsUserPicker && (
        <div className="mt-3 border border-slate-200 rounded-xl2 p-3 max-h-40 overflow-y-auto space-y-1">
          {friends.length === 0 && <p className="text-xs text-slate-400">{t("Aucun ami a selectionner")}</p>}
          {friends.map((friend) => (
            <label
              key={friend.id}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl2 hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedUserIds.includes(friend.id)}
                onChange={() => toggleUser(friend.id)}
                className="accent-brand-500"
              />
              <Avatar src={friend.avatar} firstName={friend.firstName} lastName={friend.lastName} size="sm" />
              <span className="text-sm text-slate-700">
                {friend.firstName} {friend.lastName}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
