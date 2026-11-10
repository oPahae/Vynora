import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useToast } from '@/lib/toastContext';

import { t } from '@/lib/i18n/runtime';
// =====================================================================
// File d'envoi de publications en arriere-plan.
// =====================================================================
// - Les fichiers sont envoyes par morceaux (voir pages/api/uploads) ;
// - la tache (texte + fichiers) est conservee dans IndexedDB : si la page
//   est rechargee ou fermee, l'envoi REPREND automatiquement au prochain
//   chargement (le serveur sait quels morceaux il a deja recus) ;
// - le fournisseur est dans _app.jsx : l'envoi continue pendant qu'on
//   navigue dans l'application, et la banniere (UploadQueueBanner)
//   indique en permanence ce qui est en cours.
// =====================================================================

const UploadQueueContext = createContext(null);

const CHUNK_SIZE = 2 * 1024 * 1024;
const DB_NAME = 'vynora-uploads';
const STORE = 'jobs';
const DONE_DISPLAY_MS = 4000;
const MAX_SERVER_RETRIES = 6;

// ---------------------------------------------------------------------
// IndexedDB (silencieusement desactive si indisponible, ex: navigation privee)
// ---------------------------------------------------------------------
function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB indisponible'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbRun(mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const request = work(store);
    tx.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

const idbPut = (job) => idbRun('readwrite', (store) => store.put(job));
const idbDelete = (id) => idbRun('readwrite', (store) => store.delete(id));
const idbGetAll = () => idbRun('readonly', (store) => store.getAll());

// ---------------------------------------------------------------------
// Reseau
// ---------------------------------------------------------------------
class FatalUploadError extends Error {}

