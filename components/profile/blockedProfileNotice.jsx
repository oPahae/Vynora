import { useState } from 'react';
import { useRouter } from 'next/router';
import { ShieldOff, Shield, Loader2 } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
export default function BlockedProfileNotice({ profile, relation }) {
  const router = useRouter();
  const [isUnblocking, setIsUnblocking] = useState(false);

  async function handleUnblock() {
    setIsUnblocking(true);
    try {
      await fetch(`/api/block/${profile.id}`, { method: 'DELETE' });
      router.replace(router.asPath);
    } finally {
      setIsUnblocking(false);
    }
  }

  return (
    <div className="bg-surface rounded-xl2 shadow-soft p-16 text-center">
      <ShieldOff size={28} className="mx-auto text-slate-300 mb-3" />
      <p className="text-slate-500 text-sm">{t("Ce profil n'est pas disponible.")}</p>
      {relation.blockedByMe && (
        <button
          onClick={handleUnblock}
          disabled={isUnblocking}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-60"
        >
          {isUnblocking ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}{t("Debloquer cet utilisateur")}</button>
      )}
    </div>
  );
}
