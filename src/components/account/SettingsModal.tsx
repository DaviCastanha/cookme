'use client';

import { Download, Info, Keyboard, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { downloadBlob, exportProject } from '@/features/projects/backup';
import { useStatusStore } from '@/stores/statusStore';
import { useAboutStore } from '@/stores/aboutStore';
import { APP_VERSION } from '@/content/releases';
import { AccountSection } from './AccountSection';
import styles from './SettingsModal.module.scss';

const SHORTCUTS: [string, string][] = [
  ['Ctrl/⌘ + K', 'Buscar receitas e ingredientes'],
  ['/', 'Inserir bloco (ingredientes, passos, foto, áudio…)'],
  ['Ctrl/⌘ + B / I', 'Negrito / itálico'],
  ['Ctrl/⌘ + \\', 'Mostrar/ocultar a lista de receitas'],
  ['F2', 'Renomear item na lista'],
  ['← →', 'Passo anterior / próximo no modo Cozinhar'],
  ['Esc', 'Sair do modo Cozinhar'],
];

export function SettingsModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId?: string }) {
  return (
    <Modal open={open} onClose={onClose} title="Configurações" size="md">
      <section className={styles.section}>
        <h3>Conta e armazenamento</h3>
        <AccountSection />
      </section>

      {projectId && (
        <section className={styles.section}>
          <h3>Backup do caderno</h3>
          <p className={styles.text}>
            Baixe uma cópia de todas as receitas deste caderno num único arquivo (fotos e áudios não vão junto; com o Google,
            eles já ficam guardados no seu Drive).
          </p>
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={15} />}
            onClick={async () => {
              try {
                const { filename, blob } = await exportProject(projectId);
                downloadBlob(filename, blob);
              } catch (error) {
                useStatusStore.getState().toast(error instanceof Error ? error.message : 'Falha ao exportar.', 'error');
              }
            }}
          >
            Exportar backup
          </Button>
        </section>
      )}

      <section className={styles.section}>
        <h3>
          <Keyboard size={15} /> Atalhos
        </h3>
        <dl className={styles.shortcuts}>
          {SHORTCUTS.map(([keys, label]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section}>
        <h3>CookMe {APP_VERSION}</h3>
        <div className={styles.row}>
          <Button
            variant="outline"
            size="sm"
            icon={<Info size={15} />}
            onClick={() => {
              onClose();
              useAboutStore.getState().showAbout();
            }}
          >
            Sobre e instalar app
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Sparkles size={15} />}
            onClick={() => {
              onClose();
              useAboutStore.getState().showNews();
            }}
          >
            Novidades
          </Button>
        </div>
      </section>
    </Modal>
  );
}
