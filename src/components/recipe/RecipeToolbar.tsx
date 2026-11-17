'use client';

import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  ArrowLeft,
  Bold,
  ChefHat,
  Copy,
  FileUp,
  FolderInput,
  Heading2,
  Image,
  ImageDown,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  ListRestart,
  Mic,
  MoreHorizontal,
  Palette,
  Pencil,
  Share2,
  Trash2,
} from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { ItemIcon } from '@/components/ui/Icon';
import { useMenu, type MenuEntry } from '@/components/ui/Menu';
import { itemPath } from '@/features/explorer/tree';
import { useWorkspaceActions } from '@/features/explorer/useWorkspaceActions';
import { useProjectData } from '@/features/projects/ProjectDataProvider';
import { uncheckAll } from '@/features/recipes/content';
import { shareRecipeFile } from '@/features/share/recipeFile';
import { shareRecipeImage } from '@/features/share/shareImage';
import * as repo from '@/lib/repository';
import type { ExplorerItem, Recipe, RichContent } from '@/lib/schemas';
import { trackSave, useStatusStore } from '@/stores/statusStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import styles from './RecipeToolbar.module.scss';

export function RecipeToolbar({
  item,
  recipe,
  editor,
  onPickImage,
  onRecordAudio,
  onAppearance,
  onMove,
}: {
  item: ExplorerItem;
  recipe: Recipe;
  editor: Editor | null;
  onPickImage: () => void;
  onRecordAudio: () => void;
  onAppearance: () => void;
  onMove: () => void;
}) {
  const { project, items } = useProjectData();
  const actions = useWorkspaceActions();
  const moreMenu = useMenu();
  const shareMenu = useMenu();
  const folder = itemPath(items, item.id).at(-2);

  const fmt = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            h2: e.isActive('heading', { level: 2 }),
            tasks: e.isActive('taskList'),
            ordered: e.isActive('orderedList'),
            bullet: e.isActive('bulletList'),
          }
        : null,
  });

  const run = (fn: (e: Editor) => void) => () => editor && fn(editor);
  const toast = useStatusStore.getState().toast;

  /** Shares the latest text, including edits still waiting for the autosave. */
  const current = (): Recipe => (editor ? { ...recipe, content: editor.getJSON() as RichContent } : recipe);

  const shareAsImage = async () => {
    try {
      const result = await shareRecipeImage(item.name, current());
      if (result === 'downloaded') toast('Imagem baixada. Envie pelo WhatsApp, Instagram ou onde quiser.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível gerar a imagem.', 'error');
    }
  };

  const shareAsFile = async () => {
    try {
      const result = await shareRecipeFile(item, current());
      if (result === 'downloaded') toast('Arquivo .cookme baixado. Quem receber usa “Importar receita” no CookMe.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível gerar o arquivo.', 'error');
    }
  };

  const shareEntries: MenuEntry[] = [
    { label: 'Compartilhar como imagem', icon: <ImageDown />, onSelect: () => void shareAsImage() },
    { label: 'Enviar arquivo CookMe', icon: <FileUp />, onSelect: () => void shareAsFile() },
  ];

  const openMore = (anchor: HTMLElement) =>
    moreMenu.open(anchor, [
      { label: 'Renomear', icon: <Pencil />, onSelect: () => void actions.renameItem(item) },
      { label: 'Ícone e cor…', icon: <Palette />, onSelect: onAppearance },
      { label: 'Mover para…', icon: <FolderInput />, onSelect: onMove },
      { label: 'Duplicar', icon: <Copy />, onSelect: () => void actions.duplicateRecipe(item) },
      {
        label: 'Desmarcar ingredientes',
        icon: <ListRestart />,
        onSelect: () => {
          if (editor) editor.commands.setContent(uncheckAll(editor.getJSON() as RichContent));
          else void trackSave(repo.saveRecipeContent(recipe.id, uncheckAll(recipe.content)));
        },
      },
      { kind: 'separator' },
      ...shareEntries,
      { kind: 'separator' },
      { label: 'Excluir receita', icon: <Trash2 />, danger: true, onSelect: () => void actions.deleteItem(item) },
    ]);

  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <button className={styles.back} onClick={() => useWorkspaceStore.getState().setMobileView('list')} aria-label="Voltar para a lista">
          <ArrowLeft size={20} />
        </button>
        <div className={styles.crumbs}>
          {folder ? (
            <button className={styles.folder} onClick={() => actions.openItem(folder, { reveal: true })}>
              <ItemIcon item={folder} size={15} />
              <span>{folder.name}</span>
            </button>
          ) : (
            <span className={styles.folderMuted}>{project.name}</span>
          )}
        </div>

        <div className={styles.tools} role="toolbar" aria-label="Formatação">
          <IconButton label="Ingredientes (lista para marcar)" size="sm" active={fmt?.tasks} onClick={run((e) => e.chain().focus().toggleTaskList().run())}>
            <ListChecks size={17} />
          </IconButton>
          <IconButton label="Passos numerados" size="sm" active={fmt?.ordered} onClick={run((e) => e.chain().focus().toggleOrderedList().run())}>
            <ListOrdered size={17} />
          </IconButton>
          <IconButton label="Lista" size="sm" active={fmt?.bullet} onClick={run((e) => e.chain().focus().toggleBulletList().run())}>
            <List size={17} />
          </IconButton>
          <IconButton label="Título de seção" size="sm" active={fmt?.h2} onClick={run((e) => e.chain().focus().toggleHeading({ level: 2 }).run())}>
            <Heading2 size={17} />
          </IconButton>
          <span className={styles.sep} />
          <IconButton label="Negrito (Ctrl+B)" size="sm" active={fmt?.bold} onClick={run((e) => e.chain().focus().toggleBold().run())}>
            <Bold size={16} />
          </IconButton>
          <IconButton label="Itálico (Ctrl+I)" size="sm" active={fmt?.italic} onClick={run((e) => e.chain().focus().toggleItalic().run())}>
            <Italic size={16} />
          </IconButton>
          <span className={styles.sep} />
          <IconButton label="Inserir foto" size="sm" onClick={onPickImage}>
            <Image size={17} />
          </IconButton>
          <IconButton label="Gravar áudio" size="sm" onClick={onRecordAudio}>
            <Mic size={17} />
          </IconButton>
        </div>

        <div className={styles.actions}>
          <button className={styles.cook} onClick={() => useWorkspaceStore.getState().setCooking(recipe.id)}>
            <ChefHat size={17} />
            <span>Cozinhar</span>
          </button>
          <IconButton label="Compartilhar" onClick={(e) => shareMenu.open(e.currentTarget, shareEntries, 'Compartilhar')}>
            <Share2 size={18} />
          </IconButton>
          <IconButton label="Mais opções" onClick={(e) => openMore(e.currentTarget)}>
            <MoreHorizontal size={18} />
          </IconButton>
        </div>
      </div>
      {moreMenu.element}
      {shareMenu.element}
    </header>
  );
}
