'use client';

import { useEffect, useState } from 'react';
import { useDialogStore } from '@/stores/dialogStore';
import { Button } from './Button';
import { Modal } from './Modal';
import styles from './Form.module.scss';

/** Renders the app-wide confirm/prompt dialogs requested through `confirmDialog`/`promptDialog`. */
export function DialogHost() {
  const dialog = useDialogStore((s) => s.dialog);
  const close = useDialogStore((s) => s.close);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (dialog?.kind === 'prompt') setValue(dialog.defaultValue ?? '');
  }, [dialog]);

  if (!dialog) return null;

  if (dialog.kind === 'confirm') {
    return (
      <Modal
        open
        onClose={close}
        title={dialog.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button variant={dialog.danger ? 'danger' : 'primary'} onClick={() => dialog.resolve(true)} data-autofocus>
              {dialog.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        {dialog.message && <p className={styles.message}>{dialog.message}</p>}
      </Modal>
    );
  }

  const submit = () => {
    if (value.trim()) dialog.resolve(value.trim());
  };
  return (
    <Modal
      open
      onClose={close}
      title={dialog.title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} disabled={!value.trim()}>
            {dialog.confirmLabel ?? 'Salvar'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className={styles.field}>
          {dialog.label && <span className={styles.label}>{dialog.label}</span>}
          <input
            className={styles.input}
            value={value}
            placeholder={dialog.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            data-autofocus
          />
        </label>
      </form>
    </Modal>
  );
}
