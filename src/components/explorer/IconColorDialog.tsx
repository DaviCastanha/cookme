'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ICON_GROUPS, ItemIcon, NamedIcon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { PALETTE, type ColorName, type ExplorerItem } from '@/lib/schemas';
import styles from './IconColorDialog.module.scss';

export const COLOR_LABELS: Record<ColorName, string> = {
  tomato: 'Tomate',
  carrot: 'Cenoura',
  saffron: 'Açafrão',
  olive: 'Azeitona',
  basil: 'Manjericão',
  mint: 'Hortelã',
  blueberry: 'Mirtilo',
  plum: 'Ameixa',
  beet: 'Beterraba',
  cinnamon: 'Canela',
  cocoa: 'Cacau',
  pepper: 'Pimenta-do-reino',
};

export function IconColorDialog({
  item,
  onClose,
  onSave,
}: {
  item: ExplorerItem | null;
  onClose: () => void;
  onSave: (patch: Pick<ExplorerItem, 'icon' | 'color'>) => void;
}) {
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<ColorName | null>(null);

  useEffect(() => {
    setIcon(item?.icon ?? null);
    setColor(item?.color ?? null);
  }, [item]);

  if (!item) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Ícone e cor"
      size="md"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setIcon(null);
              setColor(null);
            }}
          >
            Restaurar padrão
          </Button>
          <span style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => onSave({ icon, color })}>
            Aplicar
          </Button>
        </>
      }
    >
      <div className={styles.preview}>
        <ItemIcon item={{ ...item, icon, color }} size={22} soft />
        <span>{item.name}</span>
      </div>

      <h3 className={styles.label}>Cor</h3>
      <div className={styles.colors} role="radiogroup" aria-label="Cor">
        {PALETTE.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={color === c}
            aria-label={COLOR_LABELS[c]}
            title={COLOR_LABELS[c]}
            className={[styles.swatch, color === c && styles.selected].filter(Boolean).join(' ')}
            style={{ background: `var(--palette-${c})` }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      {ICON_GROUPS.map((group) => (
        <div key={group.label}>
          <h3 className={styles.label}>{group.label}</h3>
          <div className={styles.icons} role="radiogroup" aria-label={`Ícones: ${group.label}`}>
            {Object.keys(group.icons).map((name) => (
              <button
                key={name}
                role="radio"
                aria-checked={icon === name}
                aria-label={name}
                title={name}
                className={[styles.iconChoice, icon === name && styles.selected].filter(Boolean).join(' ')}
                onClick={() => setIcon(name)}
              >
                <NamedIcon name={name} size={19} strokeWidth={1.8} style={color ? { color: `var(--palette-${color})` } : undefined} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}
