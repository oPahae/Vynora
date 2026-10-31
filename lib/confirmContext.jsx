import { createContext, useCallback, useContext, useRef, useState } from 'react';

import { t } from '@/lib/i18n/runtime';
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest({
        title: options.title || t("Confirmer"),
        message: options.message || '',
        confirmLabel: options.confirmLabel || t("Confirmer"),
        cancelLabel: options.cancelLabel || t("Annuler"),
        danger: options.danger !== false
      });
    });
  }, []);

  function settle(result) {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setRequest(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm, request, onConfirm: () => settle(true), onCancel: () => settle(false) }}>
      {children}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error(t("useConfirm doit etre utilise a l'interieur de ConfirmProvider"));
  }
  return context.confirm;
}

export function useConfirmState() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error(t("useConfirmState doit etre utilise a l'interieur de ConfirmProvider"));
  }
  return context;
}
