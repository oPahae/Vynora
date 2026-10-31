import { t } from '@/lib/i18n/runtime';
// fetch() ne permet pas de suivre la progression de l'upload (seulement du
// telechargement de la reponse), on utilise donc XMLHttpRequest pour pouvoir
// afficher une barre de progression pendant l'envoi de gros fichiers.
export function uploadFormData(url, formData, { method = 'POST', onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (error) {
        reject(new Error(t("Reponse invalide du serveur")));
        return;
      }
      resolve({ status: xhr.status, data });
    };

    xhr.onerror = () => reject(new Error(t("Impossible de contacter le serveur")));
    xhr.onabort = () => reject(new Error(t("Envoi annule")));

    xhr.send(formData);
  });
}
