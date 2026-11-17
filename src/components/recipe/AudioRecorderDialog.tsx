'use client';

import { Mic, RotateCcw, Square, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatDuration, MAX_RECORDING_SECONDS, useAudioRecorder } from '@/features/audio/useAudioRecorder';
import { useStatusStore } from '@/stores/statusStore';
import styles from './AudioRecorderDialog.module.scss';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const BARS = 24;

export interface AudioResult {
  blob: Blob;
  duration: number;
  fileName?: string;
}

/** Records a short audio (or takes an audio file) and hands it back to be inserted in the recipe. */
export function AudioRecorderDialog({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (result: AudioResult) => void;
}) {
  return open ? <RecorderBody onClose={onClose} onInsert={onInsert} /> : null;
}

function RecorderBody({ onClose, onInsert }: { onClose: () => void; onInsert: (result: AudioResult) => void }) {
  const rec = useAudioRecorder();
  const fileRef = useRef<HTMLInputElement>(null);
  const fileNameRef = useRef<string | undefined>(undefined);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));

  // Rolling history of the input level, drawn as bars.
  useEffect(() => {
    if (rec.state === 'recording') setLevels((prev) => [...prev.slice(1), rec.level]);
    else if (rec.state === 'idle') setLevels(Array(BARS).fill(0));
  }, [rec.level, rec.state]);

  const close = () => {
    rec.reset();
    onClose();
  };

  const recording = rec.recording;
  const remaining = MAX_RECORDING_SECONDS - rec.elapsed;

  const footer =
    rec.state === 'recorded' && recording ? (
      <>
        <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={rec.reset}>
          Regravar
        </Button>
        <Button
          variant="primary"
          onClick={() => onInsert({ blob: recording.blob, duration: recording.duration, fileName: fileNameRef.current })}
        >
          Inserir na receita
        </Button>
      </>
    ) : undefined;

  return (
    <Modal open onClose={close} title="Gravar áudio" size="sm" footer={footer}>
      <div className={styles.body}>
        {(rec.state === 'idle' || rec.state === 'requesting') && (
          <>
            <button
              className={styles.recordButton}
              onClick={() => void rec.start()}
              disabled={rec.state === 'requesting'}
              aria-label="Começar a gravar"
              data-autofocus
            >
              <Mic size={34} />
            </button>
            <p className={styles.status}>
              {rec.state === 'requesting' ? 'Aguardando permissão do microfone…' : 'Toque para começar a gravar'}
            </p>
            <p className={styles.hint}>
              Explique um passo, o ponto da massa ou aquele segredo da família. Até {MAX_RECORDING_SECONDS / 60} minutos
              por áudio.
            </p>
          </>
        )}

        {rec.state === 'recording' && (
          <>
            <div className={styles.meter} aria-hidden>
              {levels.map((l, i) => (
                <span key={i} style={{ height: `${8 + l * 92}%` }} />
              ))}
            </div>
            <p className={styles.timer}>
              <span className={styles.dot} /> {formatDuration(rec.elapsed)}
            </p>
            <button className={styles.stopButton} onClick={rec.stop} aria-label="Parar gravação" data-autofocus>
              <Square size={26} fill="currentColor" />
            </button>
            <p className={styles.hint}>
              {remaining < 60 ? `A gravação para sozinha em ${Math.ceil(remaining)} s.` : 'Toque no quadrado para parar.'}
            </p>
          </>
        )}

        {rec.state === 'recorded' && recording && (
          <>
            <audio className={styles.preview} src={recording.url} controls />
            <p className={styles.status}>
              {fileNameRef.current ?? 'Áudio'} · {formatDuration(recording.duration)}
            </p>
            <p className={styles.hint}>Ouça antes de inserir. Se não gostou, regrave.</p>
          </>
        )}

        {rec.state === 'error' && (
          <>
            <p className={styles.error}>{rec.error}</p>
            <Button variant="soft" onClick={() => void rec.start()}>
              Tentar de novo
            </Button>
          </>
        )}

        {(rec.state === 'idle' || rec.state === 'error') && (
          <button className={styles.upload} onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> ou enviar um arquivo de áudio
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (file.size > MAX_UPLOAD_BYTES) {
              useStatusStore.getState().toast('Arquivo de áudio muito grande (máx. 15 MB).', 'error');
              return;
            }
            fileNameRef.current = file.name.replace(/\.[^.]+$/, '');
            void rec.loadFile(file);
          }}
        />
      </div>
    </Modal>
  );
}
