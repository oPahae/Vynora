import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Loader2, Check, X, RotateCcw } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
const ACTIONS = [
  { key: 'improve', get label() { return t("Ameliorer"); } },
  { key: 'correct', get label() { return t("Corriger"); } },
  { key: 'rephrase', get label() { return t("Reformuler"); } },
  { key: 'summarize', get label() { return t("Resumer"); } },
  { key: 'translate', get label() { return t("Traduire"); } },
  { key: 'caption', get label() { return t("Generer une legende"); } }
];

export default function AiAssistantPanel({ text, onApply }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function runAction(action) {
    if (!text.trim()) {
      setError(t("Ecrivez d'abord un texte a traiter."));
      return;
    }
    setLoadingAction(action);
    setError('');
    setResult('');
    try {
      const response = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, text })
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || t("Erreur de l'assistant IA"));
        return;
      }
      setResult(data.result);
    } catch (err) {
      setError(t("Impossible de contacter l'assistant IA"));
    } finally {
      setLoadingAction(null);
    }
  }

  function handleApply() {
    onApply(result);
    setResult('');
    setIsOpen(false);
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="nx-chip nx-chip-active h-9 px-3 gap-2 max-xs:w-9 max-xs:px-0 max-xs:justify-center"
        title={t("Assistant IA")}
        aria-label={t("Assistant IA")}
      >
        <Sparkles size={14} /><span className="max-xs:hidden">{t("Assistant IA")}</span></button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute start-0 bottom-full mb-2 w-80 max-w-[calc(100vw-3rem)] nx-pop overflow-hidden z-30"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-display font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                <Sparkles size={14} className="text-brand-500" />{' '}{t("Assistant IA")}</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={15} />
              </button>
            </div>

            <div className="p-3">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {ACTIONS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => runAction(item.key)}
                    disabled={loadingAction !== null}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 px-3 py-1.5 rounded-xl2 transition-colors"
                  >
                    {loadingAction === item.key && <Loader2 size={11} className="animate-spin" />}
                    {item.label}
                  </button>
                ))}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl2 px-3 py-2 mb-2">
                  {error}
                </div>
              )}

              {result && (
                <div className="space-y-2">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl2 px-3 py-2.5 text-sm text-slate-700 max-h-40 overflow-y-auto">
                    {result}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleApply}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-brand-500 text-white text-xs font-medium px-3 py-2 rounded-xl2"
                    >
                      <Check size={13} />{' '}{t("Utiliser ce texte")}</button>
                    <button
                      type="button"
                      onClick={() => setResult('')}
                      className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium px-3 py-2 rounded-xl2"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
