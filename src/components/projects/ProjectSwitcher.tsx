'use client';

import { BookOpen, ChefHat, ChevronDown, LayoutGrid, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { workspaceHref } from '@/lib/utils/routes';
import { useMenu } from '@/components/ui/Menu';
import { useProjectData } from '@/features/projects/ProjectDataProvider';
import { useProjects } from '@/features/projects/hooks';
import { createProject } from '@/lib/repository';
import { promptDialog } from '@/stores/dialogStore';
import styles from './ProjectSwitcher.module.scss';

/** Brand mark + the open caderno, with a menu to switch cadernos. */
export function ProjectSwitcher() {
  const { project } = useProjectData();
  const projects = useProjects();
  const router = useRouter();
  const menu = useMenu();

  const create = async () => {
    const name = await promptDialog({ title: 'Novo caderno', label: 'Nome do caderno', placeholder: 'Ex.: Receitas da família', confirmLabel: 'Criar' });
    if (!name) return;
    const created = await createProject(name);
    router.push(workspaceHref(created.id));
  };

  return (
    <>
      <button
        className={styles.switcher}
        aria-haspopup="menu"
        onClick={(e) =>
          menu.open(
            e.currentTarget,
            [
              ...(projects ?? []).slice(0, 8).map((p) => ({
                label: p.name,
                icon: <BookOpen />,
                checked: p.id === project.id,
                onSelect: () => router.push(workspaceHref(p.id)),
              })),
              { kind: 'separator' as const },
              { label: 'Todos os cadernos', icon: <LayoutGrid />, onSelect: () => router.push('/?inicio=1') },
              { label: 'Novo caderno', icon: <Plus />, onSelect: () => void create() },
            ],
            'Cadernos',
          )
        }
      >
        <span className={styles.logo} aria-hidden>
          <ChefHat size={18} strokeWidth={1.9} />
        </span>
        <span className={styles.text}>
          <span className={styles.brand}>CookMe</span>
          <span className={styles.name}>{project.name}</span>
        </span>
        <ChevronDown size={16} className={styles.chevron} />
      </button>
      {menu.element}
    </>
  );
}
