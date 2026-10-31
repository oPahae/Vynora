import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, LoaderCircle } from 'lucide-react';
import SOCIAL_LINKS from '@/components/shared/socialLinksConfig';
import ProfileMusicEditor from '@/components/profile/profileMusicEditor';

import { t } from '@/lib/i18n/runtime';
const FIELDS = [
  { name: 'firstName', get label() { return t("Prenom"); } },
  { name: 'lastName', get label() { return t("Nom"); } },
  { name: 'work', get label() { return t("Travail"); } },
  { name: 'education', get label() { return t("Etudes"); } },
  { name: 'city', get label() { return t("Ville"); } },
  { name: 'country', get label() { return t("Pays"); } }
];

export default function EditProfileModal({ profile, onClose, onSaved, onProfilePatch }) {
  const [form, setForm] = useState({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    bio: profile.bio || '',
    work: profile.work || '',
    education: profile.education || '',
    city: profile.city || '',
    country: profile.country || '',
    phone: profile.phone || '',
    gender: profile.gender || '',
    birthDate: profile.birthDate ? profile.birthDate.slice(0, 10) : ''
  });
  const [socialLinks, setSocialLinks] = useState({ ...(profile.socialLinks || {}) });
  const [musicState, setMusicState] = useState({
    musicUrl: profile.musicUrl || null,
    musicTitle: profile.musicTitle || null,
    musicStartSec: profile.musicStartSec || 0,
    musicEndSec: profile.musicEndSec || null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleChange(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSocialChange(key, value) {
    setSocialLinks((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, socialLinks })
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.message || t("Erreur lors de la mise a jour"));
        return;
      }

      onSaved({ ...data.user, ...musicState });
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
        className="nx-pop rounded-b-none sm:rounded-b-xl3 w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-surface">
          <h3 className="font-display text-lg font-semibold text-slate-900">{t("Modifier le profil")}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((field) => (
              <div key={field.name}>
                <label className="text-xs font-medium text-slate-500 mb-1 block">{field.label}</label>
                <input
                  type="text"
                  value={form[field.name]}
                  onChange={(event) => handleChange(field.name, event.target.value)}
                  className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Telephone")}</label>
            <input
              type="text"
              value={form.phone}
              onChange={(event) => handleChange('phone', event.target.value)}
              className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Sexe")}</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'male', label: t("Homme") },
                  { value: 'female', label: t("Femme") }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleChange('gender', option.value)}
                    className={`rounded-xl2 border px-3 py-2 text-xs font-medium transition-all ${
                      form.gender === option.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Date de naissance")}</label>
              <input
                type="date"
                value={form.birthDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => handleChange('birthDate', event.target.value)}
                className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">{t("Bio")}</label>
            <textarea
              value={form.bio}
              onChange={(event) => handleChange('bio', event.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition-all focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 resize-none"
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="text-xs font-medium text-slate-500 mb-2 block">{t("Reseaux sociaux")}</label>
            <div className="space-y-2">
              {SOCIAL_LINKS.map((social) => (
                <div key={social.key} className="flex items-center gap-2">
                  <span
                    className="w-9 h-9 rounded-xl2 bg-slate-100 flex items-center justify-center shrink-0"
                    style={{ color: social.color }}
                  >
                    <social.icon size={16} />
                  </span>
                  <input
                    type="text"
                    value={socialLinks[social.key] || ''}
                    onChange={(event) => handleSocialChange(social.key, event.target.value)}
                    placeholder={social.placeholder}
                    className="w-full rounded-xl2 border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none transition-all focus:bg-surface focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <ProfileMusicEditor
              profile={musicState}
              onChanged={(next) => {
                setMusicState((prev) => ({ ...prev, ...next }));
                onProfilePatch && onProfilePatch(next);
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="nx-btn-primary w-full h-11"
          >
            {isSubmitting && <LoaderCircle size={16} className="animate-spin" />}{t("Enregistrer")}</button>
        </form>
      </motion.div>
    </motion.div>
  );
}
