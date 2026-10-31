import { t } from '@/lib/i18n/runtime';
export default function UploadProgressBar({ progress, label = t("Envoi en cours...") }) {
  if (progress === null || progress === undefined) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>{label}</span>
        <span className="tabular-nums font-medium text-brand-600">{progress}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
