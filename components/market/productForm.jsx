import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, ImagePlus, Trash2, Store } from 'lucide-react';
import { getCategories, getConditions, CURRENCIES } from '@/lib/marketMeta';

import { t, td } from '@/lib/i18n/runtime';
const MAX_PHOTOS = 8;
const INPUT = 'w-full text-sm rounded-xl2 border border-slate-200 bg-transparent px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-200';
const LABEL = 'block text-xs font-medium text-slate-500 mb-1.5';

// Creation / modification d'une annonce. `product` fourni = modification.
export default function ProductForm({ product, onClose, onSaved }) {
  const editing = Boolean(product);
  const [title, setTitle] = useState(product?.title || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [currency, setCurrency] = useState(product?.currency || 'MAD');
  const [category, setCategory] = useState(product?.category || 'other');
  const [condition, setCondition] = useState(product?.condition || 'good');
  const [city, setCity] = useState(product?.city || '');
  const [phone, setPhone] = useState(product?.contact?.phone || '');
  const [whatsapp, setWhatsapp] = useState(product?.contact?.whatsapp || '');
  const [allowMessages, setAllowMessages] = useState(product ? product.allowMessages : true);
  const [existing, setExisting] = useState(product?.media || []);
  const [removed, setRemoved] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const photoCount = existing.length + newFiles.length;

  function addFiles(event) {
    const picked = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    event.target.value = '';
    const room = MAX_PHOTOS - photoCount;
    setNewFiles((prev) => [...prev, ...picked.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (title.trim().length < 3) return setError(t("Le titre doit contenir au moins 3 caracteres"));
    if (price === '' || Number.isNaN(Number(price.replace(',', '.')))) return setError(t("Indiquez un prix (0 pour un article gratuit)"));
    if (photoCount === 0) return setError(t("Ajoutez au moins une photo"));
    if (!phone.trim() && !whatsapp.trim() && !allowMessages) {
      return setError(t("Indiquez au moins un moyen de contact (telephone, WhatsApp ou messages)"));
    }

    setIsSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('price', price.replace(',', '.'));
      formData.append('currency', currency);
      formData.append('category', category);
      formData.append('condition', condition);
      formData.append('city', city.trim());
      formData.append('phone', phone.trim());
      formData.append('whatsapp', whatsapp.trim());
      formData.append('allowMessages', allowMessages ? 'true' : 'false');
      if (editing) formData.append('removeMediaIds', JSON.stringify(removed));
      newFiles.forEach((item) => formData.append('media', item.file));

      const response = await fetch(editing ? `/api/market/${product.id}` : '/api/market', {
        method: editing ? 'PUT' : 'POST',
        body: formData
      });
      const data = await response.json();
      if (!data.success) {
        setError(td(data.message) || t("Erreur lors de l'enregistrement"));
        return undefined;
      }
      onSaved(data.product);
    } catch (err) {
      setError(t("Impossible de contacter le serveur"));
    } finally {
      setIsSubmitting(false);
    }
    return undefined;
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
        className="nx-pop rounded-b-none sm:rounded-b-xl3 w-full max-w-xl max-h-[92vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-surface z-10">
          <h3 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Store size={18} className="text-brand-500" /> {editing ? t("Modifier l'annonce") : t("Vendre un article")}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label={t("Fermer")}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl2 px-4 py-3">{error}</div>}

          <div>
            <label className={LABEL}>{t("Photos")} ({photoCount}/{MAX_PHOTOS})</label>
            <div className="grid grid-cols-4 gap-2">
              {existing.map((media) => (
                <div key={media.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={media.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setExisting((prev) => prev.filter((m) => m.id !== media.id));
                      setRemoved((prev) => [...prev, media.id]);
                    }}
                    className="absolute top-1 end-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                    aria-label={t("Retirer")}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {newFiles.map((item, index) => (
                <div key={item.preview} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== index))}
                    className="absolute top-1 end-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                    aria-label={t("Retirer")}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {photoCount < MAX_PHOTOS && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-brand-600 hover:border-brand-400 cursor-pointer transition-colors">
                  <ImagePlus size={22} />
                  <span className="text-[11px]">{t("Ajouter")}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={addFiles} />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className={LABEL}>{t("Titre")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 150))} placeholder={t("Ex. iPhone 13 128 Go")} className={INPUT} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className={LABEL}>{t("Prix")}</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>{t("Devise")}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={INPUT}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL}>{t("Categorie")}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>
                {getCategories().map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>{t("Etat")}</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className={INPUT}>
                {getConditions().map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>{t("Description (facultatif)")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 5000))} rows={4} className={`${INPUT} resize-none`} />
          </div>

          <div>
            <label className={LABEL}>{t("Ville")}</label>
            <input value={city} onChange={(e) => setCity(e.target.value.slice(0, 100))} placeholder={t("Ex. Casablanca")} className={INPUT} />
          </div>

          <fieldset className="rounded-xl2 border border-slate-200 p-4 space-y-3">
            <legend className="px-1 text-xs font-medium text-slate-500">{t("Comment l'acheteur peut vous contacter")}</legend>
            <p className="text-xs text-slate-500">{t("L'achat se fait en dehors de l'application, directement entre vous et l'acheteur.")}</p>
            <div>
              <label className={LABEL}>{t("Telephone")}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+212 6 12 34 56 78" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>WhatsApp</label>
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="+212 6 12 34 56 78" className={INPUT} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={allowMessages} onChange={(e) => setAllowMessages(e.target.checked)} className="w-4 h-4 accent-brand-500" />
              {t("Autoriser les messages dans l'application")}
            </label>
          </fieldset>

          <button type="submit" disabled={isSubmitting} className="nx-btn-primary w-full h-11">
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {editing ? t("Enregistrer") : t("Publier l'annonce")}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
