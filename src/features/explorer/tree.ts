import type { ExplorerItem } from '@/lib/schemas';

export interface TreeNode {
  item: ExplorerItem;
  children: TreeNode[];
  depth: number;
}

export function sortSiblings(items: ExplorerItem[]) {
  return [...items].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));
}

export function buildTree(items: ExplorerItem[]): TreeNode[] {
  const byParent = new Map<string | null, ExplorerItem[]>();
  for (const item of items) {
    const key = item.parentId && items.some((i) => i.id === item.parentId) ? item.parentId : null;
    const list = byParent.get(key) ?? [];
    list.push(item);
    byParent.set(key, list);
  }
  const build = (parentId: string | null, depth: number): TreeNode[] =>
    sortSiblings(byParent.get(parentId) ?? []).map((item) => ({
      item,
      depth,
      children: build(item.id, depth + 1),
    }));
  return build(null, 0);
}

/** Depth-first reading order of every item (the order shown in the explorer). */
export function flattenTree(nodes: TreeNode[]): ExplorerItem[] {
  const out: ExplorerItem[] = [];
  const walk = (list: TreeNode[]) =>
    list.forEach((n) => {
      out.push(n.item);
      walk(n.children);
    });
  walk(nodes);
  return out;
}

export function itemPath(items: ExplorerItem[], id: string): ExplorerItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: ExplorerItem[] = [];
  let current = byId.get(id);
  while (current) {
    out.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return out;
}

export function ancestorIds(items: ExplorerItem[], id: string): string[] {
  return itemPath(items, id)
    .slice(0, -1)
    .map((i) => i.id);
}

/** Folders a given item may be moved into (excludes itself and its descendants). */
export function moveTargets(items: ExplorerItem[], movingId: string): ExplorerItem[] {
  const blocked = new Set<string>([movingId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const i of items) {
      if (i.parentId && blocked.has(i.parentId) && !blocked.has(i.id)) {
        blocked.add(i.id);
        grew = true;
      }
    }
  }
  return flattenTree(buildTree(items)).filter((i) => i.type === 'folder' && !blocked.has(i.id));
}