function waitOnline() {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) return Promise.resolve();
  return new Promise((resolve) => {
    const handler = () => {
      window.removeEventListener('online', handler);
      resolve();
    };
    window.addEventListener('online', handler);
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Requete avec reprises : reseau coupe -> on attend le retour de la connexion ;
// erreur serveur 5xx -> quelques reprises ; erreur 4xx -> echec definitif.
async function requestWithRetry(send) {
  let attempt = 0;
  for (;;) {
    await waitOnline();
    try {
      const { status, data } = await send();
      if (status >= 200 && status < 300 && data && data.success !== false) return data;
      if (status === 401) throw new FatalUploadError(t("Session expiree : reconnectez-vous pour reprendre l'envoi."));
      if (status >= 400 && status < 500 && status !== 408 && status !== 429 && status !== 409) {
        throw new FatalUploadError((data && data.message) || t("Erreur lors de la publication"));
      }
      if (status === 409) throw Object.assign(new Error('conflict'), { data });
      attempt += 1;
      if (attempt > MAX_SERVER_RETRIES) throw new FatalUploadError((data && data.message) || t("Erreur lors de la publication"));
    } catch (error) {
      if (error instanceof FatalUploadError || error.message === 'conflict') throw error;
      // erreur reseau : on retente (en attendant le retour en ligne si besoin)
      attempt += 1;
      if (attempt > MAX_SERVER_RETRIES * 3) throw new FatalUploadError(t("Impossible de contacter le serveur"));
    }
    await sleep(Math.min(15000, 1000 * 2 ** Math.min(attempt, 4)));
  }
}

function sendJson(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(async (response) => {
    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }
    return { status: response.status, data };
  });
}

function sendChunk(url, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (error) {
        data = null;
      }
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => reject(new Error('network'));
    xhr.onabort = () => reject(new Error('abort'));
    xhr.send(blob);
  });
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------
// Fournisseur
// ---------------------------------------------------------------------
export function UploadQueueProvider({ children }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState([]);
  const jobsRef = useRef(new Map()); // id -> job (source de verite, incl. Blobs)
  const runningRef = useRef(new Set());
  const cancelledRef = useRef(new Set());
  const listenersRef = useRef(new Set());
  const persistedRef = useRef(true);
  const userIdRef = useRef(null);

  userIdRef.current = user ? user.id : null;

  const publish = useCallback(() => {
    // La vue ne contient pas les Blobs.
    setJobs(
      [...jobsRef.current.values()].map((job) => ({
        id: job.id,
        groupId: job.groupId || null,
        status: job.status,
        progress: job.progress || 0,
        error: job.error || '',
        preview: job.preview || '',
        fileCount: job.files.length,
        hasText: Boolean(job.fields && job.fields.content),
        otherTab: Boolean(job.otherTab)
      }))
    );
  }, []);

  const update = useCallback(
    (job, patch, { persist = false } = {}) => {
      Object.assign(job, patch);
      jobsRef.current.set(job.id, job);
      publish();
      if (persist && persistedRef.current) {
        idbPut(job).catch(() => {
          persistedRef.current = false;
        });
      }
    },
    [publish]
  );

  const remove = useCallback(
    (id) => {
      jobsRef.current.delete(id);
      publish();
      idbDelete(id).catch(() => {});
    },
    [publish]
  );

  const emit = useCallback((event) => {
    listenersRef.current.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error(error);
      }
    });
  }, []);

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  // Envoie un fichier par morceaux (reprenable) ; renvoie l'id du media.
  const uploadFile = useCallback(
    async (job, fileIndex, totalBytes, doneBytesRef) => {
      const entry = job.files[fileIndex];
      if (entry.mediaId) {
        doneBytesRef.value += entry.size;
        return entry.mediaId;
      }

      const init = await requestWithRetry(() =>
        sendJson('/api/uploads', {
          clientKey: `${job.id}:${fileIndex}`,
          filename: entry.name,
          mimetype: entry.type,
          size: entry.size,
          chunkSize: CHUNK_SIZE
        })
      );
      if (init.mediaId) {
        entry.mediaId = init.mediaId;
        doneBytesRef.value += entry.size;
        return init.mediaId;
      }

      const received = new Set(init.received || []);
      const chunkSize = init.chunkSize || CHUNK_SIZE;
      for (let index = 0; index < init.totalChunks; index += 1) {
        if (cancelledRef.current.has(job.id)) throw new FatalUploadError('cancelled');
        const start = index * chunkSize;
        const blob = entry.blob.slice(start, Math.min(start + chunkSize, entry.size));
        if (received.has(index)) {
          doneBytesRef.value += blob.size;
          // eslint-disable-next-line no-continue
          continue;
        }
        const base = doneBytesRef.value;
        // eslint-disable-next-line no-await-in-loop
        await requestWithRetry(() =>
          sendChunk(`/api/uploads/${init.sessionId}/chunk?index=${index}`, blob, (loaded) => {
            const pct = Math.min(95, Math.round(((base + loaded) / totalBytes) * 95));
            if (pct !== job.progress) update(job, { progress: pct });
          })
        );
        doneBytesRef.value += blob.size;
        update(job, { progress: Math.min(95, Math.round((doneBytesRef.value / totalBytes) * 95)) });
      }

      const complete = await requestWithRetry(() => sendJson(`/api/uploads/${init.sessionId}/complete`, {}));
      entry.mediaId = complete.mediaId;
      update(job, {}, { persist: true });
      return complete.mediaId;
    },
    [update]
  );

  const runJob = useCallback(
    async (job) => {
      if (runningRef.current.has(job.id)) return;

      const execute = async () => {
        runningRef.current.add(job.id);
        update(job, { status: 'uploading', error: '', otherTab: false });
        try {
          const totalBytes = Math.max(1, job.files.reduce((sum, file) => sum + file.size, 0));
          const doneBytesRef = { value: 0 };
          const mediaIds = [];
          for (let i = 0; i < job.files.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            mediaIds.push(await uploadFile(job, i, totalBytes, doneBytesRef));
          }

          update(job, { status: 'finalizing', progress: 97 });
          const created = await requestWithRetry(() =>
            sendJson(job.endpoint, { ...job.fields, mediaIds, clientKey: job.id })
          );

          update(job, { status: 'done', progress: 100 });
          emit({ type: 'done', job: { id: job.id, groupId: job.groupId || null }, post: created.post });
          showToast({ title: t("Publication envoyee"), message: t("Votre publication est en ligne."), type: 'success' });
          idbDelete(job.id).catch(() => {});
          setTimeout(() => remove(job.id), DONE_DISPLAY_MS);
        } catch (error) {
          if (cancelledRef.current.has(job.id)) {
            cancelledRef.current.delete(job.id);
            remove(job.id);
          } else {
            update(job, { status: 'error', error: error.message || t("Erreur lors de la publication") }, { persist: true });
          }
        } finally {
          runningRef.current.delete(job.id);
        }
      };

      // Un seul onglet a la fois execute une tache (Web Locks quand disponible).
      if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
        let acquired = false;
        await navigator.locks.request(`vynora-upload-${job.id}`, { ifAvailable: true }, async (lock) => {
          if (!lock) return;
          acquired = true;
          await execute();
        });
        if (!acquired) update(job, { status: 'uploading', otherTab: true });
      } else {
        await execute();
      }
    },
    [emit, remove, showToast, update, uploadFile]
  );

  // Ajoute une publication a envoyer. `files` : tableau de File.
  const enqueuePost = useCallback(
    ({ endpoint, fields, files, groupId = null }) => {
      const uid = userIdRef.current;
      if (!uid) return null;
      const firstImage = files.find((file) => file.type.startsWith('image/'));
      const job = {
        id: makeId(),
        userId: uid,
        endpoint,
        fields,
        groupId,
        status: 'queued',
        progress: 0,
        error: '',
        createdAt: Date.now(),
        preview: firstImage && typeof URL !== 'undefined' ? URL.createObjectURL(firstImage) : '',
        files: files.map((file) => ({ name: file.name, type: file.type, size: file.size, blob: file, mediaId: null }))
      };
      jobsRef.current.set(job.id, job);
      publish();
      if (persistedRef.current) {
        // `preview` (URL d'objet) n'a pas de sens apres rechargement.
        idbPut({ ...job, preview: '' }).catch(() => {
          persistedRef.current = false;
        });
      }
      runJob(job);
      return job.id;
    },
    [publish, runJob]
  );

  const cancelJob = useCallback(
    (id) => {
      const job = jobsRef.current.get(id);
      if (!job) return;
      if (runningRef.current.has(id)) {
        cancelledRef.current.add(id);
        update(job, { status: 'cancelling' });
      } else {
        remove(id);
      }
    },
    [remove, update]
  );

  const retryJob = useCallback(
    (id) => {
      const job = jobsRef.current.get(id);
      if (job && !runningRef.current.has(id)) runJob(job);
    },
    [runJob]
  );

  // Reprise apres rechargement : on relit les taches non terminees.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    idbGetAll()
      .then((stored) => {
        if (cancelled || !stored) return;
        stored
          .filter((job) => job.userId === user.id && !jobsRef.current.has(job.id))
          .sort((a, b) => a.createdAt - b.createdAt)
          .forEach((job) => {
            jobsRef.current.set(job.id, { ...job, status: 'queued', error: '' });
            publish();
            runJob(jobsRef.current.get(job.id));
          });
      })
      .catch(() => {
        persistedRef.current = false;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user && user.id]);

  // Tache geree par un autre onglet : on rafraichit sa presence toutes les 5 s.
  useEffect(() => {
    const timer = setInterval(() => {
      const others = [...jobsRef.current.values()].filter((job) => job.otherTab);
      if (others.length === 0) return;
      idbGetAll()
        .then((stored) => {
          const ids = new Set((stored || []).map((job) => job.id));
          others.forEach((job) => {
            if (!ids.has(job.id)) remove(job.id);
            else if (!runningRef.current.has(job.id)) runJob(job); // l'autre onglet est ferme : on reprend
          });
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [remove, runJob]);

  // Si la persistance est impossible, on previent avant de quitter la page.
  useEffect(() => {
    function onBeforeUnload(event) {
      const active = [...jobsRef.current.values()].some((job) => job.status === 'uploading' || job.status === 'queued');
      if (active && !persistedRef.current) {
        event.preventDefault();
        // eslint-disable-next-line no-param-reassign
        event.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const value = { jobs, enqueuePost, cancelJob, retryJob, subscribe };
  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>;
}

export function useUploadQueue() {
  const context = useContext(UploadQueueContext);
  if (!context) throw new Error('useUploadQueue doit etre utilise dans UploadQueueProvider');
  return context;
}
