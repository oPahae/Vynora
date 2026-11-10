import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, RotateCw, UploadCloud, X, AlertTriangle } from 'lucide-react';
import { useUploadQueue } from '@/lib/uploadQueue';

import { t } from '@/lib/i18n/runtime';
// Indicateur permanent des publications en cours d'envoi (reste visible apres
// un rechargement de page, tant que la tache n'est pas terminee).
export default function UploadQueueBanner() {
  const { jobs, cancelJob, retryJob } = useUploadQueue();
  if (jobs.length === 0) return null;

  return (
    <div className="fixed z-[80] end-3 bottom-24 md:bottom-5 w-[min(92vw,22rem)] space-y-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {jobs.map((job) => {
          const isError = job.status === 'error';
          const isDone = job.status === 'done';
          const label = isDone
            ? t("Publication envoyee")
            : isError
              ? t("Echec de l'envoi")
              : job.status === 'finalizing'
                ? t("Finalisation...")
                : job.status === 'cancelling'
                  ? t("Annulation...")
                  : job.otherTab
                    ? t("Envoi en cours dans un autre onglet...")
                    : t("Publication en cours d'envoi...");

          return (
            <motion.div
              key={job.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              className="pointer-events-auto nx-card p-3 shadow-card"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0 w-11 h-11 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center text-brand-600">
                  {job.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.preview} alt="" className="w-full h-full object-cover" />
                  ) : isDone ? (
                    <CheckCircle2 size={22} className="text-emerald-500" />
                  ) : isError ? (
                    <AlertTriangle size={22} className="text-red-500" />
                  ) : (
                    <UploadCloud size={22} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{label}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {isError
                      ? job.error
                      : t("{count} fichier(s)", { count: job.fileCount })}
                  </p>
                </div>
                {!isDone && !isError && <Loader2 size={16} className="animate-spin text-brand-500 shrink-0" />}
                {isError && (
                  <button
                    type="button"
                    onClick={() => retryJob(job.id)}
                    aria-label={t("Reessayer")}
                    title={t("Reessayer")}
                    className="shrink-0 p-1.5 rounded-full text-slate-500 hover:bg-slate-100"
                  >
                    <RotateCw size={16} />
                  </button>
                )}
                {!isDone && (
                  <button
                    type="button"
                    onClick={() => cancelJob(job.id)}
                    aria-label={t("Annuler l'envoi")}
                    title={t("Annuler l'envoi")}
                    className="shrink-0 p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {!isError && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-200"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums font-medium text-brand-600">{job.progress}%</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
