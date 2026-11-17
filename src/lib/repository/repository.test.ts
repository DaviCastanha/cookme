import { beforeEach, describe, expect, it } from 'vitest';
import { CookMeDB, setDbForTests } from '@/lib/db/database';
import { buildTutorialBundle } from '@/lib/mock/seed';
import { SECTION_TITLES } from '@/features/recipes/content';
import * as repo from './index';

let db: CookMeDB;

beforeEach(async () => {
  db = new CookMeDB(`test-${Math.random()}`);
  setDbForTests(db);
});

describe('local repository', () => {
  it('creates a caderno with starter folders and queues it for sync', async () => {
    const project = await repo.createProject('Receitas da família');
    const items = await repo.listItems(project.id);
    expect([...items].sort((a, b) => a.order - b.order).map((i) => i.name)).toEqual(['Salgados', 'Doces', 'Bebidas']);
    expect(items.every((i) => i.type === 'folder' && i.icon && i.color)).toBe(true);
    const queued = await db.syncQueue.where('projectId').equals(project.id).toArray();
    expect(queued.map((q) => q.unit)).toEqual(expect.arrayContaining(['project', 'explorer']));
  });

  it('creates a recipe with empty, ready-to-fill sections', async () => {
    const project = await repo.createProject('P', { starterFolders: false });
    const item = await repo.createItem(project.id, { type: 'recipe', name: 'Bolo', parentId: null });
    const recipe = await repo.getRecipe(item.id);
    const headings = recipe!.content.content!.filter((n) => n.type === 'heading').map((n) => n.content?.[0]?.text);
    expect(headings).toEqual([SECTION_TITLES.ingredients, SECTION_TITLES.steps, SECTION_TITLES.tips]);
    expect(recipe!.content.content!.map((n) => n.type)).toEqual(['heading', 'taskList', 'heading', 'orderedList', 'heading', 'paragraph']);
    expect(JSON.stringify(recipe!.content)).not.toMatch(/"text":"(?!Ingredientes|Modo de preparo|Dicas)/);
    const queue = await db.syncQueue.toArray();
    expect(queue.some((q) => q.unit === `recipe:${item.id}`)).toBe(true);
  });

  it('deletes a folder recursively, queueing remote deletes for its recipes', async () => {
    await repo.importBundle(buildTutorialBundle(), { enqueueSync: false });
    const removed = await repo.deleteItem('folder_tut_sweet');
    expect(removed?.map((r) => r.id)).toEqual(expect.arrayContaining(['folder_tut_sweet', 'recipe_tut_bolo_cenoura', 'recipe_tut_brigadeiro']));
    expect(await repo.getRecipe('recipe_tut_brigadeiro')).toBeUndefined();
    const queue = await db.syncQueue.toArray();
    expect(queue.find((q) => q.unit === 'recipe:recipe_tut_brigadeiro')?.op).toBe('delete');
  });

  it('refuses to move a folder into its own descendant', async () => {
    const project = await repo.createProject('P');
    const parent = await repo.createItem(project.id, { type: 'folder', name: 'A', parentId: null });
    const child = await repo.createItem(project.id, { type: 'folder', name: 'B', parentId: parent.id });
    await expect(repo.moveItem(parent.id, child.id)).rejects.toThrow();
    await repo.moveItem(child.id, null);
    expect((await db.items.get(child.id))?.parentId).toBeNull();
  });

  it('keeps one queue entry per file, with the latest write', async () => {
    const project = await repo.createProject('P');
    const item = await repo.createItem(project.id, { type: 'recipe', name: 'R', parentId: null });
    await repo.saveRecipeContent(item.id, { type: 'doc', content: [{ type: 'paragraph' }] });
    await repo.saveRecipeContent(item.id, { type: 'doc', content: [{ type: 'paragraph' }] });
    const entries = await db.syncQueue.where('projectId').equals(project.id).filter((e) => e.unit === `recipe:${item.id}`).toArray();
    expect(entries).toHaveLength(1);
  });

  it('saving the body never overwrites the cover, time or servings (and vice versa)', async () => {
    const project = await repo.createProject('P');
    const item = await repo.createItem(project.id, { type: 'recipe', name: 'R', parentId: null });
    await Promise.all([
      repo.saveRecipe(item.id, { time: '40 min', coverUrl: 'https://example.com/a.jpg' }),
      repo.saveRecipeContent(item.id, { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'novo' }] }] }),
    ]);
    const recipe = await repo.getRecipe(item.id);
    expect(recipe?.time).toBe('40 min');
    expect(recipe?.coverUrl).toBe('https://example.com/a.jpg');
    expect(JSON.stringify(recipe?.content)).toContain('novo');
  });

  it('duplicates a recipe right after the original', async () => {
    await repo.importBundle(buildTutorialBundle(), { enqueueSync: false });
    const copy = await repo.duplicateRecipe('recipe_tut_bolo_cenoura');
    expect(copy?.name).toBe('Bolo de cenoura com chocolate (cópia)');
    const siblings = (await repo.listItems('project_tutorial')).filter((i) => i.parentId === 'folder_tut_sweet').sort((a, b) => a.order - b.order);
    expect(siblings.map((s) => s.id)).toEqual(['recipe_tut_bolo_cenoura', copy!.id, 'recipe_tut_brigadeiro']);
    expect((await repo.getRecipe(copy!.id))?.time).toBe('1h10');
  });

  it('gives every tutorial copy unique ids', () => {
    const a = buildTutorialBundle('aaa111');
    const b = buildTutorialBundle('bbb222');
    expect(a.project.id).toBe('project_tutorial_aaa111');
    const ids = (bundle: typeof a) => [bundle.project.id, ...bundle.items.map((i) => i.id), ...bundle.recipes.map((r) => r.id)];
    expect(ids(a).some((id) => ids(b).includes(id))).toBe(false);
    expect(a.items.every((i) => !i.parentId || a.items.some((p) => p.id === i.parentId))).toBe(true);
  });
});
