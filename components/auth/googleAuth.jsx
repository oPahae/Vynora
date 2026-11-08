import { useState } from 'react';
import GoogleButton from '@/components/auth/googleButton';
import { t, td } from '@/lib/i18n/runtime';

// Separateur "ou" + bouton Google. Envoie le jeton a /api/auth/google.
export default function GoogleAuth({ onAuthenticated, onError, divider = 'below' }) {
  const [busy, setBusy] = useState(false);

  async function handleCredential(credential) {
    setBusy(true);
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      });
      const data = await response.json();
      if (data.success) await onAuthenticated(data.user, data);
      else onError(data);
    } catch (error) {
      onError({ message: t("Impossible de contacter le serveur") });
    } finally {
      setBusy(false);
    }
  }

  const separator = (
    <div className="flex items-center gap-3 text-xs text-slate-400">
      <span className="flex-1 h-px bg-slate-200" />
      {t("ou")}
      <span className="flex-1 h-px bg-slate-200" />
    </div>
  );

  return (
    <div className="space-y-4">
      {divider === 'below' && separator}
      <GoogleButton onCredential={handleCredential} disabled={busy} />
      {divider === 'above' && separator}
    </div>
  );
}

export function googleErrorMessage(data) {
  if (data?.deleted || data?.banned) {
    const base = data.deleted
      ? data.reason
        ? t("Ce compte a ete supprime par l'administration. Motif : {reason}", { reason: data.reason })
        : t("Ce compte a ete supprime par l'administration.")
      : data.reason
      ? t("Ce compte a ete suspendu par l'administration. Motif : {reason}", { reason: data.reason })
      : t("Ce compte a ete suspendu par l'administration.");
    return base;
  }
  return td(data?.message) || t("Une erreur est survenue");
}
