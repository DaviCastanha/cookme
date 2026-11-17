'use client';

import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { EditorContent } from '@tiptap/react';
import { Clock, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconColorDialog } from '@/components/explorer/IconColorDialog';
import { MoveDialog } from '@/components/explorer/MoveDialog';
import { ImageSourceDialog, type ImageChoice } from '@/components/ui/ImageSourceDialog';
import { useWorkspaceActions } from '@/features/explorer/useWorkspaceActions';
import { useProjectData } from '@/features/projects/ProjectDataProvider';
import { revealInEditor } from '@/features/recipes/editorRegistry';
import { useRecipeEditor } from '@/features/recipes/useRecipeEditor';
import * as repo from '@/lib/repository';
import type { Recipe } from '@/lib/schemas';
import { jpegName, prepareImage } from '@/lib/utils/image';
import { trackSave, useStatusStore } from '@/stores/statusStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { AudioRecorderDialog, type AudioResult } from './AudioRecorderDialog';
import { useSlashStore } from './extensions/SlashCommand';
import { RecipeCover } from './RecipeCover';
import { RecipeToolbar } from './RecipeToolbar';
import styles from './RecipePane.module.scss';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/** Where a picked image goes: the cover, or into the recipe body. */
type ImageTarget = 'cover' | 'body';

export function RecipePane({ recipe }: { recipe: Recipe }) {
  const { project, itemsById } = useProjectData();
  const actions = useWorkspaceActions();
  const item = itemsById.get(recipe.id);
  const [imageFor, setImageFor] = useState<ImageTarget | null>(null);
  const [recording, setRecording] = useState(false);
  const [appearance, setAppearance] = useState(false);
  const [moving, setMoving] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const imageFilesRef = useRef<(files: File[]) => void>(() => {});
  const { editor } = useRecipeEditor(recipe, { onImageFiles: (files) => imageFilesRef.current(files) });

  // The "/" menu asks the open recipe for its photo picker and recorder.
  useEffect(() => {
    useSlashStore.getState().setRequestImage(() => setImageFor('body'));
    useSlashStore.getState().setRequestAudio(() => setRecording(true));
  }, []);

  // A brand-new recipe: select its title so the name can be typed right away.
  const titleFocusId = useWorkspaceStore((s) => s.titleFocusId);
  useEffect(() => {
    if (titleFocusId !== recipe.id || !titleRef.current) return;
    useWorkspaceStore.getState().setTitleFocus(null);
    titleRef.current.focus();
    titleRef.current.select();
  }, [titleFocusId, recipe.id]);

  // Navigation requests (search hits).
  const navigation = useWorkspaceStore((s) => (s.navigation?.recipeId === recipe.id ? s.navigation : null));
  useEffect(() => {
    if (!navigation || !editor) return;
    const handle = requestAnimationFrame(() => {
      revealInEditor(editor, navigation);
      if (window.matchMedia('(min-width: 900px)').matches) editor.view.focus();
      useWorkspaceStore.getState().clearNavigation();
    });
    return () => cancelAnimationFrame(handle);
  }, [navigation, editor]);

  // Start at the top when another recipe opens.
  useEffect(() => {
    // (Braces matter: newer browsers return a Promise from scrollTo, and an effect must not.)
    scrollRef.current?.scrollTo({ top: 0 });
  }, [recipe.id]);

  const toast = useStatusStore.getState().toast;

  const storeImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Escolha um arquivo de imagem.', 'error');
      return null;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast('Imagem muito grande (máx. 25 MB).', 'error');
      return null;
    }
    const blob = await prepareImage(file);
    return repo.addAsset(project.id, blob, blob === file ? file.name : jpegName(file.name));
  };

  const insertImageFile = async (file: File) => {
    const asset = await storeImage(file);
    if (asset && editor) editor.chain().focus().insertImage({ assetId: asset.id, alt: file.name }).run();
  };
  // Images pasted or dropped into the text are uploaded like picked files.
  imageFilesRef.current = (files) => files.forEach((f) => void insertImageFile(f));

  const onImageChoice = async (choice: ImageChoice) => {
    const target = imageFor;
    setImageFor(null);
    if (target === 'cover') {
      if (choice.kind === 'url') return void trackSave(repo.saveRecipe(recipe.id, { coverUrl: choice.url, coverAssetId: null }));
      const asset = await storeImage(choice.file);
      if (asset) await trackSave(repo.saveRecipe(recipe.id, { coverAssetId: asset.id, coverUrl: null }));
      return;
    }
    if (choice.kind === 'file') await insertImageFile(choice.file);
    else editor?.chain().focus().insertImage({ src: choice.url }).run();
  };

  const onAudio = async ({ blob, duration, fileName }: AudioResult) => {
    setRecording(false);
    if (!editor) return;
    const stamp = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const title = fileName ?? `Áudio · ${stamp}`;
    const asset = await repo.addAsset(project.id, blob, title);
    editor.chain().focus().insertAudio({ assetId: asset.id, duration, title }).run();
  };

  if (!item) return null;

  return (
    <div className={styles.pane}>
      <RecipeToolbar
        item={item}
        recipe={recipe}
        editor={editor}
        onPickImage={() => setImageFor('body')}
        onRecordAudio={() => setRecording(true)}
        onAppearance={() => setAppearance(true)}
        onMove={() => setMoving(true)}
      />

      <div ref={scrollRef} className={styles.scroll}>
        <article className={styles.page}>
          <RecipeCover recipe={recipe} item={item} onPick={() => setImageFor('cover')} />

          <TitleInput
            ref={titleRef}
            value={item.name}
            onCommit={(name) => void actions.renameItem(item, name)}
            onEnter={() => editor && focusFirstEntry(editor)}
          />

          <div className={styles.meta}>
            <MetaField
              icon={<Clock size={15} />}
              label="Tempo de preparo"
              placeholder="Tempo"
              value={recipe.time}
              onCommit={(time) => void trackSave(repo.saveRecipe(recipe.id, { time }))}
            />
            <MetaField
              icon={<Users size={15} />}
              label="Rendimento"
              placeholder="Rende"
              value={recipe.servings}
              onCommit={(servings) => void trackSave(repo.saveRecipe(recipe.id, { servings }))}
            />
          </div>

          <EditorContent editor={editor} className={styles.editor} />
        </article>
      </div>

      <ImageSourceDialog
        open={!!imageFor}
        title={imageFor === 'cover' ? 'Foto da receita' : 'Inserir foto'}
        onClose={() => setImageFor(null)}
        onPick={(choice) => void onImageChoice(choice)}
      />
      <AudioRecorderDialog open={recording} onClose={() => setRecording(false)} onInsert={(r) => void onAudio(r)} />
      <IconColorDialog
        item={appearance ? item : null}
        onClose={() => setAppearance(false)}
        onSave={(patch) => {
          void actions.setAppearance(item, patch);
          setAppearance(false);
        }}
      />
      <MoveDialog
        item={moving ? item : null}
        onClose={() => setMoving(false)}
        onMove={(parentId) => {
          void actions.moveItem(item, parentId);
          setMoving(false);
        }}
      />
    </div>
  );
}

