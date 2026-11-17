'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { ProjectDataProvider } from '@/features/projects/ProjectDataProvider';
import { useSeed } from '@/features/projects/hooks';
import { useAccount } from '@/features/auth/AuthGate';
import { syncEngine } from '@/features/sync/syncEngine';
import { rememberLastProject } from '@/lib/utils/routes';
import { Splash } from './Splash';
import { WorkspaceShell } from './WorkspaceShell';
import styles from './Splash.module.scss';

/** Reads the caderno id from `?p=` (see lib/utils/routes). */
export function WorkspaceFromUrl() {
  const projectId = useSearchParams().get('p');
  if (!projectId) {
    return (
      <div className={styles.splash}>
        <span>Nenhum caderno selecionado.</span>
        <Link href="/?inicio=1">Ver cadernos</Link>
      </div>
    );
  }
  return <Workspace projectId={projectId} />;
}

export function Workspace({ projectId }: { projectId: string }) {
  const seeded = useSeed(useAccount().mode === 'local');

  useEffect(() => {
    syncEngine.setActiveProject(projectId);
    rememberLastProject(projectId);
    return () => syncEngine.setActiveProject(null);
  }, [projectId]);

  if (!seeded) return <Splash />;
  return (
    <ProjectDataProvider
      key={projectId}
      projectId={projectId}
      fallback={<Splash message="Abrindo caderno…" />}
      notFound={
        <div className={styles.splash}>
          <span>Caderno não encontrado neste aparelho.</span>
          <Link href="/?inicio=1">Voltar aos cadernos</Link>
        </div>
      }
    >
      <WorkspaceShell />
    </ProjectDataProvider>
  );
}
