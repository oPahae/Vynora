import VerifiedBadge from '@/components/shared/verifiedBadge';
import { useState, useRef, useEffect } from 'react';
import Avatar from '@/components/shared/avatar';

import { t } from '@/lib/i18n/runtime';
// Champ de saisie avec autocompletion des mentions (@Prenom Nom).
// Navigation : fleches haut/bas, Entree ou Tab pour valider la suggestion
// selectionnee (la premiere par defaut), Echap pour fermer.
// Options : `multiline` (textarea, par defaut) ou champ sur une ligne,
// `inputClassName` pour adapter le style, `dropUp` pour ouvrir la liste vers
// le haut, `onSubmitKey` (champ une ligne : appele sur Entree sans suggestion).
export default function MentionTextarea({
  value,
  onChange,
  mentionedUsers,
  onMentionedUsersChange,
  placeholder,
  rows = 3,
  multiline = true,
  inputClassName,
  dropUp = false,
  autoFocus = false,
  onSubmitKey
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [triggerStart, setTriggerStart] = useState(null);
  const textareaRef = useRef(null); // reference du champ (textarea ou input)

  useEffect(() => {
    if (triggerStart === null) {
      setIsOpen(false);
      return undefined;
    }

    const query = value.slice(triggerStart + 1, textareaRef.current?.selectionStart ?? value.length);
    if (query.includes(' ') || query.length > 30) {
      setIsOpen(false);
      return undefined;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/mentions/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (cancelled) return;
        if (data.success && data.users.length > 0) {
          setSuggestions(data.users);
          setActiveIndex(0);
          setIsOpen(true);
        } else {
          setIsOpen(false);
        }
      } catch (error) {
        if (!cancelled) setIsOpen(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [value, triggerStart]);

  function handleChange(event) {
    const newValue = event.target.value;
    const cursor = event.target.selectionStart;
    onChange(newValue);

    const textBeforeCursor = newValue.slice(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex === -1 || /\s/.test(textBeforeCursor.slice(atIndex + 1))) {
      setTriggerStart(null);
      return;
    }

    const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
    if (charBeforeAt !== ' ' && charBeforeAt !== '\n' && atIndex !== 0) {
      setTriggerStart(null);
      return;
    }

    setTriggerStart(atIndex);
  }

  function selectUser(user) {
    const cursor = textareaRef.current.selectionStart;
    const before = value.slice(0, triggerStart);
    const after = value.slice(cursor);
    const insertion = `@${user.firstName} ${user.lastName} `;
    const newValue = `${before}${insertion}${after}`;

    onChange(newValue);
    onMentionedUsersChange([...mentionedUsers.filter((existing) => existing.id !== user.id), user]);
    setIsOpen(false);
    setTriggerStart(null);

    requestAnimationFrame(() => {
      const newCursor = before.length + insertion.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(newCursor, newCursor);
    });
  }

  function handleKeyDown(event) {
    if (!isOpen || suggestions.length === 0) {
      if (!multiline && event.key === 'Enter' && onSubmitKey) {
        event.preventDefault();
        onSubmitKey();
      }
      return;
    }

    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      selectUser(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectUser(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }

  const fieldClassName =
    inputClassName ||
    'w-full resize-none bg-slate-50 rounded-xl2 px-4 py-3 text-[0.95rem] leading-relaxed text-slate-900 outline-none border border-transparent transition-all focus:bg-surface focus:border-brand-400 focus:shadow-ring placeholder:text-slate-400';

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          autoFocus={autoFocus}
          className={fieldClassName}
        />
      ) : (
        <input
          ref={textareaRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={fieldClassName}
        />
      )}

      {isOpen && (
        <div
          className={`absolute start-2 end-2 ${
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          } bg-surface rounded-xl2 shadow-card border border-slate-100 py-1.5 z-30 max-h-56 overflow-y-auto`}
        >
          {suggestions.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectUser(user)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-start transition-colors ${
                index === activeIndex ? 'bg-brand-50' : 'hover:bg-slate-50'
              }`}
            >
              <Avatar src={user.avatar} firstName={user.firstName} lastName={user.lastName} size="sm" />
              <span className="text-sm text-slate-800">
                {user.firstName} {user.lastName}{user.verified && <VerifiedBadge size={14} />}
              </span>
              {index === 0 && <span className="text-[10px] text-slate-400 ms-auto">{t("Tab")}</span>}
              {index !== 0 && user.isFriend && <span className="text-xs text-slate-400 ms-auto">{t("Ami")}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
