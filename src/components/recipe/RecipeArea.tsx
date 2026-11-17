'use client';

import { ChefHat, Plus, Search } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { useWorkspaceActions } from '@/features/explorer/useWorkspaceActions';
import { useProjectData } from '@/features/projects/ProjectDataProvider';
import { useProjectView, useWorkspaceStore } from '@/stores/workspaceStore';
import { RecipePane } from './RecipePane';
import { SlashMenu } from './SlashMenu';
import styles from './RecipeArea.module.scss';

/** Right side: the open recipe (one at a time), or a friendly empty state. */
export function RecipeArea({ visible }: { visible: boolean }) {
  const { project, recipes, itemsById } = useProjectData();
  const { openId } = useProjectView(project.id);
  const forget = useWorkspaceStore((s) => s.forget);
  const recipe = openId ? recipes.get(openId) : undefined;

  // The open recipe was deleted (on another device, for example).
  useEffect(() => {
    if (openId && !itemsById.has(openId)) forget(project.id, [openId]);
  }, [openId, itemsById, forget, project.id]);

  return (
    <section className={styles.area} aria-label="Receita" hidden={!visible}>
      {recipe ? <RecipePane key={recipe.id} recipe={recipe} /> : <EmptyState />}
      <SlashMenu />
    </section>
  );
}

function EmptyState() {
  const actions = useWorkspaceActions();
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <ChefHat size={30} strokeWidth={1.7} />
      </div>
      <h2>O que vamos cozinhar?</h2>
      <p>Escolha uma receita na lista ou comece uma nova. Ela já vem com ingredientes, modo de preparo e dicas para preencher.</p>
      <div className={styles.emptyActions}>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => void actions.createRecipe(null)}>
          Nova receita
        </Button>
        <Button variant="outline" icon={<Search size={16} />} onClick={() => useWorkspaceStore.getState().setSearchOpen(true)}>
          Buscar
        </Button>
      </div>
    </div>
  );
}
