'use client';

import { BookOpen, ChefHat, Download, Info, LoaderCircle, MoreHorizontal, Pencil, Plus, Settings, Sparkles, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SettingsModal } from '@/components/account/SettingsModal';
import { Splash } from '@/components/layout/Splash';
import { Button, IconButton } from '@/components/ui/Button';
import { useMenu } from '@/components/ui/Menu';
import { useAccount } from '@/features/auth/AuthGate';
import { useSessionStore } from '@/features/auth/sessionStore';
import { downloadBlob, exportProject, readBackup, restoreBackup } from '@/features/projects/backup';
import { createTutorialProject, useProjects, useProjectStats, useSeed } from '@/features/projects/hooks';
import { isTutorial } from '@/features/projects/kinds';
import * as repo from '@/lib/repository';
import type { Project } from '@/lib/schemas';
import { lastProject, workspaceHref } from '@/lib/utils/routes';
import { formatRelativeDate, pluralize } from '@/lib/utils/text';
import { APP_VERSION } from '@/content/releases';
import { useAboutStore } from '@/stores/aboutStore';
import { confirmDialog, promptDialog } from '@/stores/dialogStore';
import { trackSave, useStatusStore } from '@/stores/statusStore';
import styles from './ProjectsHome.module.scss';

export function ProjectsHome() {
  const { mode } = useAccount();
  const seeded = useSeed(mode === 'local');
  const projects = useProjects();
  const stats = useProjectStats();
  const router = useRouter();
  const params = useSearchParams();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const driveConnected = useSessionStore((st) => st.driveConnected);
  const firstSyncDone = useStatusStore((st) => st.firstSyncDone);
  // After login on a new device, cadernos arrive from Drive during the first sync.
  const loadingFromDrive = mode === 'google' && driveConnected && !firstSyncDone;

  // Opening the app goes straight to the last caderno used here ("Todos os cadernos" stays here).
  const wantsHome = params.has('inicio');
  const last = lastProject();
  const resume = !wantsHome && !!last && !!projects?.some((p) => p.id === last);
  useEffect(() => {
    if (resume && last) router.replace(workspaceHref(last));
  }, [resume, last, router]);

  if (!seeded || !projects || resume) return <Splash />;

  const openTutorial = async () => {
    const existing = projects.find(isTutorial);
    const project = existing ?? (await trackSave(createTutorialProject()));
    router.push(workspaceHref(project.id));
  };

  const create = async () => {
    const name = await promptDialog({
      title: 'Novo caderno',
      label: 'Nome do caderno',
      placeholder: 'Ex.: Minhas receitas, Receitas da vó',
      defaultValue: projects.some((p) => !isTutorial(p)) ? '' : 'Minhas receitas',
      confirmLabel: 'Criar',
    });
    if (!name) return;
    const project = await trackSave(repo.createProject(name));
    router.push(workspaceHref(project.id));
  };

  const onImport = async (file?: File) => {
    if (!file) return;
    try {
      const backup = await readBackup(file);
      if (projects.some((p) => p.id === backup.project.id)) {
        const ok = await confirmDialog({
          title: `Substituir “${backup.project.name}”?`,
          message: 'Este caderno já existe aqui. As receitas do backup substituirão as que têm a mesma identidade.',
          confirmLabel: 'Substituir',
          danger: true,
        });
        if (!ok) return;
      }
      const project = await restoreBackup(backup);
      useStatusStore.getState().toast(`“${project.name}” importado.`, 'success');
    } catch (error) {
      useStatusStore.getState().toast(error instanceof Error ? error.message : 'Falha ao importar.', 'error');
    }
  };

  const own = projects.filter((p) => !isTutorial(p));
  const tutorial = projects.find(isTutorial);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden>
            <ChefHat size={30} strokeWidth={1.8} />
          </span>
          <div>
            <h1>CookMe</h1>
            <p>Suas receitas, do seu jeito.</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <IconButton label="Sobre o CookMe" size="lg" onClick={() => useAboutStore.getState().showAbout()}>
            <Info size={20} />
          </IconButton>
          <IconButton label="Configurações" size="lg" onClick={() => setSettingsOpen(true)}>
            <Settings size={20} />
          </IconButton>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.toolbar}>
          <h2>Seus cadernos</h2>
          <div className={styles.toolbarActions}>
            {!tutorial && (
              <Button variant="ghost" size="sm" icon={<Sparkles size={15} />} onClick={() => void openTutorial()}>
                Caderno de exemplo
              </Button>
            )}
            <Button variant="ghost" size="sm" icon={<Upload size={15} />} onClick={() => importRef.current?.click()}>
              Importar backup
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => void create()}>
              Novo caderno
            </Button>
          </div>
        </div>

        <ul className={styles.grid}>
          {own.map((p) => (
            <ProjectCard key={p.id} project={p} recipes={stats?.get(p.id)?.recipes ?? 0} folders={stats?.get(p.id)?.folders ?? 0} />
          ))}
          {tutorial && (
            <ProjectCard project={tutorial} recipes={stats?.get(tutorial.id)?.recipes ?? 0} folders={stats?.get(tutorial.id)?.folders ?? 0} />
          )}
          <li>
            <button className={styles.newCard} onClick={() => void create()}>
              <Plus size={22} />
              <span>Novo caderno</span>
            </button>
          </li>
        </ul>

        {loadingFromDrive && (
          <p className={styles.notice}>
            <LoaderCircle size={16} className={styles.spin} /> Buscando seus cadernos no Google Drive…
          </p>
        )}

        {!own.length && !loadingFromDrive && (
          <section className={styles.empty}>
            <h3>Comece seu caderno de receitas</h3>
            <p>
              Crie um caderno e organize suas receitas em pastas, com foto, ingredientes e passo a passo. O caderno de exemplo
              mostra tudo funcionando.
            </p>
            <div className={styles.emptyActions}>
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => void create()}>
                Criar meu caderno
              </Button>
              <Button variant="soft" icon={<Sparkles size={16} />} onClick={() => void openTutorial()}>
                Ver o exemplo
              </Button>
            </div>
          </section>
        )}
      </main>

      <footer className={styles.legal}>
        <button className={styles.version} onClick={() => useAboutStore.getState().showAbout()}>
          CookMe {APP_VERSION}
        </button>
        <Link href="/privacidade">Política de Privacidade</Link>
        <Link href="/termos">Termos de Uso</Link>
      </footer>

      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          void onImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function ProjectCard({ project, recipes, folders }: { project: Project; recipes: number; folders: number }) {
  const menu = useMenu();
  const tutorial = isTutorial(project);
  return (
    <li className={styles.card}>
      <Link href={workspaceHref(project.id)} className={styles.cardLink}>
        <span className={tutorial ? styles.cardCoverTutorial : styles.cardCover} aria-hidden>
          {tutorial ? <Sparkles size={22} /> : <BookOpen size={22} />}
        </span>
        <span className={styles.cardName}>{project.name}</span>
        {project.description && <span className={styles.cardDesc}>{project.description}</span>}
        <span className={styles.cardMeta}>
          {pluralize(recipes, 'receita', 'receitas')} · {pluralize(folders, 'pasta', 'pastas')}
        </span>
        <span className={styles.cardDate}>Editado {formatRelativeDate(project.updatedAt)}</span>
      </Link>
      <IconButton
        label={`Opções de ${project.name}`}
        size="sm"
        className={styles.cardMenu}
        onClick={(e) =>
          menu.open(e.currentTarget, [
            {
              label: 'Renomear',
              icon: <Pencil />,
              onSelect: async () => {
                const name = await promptDialog({ title: 'Renomear caderno', defaultValue: project.name });
                if (name) await trackSave(repo.renameProject(project.id, name));
              },
            },
            {
              label: 'Exportar backup',
              icon: <Download />,
              onSelect: async () => {
                const { filename, blob } = await exportProject(project.id);
                downloadBlob(filename, blob);
              },
            },
            { kind: 'separator' },
            {
              label: 'Excluir caderno',
              icon: <Trash2 />,
              danger: true,
              onSelect: async () => {
                const ok = await confirmDialog({
                  title: `Excluir “${project.name}”?`,
                  message:
                    'O caderno será apagado deste aparelho. Se estiver sincronizado, a pasta dele vai para a lixeira do seu Google Drive (dá para recuperar por lá).',
                  confirmLabel: 'Excluir caderno',
                  danger: true,
                });
                if (!ok) return;
                await trackSave(repo.deleteProject(project.id));
                useStatusStore.getState().toast(`“${project.name}” foi excluído.`, 'success');
              },
            },
          ])
        }
      >
        <MoreHorizontal size={17} />
      </IconButton>
      {menu.element}
    </li>
  );
}
