'use client';

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useStatusStore } from '@/stores/statusStore';
import styles from './ToastHost.module.scss';

export function ToastHost() {
  const toasts = useStatusStore((s) => s.toasts);
  const dismiss = useStatusStore((s) => s.dismissToast);
  return (
    <div className={styles.host} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={[styles.toast, styles[t.tone]].join(' ')}>
          {t.tone === 'error' ? <CircleAlert size={17} /> : t.tone === 'success' ? <CircleCheck size={17} /> : <Info size={17} />}
          <span className={styles.message}>{t.message}</span>
          {t.action && (
            <button
              className={styles.action}
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className={styles.close} aria-label="Fechar aviso" onClick={() => dismiss(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
