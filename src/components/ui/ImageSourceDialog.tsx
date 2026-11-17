'use client';

import { Camera, ImageUp, Link2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { normalizeImageUrl } from '@/lib/utils/imageUrl';
import { Button } from './Button';
import { Modal } from './Modal';
import formStyles from './Form.module.scss';
import styles from './ImageSourceDialog.module.scss';

export type ImageChoice = { kind: 'file'; file: File } | { kind: 'url'; url: string };

/** Pick an image: take a photo, choose one from the device, or paste a link (with preview). */
export function ImageSourceDialog({
  open,
  title = 'Adicionar imagem',
  onClose,
  onPick,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  onPick: (choice: ImageChoice) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [preview, setPreview] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const url = normalizeImageUrl(link);

  useEffect(() => {
    if (!open) {
      setLink('');
      setPreview('idle');
    }
  }, [open]);

  useEffect(() => setPreview(url ? 'loading' : 'idle'), [url]);

  const submitLink = () => {
    if (url) onPick({ kind: 'url', url });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!url} onClick={submitLink}>
            Usar este link
          </Button>
        </>
      }
    >
      <div className={styles.sources}>
        <Button variant="soft" block icon={<Camera size={16} />} onClick={() => cameraRef.current?.click()}>
          Tirar foto
        </Button>
        <Button variant="soft" block icon={<ImageUp size={16} />} onClick={() => fileRef.current?.click()}>
          Escolher da galeria
        </Button>
      </div>
      {[fileRef, cameraRef].map((ref) => (
        <input
          key={ref === fileRef ? 'file' : 'camera'}
          ref={ref}
          type="file"
          accept="image/*"
          capture={ref === cameraRef ? 'environment' : undefined}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onPick({ kind: 'file', file });
          }}
        />
      ))}

      <div className={styles.or}>
        <span>ou por link</span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitLink();
        }}
      >
        <label className={formStyles.field}>
          <span className={styles.inputRow}>
            <Link2 size={16} />
            <input
              className={formStyles.input}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              inputMode="url"
              aria-label="Link da imagem"
              data-autofocus
            />
          </span>
        </label>
      </form>
      <p className={styles.hint}>
        Use o link direto de uma imagem. Links compartilhados do Google Drive (com acesso “qualquer pessoa com o link”) e do
        Dropbox são convertidos automaticamente.
      </p>

      {url && (
        <div className={styles.preview}>
          {/* Hidden until loaded so a broken link does not show the browser's broken-image icon. */}
          <img
            src={url}
            alt="Pré-visualização"
            onLoad={() => setPreview('ok')}
            onError={() => setPreview('error')}
            style={preview === 'ok' ? undefined : { display: 'none' }}
          />
          {preview === 'loading' && <span>Carregando pré-visualização…</span>}
          {preview === 'error' && (
            <span className={styles.error}>
              Não foi possível carregar esta imagem. Verifique se o link é público e aponta para uma imagem.
            </span>
          )}
        </div>
      )}
      {link.trim() && !url && <p className={styles.error}>Isso não parece um link válido (deve começar com https://).</p>}
    </Modal>
  );
}
