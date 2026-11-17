'use client';

import { FolderRoot } from 'lucide-react';
import { ItemIcon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { itemPath, moveTargets } from '@/features/explorer/tree';
import { useProjectData } from '@/features/projects/ProjectDataProvider';
import type { ExplorerItem } from '@/lib/schemas';
import styles from './MoveDialog.module.scss';

export function MoveDialog({
  item,
  onClose,
  onMove,
}: {
  item: ExplorerItem | null;
  onClose: () => void;
  onMove: (parentId: string | null) => void;
}) {
  const { items } = useProjectData();
  if (!item) return null;
  const targets = moveTargets(items, item.id);

  return (
    <Modal open onClose={onClose} title={`Mover “${item.name}” para…`} size="sm">
      <ul className={styles.list}>
        <li>
          <button className={styles.row} disabled={item.parentId === null} onClick={() => onMove(null)}>
            <FolderRoot size={16} />
            <span>Fora das pastas</span>
          </button>
        </li>
        {targets.map((folder) => {
          const depth = itemPath(items, folder.id).length - 1;
          return (
            <li key={folder.id}>
              <button
                className={styles.row}
                style={{ paddingLeft: 12 + depth * 18 }}
                disabled={folder.id === item.parentId}
                onClick={() => onMove(folder.id)}
              >
                <ItemIcon item={folder} size={16} />
                <span>{folder.name}</span>
                {folder.id === item.parentId && <em>atual</em>}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
