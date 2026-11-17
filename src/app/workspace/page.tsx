import { Suspense } from 'react';
import { ClientGate } from '@/components/layout/ClientGate';
import { Splash } from '@/components/layout/Splash';
import { WorkspaceFromUrl } from '@/components/layout/Workspace';
import { AuthGate } from '@/features/auth/AuthGate';

export default function WorkspacePage() {
  return (
    <ClientGate fallback={<Splash />}>
      <AuthGate>
        <Suspense fallback={<Splash />}>
          <WorkspaceFromUrl />
        </Suspense>
      </AuthGate>
    </ClientGate>
  );
}
