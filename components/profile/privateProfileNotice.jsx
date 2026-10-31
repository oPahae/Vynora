import { Lock } from 'lucide-react';

import { t } from '@/lib/i18n/runtime';
const STATUS_TEXT = {
  get requestSent() { return t("Votre demande d'ami est en attente."); },
  get requestReceived() { return t("Acceptez sa demande d'ami pour voir son contenu."); },
  get none() { return t("Ajoutez cette personne pour voir ses publications, ses photos et ses amis."); }
};

export default function PrivateProfileNotice({ firstName, relationStatus }) {
  const helper = STATUS_TEXT[relationStatus] || STATUS_TEXT.none;

  return (
    <div className="nx-card p-12 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <Lock size={22} className="text-slate-400" />
      </div>
      <h2 className="font-display text-lg font-semibold text-slate-900">{t("Ce compte est prive")}</h2>
      <p className="text-sm text-slate-500 mt-1.5 max-w-sm mx-auto">{t("{firstName} protege ses publications. {helper}", { firstName, helper })}</p>
    </div>
  );
}
