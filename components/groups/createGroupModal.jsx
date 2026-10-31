import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Users, Globe, Lock } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
export default function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("Le nom du groupe est requis"));
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), visibility })
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || t("Erreur lors de la creation du groupe"));
        return;
      }
      onCreated(data.groupId);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 nx-scrim flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        className="nx-pop rounded-b-none sm:rounded-b-xl3 w-full max-w-md"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Users size={18} className="text-brand-500" />{' '}{t("Creer un groupe")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t("Nom du groupe")}</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, 100))}
              placeholder={t("Ex. Devs Casablanca")}
              autoFocus
              className="w-full text-sm rounded-xl2 border border-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t("Description (facultatif)")}</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, 2000))}
              rows={3}
              placeholder={t("De quoi parle ce groupe ?")}
              className="w-full text-sm rounded-xl2 border border-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t("Confidentialite")}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl2 border text-sm font-medium transition-colors ${
                  visibility === 'public' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'
                }`}
              >
                <Globe size={15} />{' '}{t("Public")}</button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl2 border text-sm font-medium transition-colors ${
                  visibility === 'private' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'
                }`}
              >
                <Lock size={15} />{' '}{t("Prive")}</button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {visibility === 'public'
                ? t("Visible par tous, adhesion immediate.")
                : t("Adhesion sur demande, publications reservees aux membres.")}
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="nx-btn-primary w-full h-11"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}{t("Creer le groupe")}</button>
        </form>
      </motion.div>
    </motion.div>
  );
}
