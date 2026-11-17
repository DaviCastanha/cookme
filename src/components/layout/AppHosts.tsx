'use client';

import { useEffect, useRef } from 'react';
import { AboutDialogs } from '@/components/about/AboutDialogs';
import { APP_VERSION } from '@/content/releases';
import { useAccount } from '@/features/auth/AuthGate';
import { useSessionStore } from '@/features/auth/sessionStore';
import { upgradeTutorials } from '@/features/projects/tutorial';
import { getDb } from '@/lib/db/database';
import { unseenReleases, useAboutStore } from '@/stores/aboutStore';
import { useStatusStore } from '@/stores/statusStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Account-level chores that run once the person's data is available, on any page:
 * - update tutorial copies to the version shipped with the app;
 * - announce releases this device has not seen yet ("Novidades").
 */
export function AppHosts() {
  const { mode } = useAccount();
  const driveConnected = useSessionStore((s) => s.driveConnected);
  const firstSyncDone = useStatusStore((s) => s.firstSyncDone);
  const sync = useStatusStore((s) => s.sync);
  const announced = useRef(false);
  const upgraded = useRef(false);

  // With Drive, wait for the first sync: another device may have updated the tutorial already.
  const dataSettled = mode === 'local' || !driveConnected || firstSyncDone || sync === 'offline' || sync === 'error';

  useEffect(() => {
    if (!dataSettled || upgraded.current) return;
    upgraded.current = true;
    void upgradeTutorials().then((done) => {
      if (!done.length) return;
      for (const { projectId, removed } of done) useWorkspaceStore.getState().forget(projectId, removed);
      useStatusStore.getState().toast(`O caderno de exemplo foi atualizado para a versão ${APP_VERSION}.`, 'success');
    });
  }, [dataSettled]);

  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    void getDb()
      .projects.count()
      .then((count) => {
        const fresh = unseenReleases(count > 0);
        if (fresh.length) useAboutStore.getState().showNews(fresh);
      });
  }, []);

  return <AboutDialogs />;
}
