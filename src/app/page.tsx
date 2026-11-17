import { Suspense } from 'react';
import { ClientGate } from '@/components/layout/ClientGate';
import { Splash } from '@/components/layout/Splash';
import { ProjectsHome } from '@/components/projects/ProjectsHome';
import { AuthGate } from '@/features/auth/AuthGate';

export default function HomePage() {
  return (
    <ClientGate fallback={<Splash />}>
      <AuthGate>
        <Suspense fallback={<Splash />}>
          <ProjectsHome />
        </Suspense>
      </AuthGate>
    </ClientGate>
  );
}
