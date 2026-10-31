import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Smile, X, Loader2, Check } from 'lucide-react';
import { STATUS_PRESETS, STATUS_ICON_CHOICES } from '@/lib/statusConstants';
import StatusIcon from './statusIcon';

import { t } from '@/lib/i18n/runtime';
const DURATION_OPTIONS = [
  { key: 'none', get label() { return t("Jusqu'a modification"); } },
  { key: '1h', get label() { return t("1 heure"); } },
  { key: '4h', get label() { return t("4 heures"); } },
  { key: 'today', get label() { return t("Aujourd'hui"); } }
];

export default function StatusPicker() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [emoji, setEmoji] = useState(STATUS_ICON_CHOICES[0]);
  const [label, setLabel] = useState('');
  const [duration, setDuration] = useState('none');
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      if (data.success) setStatus(data.status);
    } catch (error) {}
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function applyStatus(nextEmoji, nextLabel, nextDuration) {
    setIsSaving(true);
    try {
      const response = await fetch('/api/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: nextEmoji, label: nextLabel, duration: nextDuration })
      });
      const data = await response.json();
      if (data.success) {
        setStatus(data.status);
        setIsOpen(false);
        setLabel('');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClear() {
    setIsSaving(true);
    try {
      await fetch('/api/status', { method: 'DELETE' });
      setStatus(null);
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCustomSubmit(event) {
    event.preventDefault();
    if (!label.trim()) return;
    applyStatus(emoji, label.trim(), duration);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`nx-icon-btn ${isOpen ? 'bg-slate-100 text-slate-900' : ''} ${status?.emoji ? 'text-brand-600' : ''}`}
        title={status ? status.label : t("Definir un statut")}
        aria-label={status ? status.label : t("Definir un statut")}
        aria-expanded={isOpen}
      >
        {status?.emoji ? <StatusIcon name={status.emoji} size={19} /> : <Smile size={19} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute end-0 mt-2 w-72 max-w-[calc(100vw-2rem)] nx-pop overflow-hidden z-30"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-display font-semibold text-slate-900 text-sm">{t("Statut personnalise")}</h3>
              {status && (
                <button
                  onClick={handleClear}
                  disabled={isSaving}
                  className="flex items-center gap-1 text-xs text-ember-600 hover:underline font-medium disabled:opacity-60"
                >
                  <X size={13} />{' '}{t("Effacer")}</button>
              )}
            </div>

            <div className="p-3 space-y-1">
              {STATUS_PRESETS.map((preset) => {
                const isActive = status && status.emoji === preset.emoji && status.label === preset.label;
                return (
                  <button
                    key={preset.label}
                    onClick={() => applyStatus(preset.emoji, preset.label, duration)}
                    disabled={isSaving}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl2 text-sm transition-colors disabled:opacity-60 ${
                      isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <StatusIcon name={preset.emoji} size={16} />
                    <span className="flex-1 text-start truncate">{preset.label}</span>
                    {isActive && <Check size={14} className="text-brand-500" />}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleCustomSubmit} className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-3">
              <div className="grid grid-cols-8 gap-1.5 p-2 bg-slate-50 rounded-xl2 border border-slate-100">
                {STATUS_ICON_CHOICES.map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setEmoji(iconName)}
                    aria-label={iconName}
                    className={`flex items-center justify-center aspect-square rounded-lg transition-colors ${
                      emoji === iconName
                        ? 'bg-brand-500 text-white'
                        : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    <StatusIcon name={iconName} size={15} />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl2 border border-slate-200 text-slate-600">
                  <StatusIcon name={emoji} size={17} />
                </span>
                <input
                  type="text"
                  value={label}
                  onChange={(event) => setLabel(event.target.value.slice(0, 80))}
                  placeholder={t("Statut personnalise...")}
                  className="flex-1 min-w-0 text-sm rounded-xl2 border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
              <select
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                className="w-full text-xs rounded-xl2 border border-slate-200 px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{t("Expire : {label}", { label: option.label })}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isSaving || !label.trim()}
                className="nx-btn-primary w-full"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : null}{t("Definir ce statut")}</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
