import { useState } from 'react';
import { useRouter } from 'next/router';
import { Phone, MessageCircle, MessageSquare, Loader2 } from 'lucide-react';
import { useToast } from '@/lib/toastContext';

import { t, td } from '@/lib/i18n/runtime';
// Contact du vendeur : l'achat se fait en dehors de l'application (telephone,
// WhatsApp) ou via la messagerie de l'application.
export default function ContactButtons({ product }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [opening, setOpening] = useState(false);
  const contact = product.contact || {};
  const message = t("Bonjour, votre annonce \"{title}\" est-elle toujours disponible ?", { title: product.title });

  async function openMessages() {
    setOpening(true);
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: product.sellerId, productId: product.id })
      });
      const data = await response.json();
      if (!data.success) {
        showToast({ title: t("Messages"), message: td(data.message) || t("Une erreur est survenue"), type: 'error', playSound: false });
        return;
      }
      router.push(`/messages/${data.conversation.id}`);
    } catch (err) {
      showToast({ title: t("Messages"), message: t("Impossible de contacter le serveur"), type: 'error', playSound: false });
    } finally {
      setOpening(false);
    }
  }

  const hasAny = contact.phone || contact.whatsapp || product.allowMessages;
  if (!hasAny) return null;

  return (
    <div className="space-y-2">
      {contact.whatsapp && contact.whatsappUrl && (
        <a
          href={`${contact.whatsappUrl}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-11 rounded-full bg-[#25D366] text-white font-medium text-sm flex items-center justify-center gap-2 hover:brightness-95 transition"
        >
          <MessageCircle size={18} /> {t("Contacter sur WhatsApp")}
        </a>
      )}
      {contact.phone && (
        <a
          href={`tel:${contact.phone}`}
          className="w-full h-11 rounded-full border border-slate-200 text-slate-800 font-medium text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition"
        >
          <Phone size={18} /> {t("Appeler")} <span className="text-slate-500 font-normal">{contact.phone}</span>
        </a>
      )}
      {product.allowMessages && (
        <button type="button" onClick={openMessages} disabled={opening} className="nx-btn-primary w-full h-11">
          {opening ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={18} />} {t("Envoyer un message")}
        </button>
      )}
    </div>
  );
}