/** Recipe name: a textarea so long names wrap instead of scrolling sideways. */
function TitleInput({
  ref,
  value,
  onCommit,
  onEnter,
}: {
  ref: React.Ref<HTMLTextAreaElement>;
  value: string;
  onCommit: (value: string) => void;
  onEnter: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const local = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => setDraft(value), [value]);

  // Grow with the text.
  useEffect(() => {
    const el = local.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  return (
    <textarea
      ref={(el) => {
        local.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = el;
      }}
      className={styles.title}
      value={draft}
      rows={1}
      aria-label="Nome da receita"
      placeholder="Nome da receita"
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ' '))}
      onBlur={() => {
        const next = draft.trim();
        if (next && next !== value) onCommit(next);
        else setDraft(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
          onEnter();
        }
        if (e.key === 'Escape') {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function MetaField({
  icon,
  label,
  placeholder,
  value,
  onCommit,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className={[styles.metaField, !draft && styles.metaEmpty].filter(Boolean).join(' ')} title={label}>
      {icon}
      <input
        value={draft}
        placeholder={placeholder}
        aria-label={label}
        size={Math.max(placeholder.length, draft.length, 4)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() !== value) onCommit(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

/** After naming the recipe, the caret goes to the first empty line (usually the first ingredient). */
function focusFirstEntry(editor: Editor) {
  let target: number | null = null;
  let fallback: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (target !== null) return false;
    if (node.type.name !== 'paragraph') return true;
    if (fallback === null) fallback = pos + 1;
    if (node.content.size === 0) target = pos + 1;
    return false;
  });
  const at = target ?? fallback;
  if (at === null) return void editor.commands.focus('end');
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, at)).scrollIntoView());
  editor.view.focus();
}
