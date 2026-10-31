import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import { Loader2, FileEdit, Image as ImageIcon, Send, Trash2, Pencil } from 'lucide-react';
import AppLayout from '@/components/layout/appLayout';
import PageHeader from '@/components/shared/pageHeader';
import DraftEditorModal from '@/components/drafts/draftEditorModal';
import { useConfirm } from '@/lib/confirmContext';
import { useToast } from '@/lib/toastContext';
import { formatRelativeTime } from '@/lib/dateUtils';
import { pageTitle } from '@/lib/constants';

import { t } from '@/lib/i18n/runtime';
const VISIBILITY_LABELS = {
  get public() { return t("Public"); },
  get friends() { return t("Amis"); },
  get private() { return t("Prive"); },
  get exceptFor() { return t("Sauf certaines personnes"); },
  get onlyFor() { return t("Personnes selectionnees"); }
};

export default function DraftsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingDraft, setEditingDraft] = useState(null);
  const [loadingDraftId, setLoadingDraftId] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/drafts?limit=50');
      const data = await response.json();
      setDrafts(data.success ? data.drafts : []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openEditor(draftId) {
    setLoadingDraftId(draftId);
    try {
      const response = await fetch(`/api/drafts/${draftId}`);
      const data = await response.json();
      if (data.success) setEditingDraft(data.draft);
    } finally {
      setLoadingDraftId(null);
    }
  }

  async function handleQuickDelete(draftId) {
    const confirmed = await confirm({
      title: t("Supprimer ce brouillon ?"),
      message: t("Cette action est definitive."),
      confirmLabel: t("Supprimer"),
      danger: true
    });
    if (!confirmed) return;
    await fetch(`/api/drafts/${draftId}`, { method: 'DELETE' });
    setDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
  }

  async function handleQuickPublish(draftId) {
    setLoadingDraftId(draftId);
    try {
      const response = await fetch(`/api/drafts/${draftId}/publish`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
        showToast({ title: t("Publication effectuee"), type: 'success' });
        router.push(`/post/${data.post.id}`);
      } else {
        showToast({ title: t("Erreur"), message: data.message, type: 'error' });
      }
    } finally {
      setLoadingDraftId(null);
    }
  }

  return (
    <>
      <Head>
        <title>{pageTitle(t("Mes brouillons"))}</title>
      </Head>
      <AppLayout>
        <div className="max-w-2xl mx-auto">
          <PageHeader icon={FileEdit} title={t("Mes brouillons")} />

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={22} className="animate-spin text-brand-400" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="nx-card p-12 text-center">
              <p className="text-sm text-slate-400">{t("Aucun brouillon. Commencez une publication et cliquez sur \"Brouillon\" pour la retrouver ici.")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="nx-card-interactive !rounded-xl2 p-4"
                >
                  <button onClick={() => openEditor(draft.id)} className="w-full text-start flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl2 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      {draft.mediaCount > 0 ? <ImageIcon size={17} /> : <FileEdit size={17} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800 truncate">
                        {draft.content || (draft.mediaCount > 0 ? t("Media sans texte") : t("Brouillon vide"))}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{t("Modifie {formatRelativeTime} · {v}", { formatRelativeTime: formatRelativeTime(draft.updatedAt), v: VISIBILITY_LABELS[draft.visibility] })}{draft.mediaCount > 0 ? t(" · {mediaCount} media", { mediaCount: draft.mediaCount }) : ''}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 mt-3 ps-[52px]">
                    <button
                      onClick={() => openEditor(draft.id)}
                      disabled={loadingDraftId === draft.id}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl2 transition-colors disabled:opacity-60"
                    >
                      <Pencil size={12} />{' '}{t("Modifier")}</button>
                    <button
                      onClick={() => handleQuickPublish(draft.id)}
                      disabled={loadingDraftId === draft.id}
                      className="flex items-center gap-1.5 text-xs font-medium text-white bg-brand-500 px-3 py-1.5 rounded-xl2 transition-colors disabled:opacity-60"
                    >
                      {loadingDraftId === draft.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}{t("Publier")}</button>
                    <button
                      onClick={() => handleQuickDelete(draft.id)}
                      disabled={loadingDraftId === draft.id}
                      className="flex items-center gap-1.5 text-xs font-medium text-ember-600 bg-ember-50 hover:bg-ember-100 px-3 py-1.5 rounded-xl2 transition-colors disabled:opacity-60"
                    >
                      <Trash2 size={12} />{' '}{t("Supprimer")}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <AnimatePresence>
          {editingDraft && (
            <DraftEditorModal
              draft={editingDraft}
              onClose={() => setEditingDraft(null)}
              onSaved={() => {
                setEditingDraft(null);
                load();
              }}
              onDeleted={(draftId) => {
                setEditingDraft(null);
                setDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
              }}
              onPublished={(post) => {
                setEditingDraft(null);
                setDrafts((prev) => prev.filter((draft) => draft.id !== editingDraft.id));
                showToast({ title: t("Publication effectuee"), type: 'success' });
                router.push(`/post/${post.id}`);
              }}
            />
          )}
        </AnimatePresence>
      </AppLayout>
    </>
  );
}
