import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
}

type Dialog =
  | ({ kind: 'confirm'; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: 'prompt'; resolve: (value: string | null) => void } & PromptOptions);

interface DialogState {
  dialog: Dialog | null;
  close: () => void;
}

export const useDialogStore = create<DialogState>()((set, get) => ({
  dialog: null,
  close: () => {
    const d = get().dialog;
    if (d?.kind === 'confirm') d.resolve(false);
    if (d?.kind === 'prompt') d.resolve(null);
    set({ dialog: null });
  },
}));

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.setState({
      dialog: {
        kind: 'confirm',
        ...options,
        resolve: (ok) => {
          useDialogStore.setState({ dialog: null });
          resolve(ok);
        },
      },
    });
  });
}

export function promptDialog(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.setState({
      dialog: {
        kind: 'prompt',
        ...options,
        resolve: (value) => {
          useDialogStore.setState({ dialog: null });
          resolve(value);
        },
      },
    });
  });
}
