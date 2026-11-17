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
  Link2,
  Link2Off,
  List,
  ListChecks,
  ListOrdered,
  ListRestart,
  Mic,
  MoreHorizontal,
  Palette,
  Pencil,
  Share2,
  Smartphone,
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
import { copyLink, createPublicLink, linkFor, removePublicLink, shareLink } from '@/features/share/publicLink';
import { useSessionStore } from '@/features/auth/sessionStore';
import { confirmDialog } from '@/stores/dialogStore';
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
  const driveConnected = useSessionStore((s) => s.driveConnected);

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

  const shareAsImage = async (format: 'card' | 'story' = 'card') => {
    try {
      const result = await shareRecipeImage(item.name, current(), format);
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

  /** Saves pending edits, then creates the public copy and offers to share the link. */
  const createLink = async () => {
    try {
      if (editor) await repo.saveRecipeContent(recipe.id, editor.getJSON() as RichContent);
      toast('Criando o link público…', 'info');
      const url = await createPublicLink(recipe.id);
      const copied = await copyLink(url);
      // The share sheet needs a fresh tap after the (slow) upload: offer it in the toast.
      toast(copied ? 'Link público criado e copiado.' : 'Link público criado.', 'success', {
        label: 'Compartilhar',
        run: () => void shareLink(item.name, url),
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível criar o link.', 'error');
    }
  };

  const disableLink = async () => {
    const ok = await confirmDialog({
      title: 'Desativar o link público?',
      message: 'Quem tiver o link não vai mais conseguir abrir a receita. Você pode criar um link novo depois.',
      confirmLabel: 'Desativar link',
      danger: true,
    });
    if (!ok) return;
    try {
      await removePublicLink(recipe.id);
      toast('Link desativado.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível desativar o link.', 'error');
    }
  };

  const linkEntries: MenuEntry[] = !driveConnected
    ? [{ label: 'Link público', hint: 'Entre com o Google', icon: <Link2 />, disabled: true }]
    : recipe.publicFileId
      ? [
          {
            label: 'Compartilhar link',
            icon: <Link2 />,
            onSelect: async () => {
              const result = await shareLink(item.name, linkFor(recipe.publicFileId!));
              if (result === 'copied') toast('Link copiado.', 'success');
            },
          },
          {
            label: 'Copiar link',
            icon: <Copy />,
            onSelect: async () => toast((await copyLink(linkFor(recipe.publicFileId!))) ? 'Link copiado.' : 'Não foi possível copiar.', 'info'),
          },
          { label: 'Desativar link', icon: <Link2Off />, danger: true, onSelect: () => void disableLink() },
        ]
      : [{ label: 'Criar link público', icon: <Link2 />, onSelect: () => void createLink() }];

  const shareEntries: MenuEntry[] = [
    ...linkEntries,
    { kind: 'separator' },
    { label: 'Imagem (WhatsApp)', icon: <ImageDown />, onSelect: () => void shareAsImage('card') },
    { label: 'Story do Instagram', icon: <Smartphone />, onSelect: () => void shareAsImage('story') },
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
