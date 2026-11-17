'use client';

import { CircleAlert, Cloud, CloudOff, HardDrive, LoaderCircle, RefreshCw } from 'lucide-react';
import { useStatusStore } from '@/stores/statusStore';
import { formatRelativeDate } from '@/lib/utils/text';
import styles from './SaveIndicator.module.scss';

/** Local save + Drive sync state, e.g. "Salvo · Sincronizado com o Drive". */
export function SaveIndicator({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  const save = useStatusStore((s) => s.save);
  const saveError = useStatusStore((s) => s.saveError);
  const sync = useStatusStore((s) => s.sync);
  const syncMessage = useStatusStore((s) => s.syncMessage);
  const pendingSync = useStatusStore((s) => s.pendingSync);
  const lastSyncedAt = useStatusStore((s) => s.lastSyncedAt);

  let tone: 'ok' | 'busy' | 'warn' | 'error' = 'ok';
  let icon = <HardDrive size={14} />;
  let label = 'Salvo neste dispositivo';
  let detail: string | null = null;

  if (save === 'saving') {
    tone = 'busy';
    icon = <LoaderCircle size={14} className={styles.spin} />;
    label = 'Salvando…';
  } else if (save === 'error') {
    tone = 'error';
    icon = <CircleAlert size={14} />;
    label = 'Erro ao salvar';
    detail = saveError;
  } else if (sync === 'syncing') {
    tone = 'busy';
    icon = <RefreshCw size={14} className={styles.spin} />;
    label = 'Sincronizando…';
    detail = pendingSync ? `${pendingSync} pendente(s)` : null;
  } else if (sync === 'synced' || (sync === 'idle' && !pendingSync)) {
    icon = <Cloud size={14} />;
    label = 'Salvo no Drive';
    detail = lastSyncedAt ? `Sincronizado ${formatRelativeDate(new Date(lastSyncedAt).toISOString())}` : null;
  } else if (sync === 'idle' && pendingSync) {
    tone = 'busy';
    icon = <Cloud size={14} />;
    label = 'Aguardando sincronização';
  } else if (sync === 'offline') {
    tone = 'warn';
    icon = <CloudOff size={14} />;
    label = 'Offline — salvo localmente';
  } else if (sync === 'error') {
    tone = 'error';
    icon = <CloudOff size={14} />;
    label = 'Erro de sincronização';
    detail = syncMessage;
  } else if (save === 'saved') {
    label = 'Salvo neste dispositivo';
  }

  const title = [label, detail].filter(Boolean).join(' — ');
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag className={[styles.indicator, styles[tone], compact && styles.compact].filter(Boolean).join(' ')} title={title} onClick={onClick} aria-live="polite">
      {icon}
      {!compact && <span className={styles.label}>{label}</span>}
      {compact && <span className="visually-hidden">{title}</span>}
    </Tag>
  );
}
