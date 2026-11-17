'use client';

import { Camera, ImageOff, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ItemIcon } from '@/components/ui/Icon';
import * as repo from '@/lib/repository';
import type { ExplorerItem, Recipe } from '@/lib/schemas';
import { trackSave } from '@/stores/statusStore';
import { useAssetSrc } from './extensions/AssetImage';
import styles from './RecipeCover.module.scss';

/** The recipe photo, highlighted at the top. Empty, it invites the person to add one. */
export function RecipeCover({ recipe, item, onPick }: { recipe: Recipe; item: ExplorerItem; onPick: () => void }) {
  const { url, missing } = useAssetSrc(recipe.coverAssetId, recipe.coverUrl);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  const hasCover = !!(recipe.coverAssetId || recipe.coverUrl);

  if (!hasCover) {
    return (
      <button className={styles.empty} onClick={onPick}>
        <ItemIcon item={item} size={30} />
        <span className={styles.emptyLabel}>
          <Camera size={16} /> Adicionar foto da receita
        </span>
      </button>
    );
  }

  return (
    <div className={styles.cover}>
      {url && !broken ? (
        <img src={url} alt={`Foto de ${item.name}`} onError={() => setBroken(true)} />
      ) : (
        <div className={styles.placeholder}>
          <ImageOff size={20} />
          <span>
            {broken
              ? 'Não foi possível carregar a foto deste link.'
              : missing
                ? 'A foto ainda está chegando neste aparelho.'
                : 'Carregando foto…'}
          </span>
        </div>
      )}
      <div className={styles.actions}>
        <button onClick={onPick}>
          <RefreshCw size={14} /> Trocar
        </button>
        <button
          onClick={() => void trackSave(repo.saveRecipe(recipe.id, { coverAssetId: null, coverUrl: null }))}
          aria-label="Remover foto"
          title="Remover foto"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
