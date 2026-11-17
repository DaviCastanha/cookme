'use client';

import { useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { buildExtensions } from '@/components/recipe/extensions';
import * as repo from '@/lib/repository';
import type { Recipe, RichContent } from '@/lib/schemas';
import { useStatusStore } from '@/stores/statusStore';
import { editorRegistry } from './editorRegistry';

const SAVE_DELAY = 700;

/**
 * Creates the Tiptap editor for the open recipe, with debounced autosave to IndexedDB
 * and live reload when the recipe changes elsewhere (e.g. pulled from Drive).
 */
export function useRecipeEditor(recipe: Recipe, opts: { onImageFiles: (files: File[]) => void }) {
  const recipeId = recipe.id;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const lastWrittenAt = useRef<string>(recipe.updatedAt);
  const imageFilesRef = useRef(opts.onImageFiles);
  imageFilesRef.current = opts.onImageFiles;

  const flush = useCallback(
    async (editor: Editor | null) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (!editor || !dirty.current || editor.isDestroyed) return;
      dirty.current = false;
      const status = useStatusStore.getState();
      try {
        lastWrittenAt.current = (await repo.saveRecipeContent(recipeId, editor.getJSON() as RichContent)) ?? lastWrittenAt.current;
        status.endSave();
      } catch (error) {
        dirty.current = true;
        status.endSave(error);
      }
    },
    [recipeId],
  );

  // Built once per recipe.
  const extensions = useMemo(() => buildExtensions(), []);

  const editor = useEditor(
    {
      extensions,
      content: recipe.content,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: { class: 'cm-prose', spellcheck: 'true', 'aria-label': 'Receita' },
        handlePaste: (_view, event) => {
          const files = imageFiles(event.clipboardData);
          if (!files.length) return false;
          imageFilesRef.current(files);
          return true;
        },
        handleDrop: (view, event, _slice, moved) => {
          const files = moved ? [] : imageFiles(event.dataTransfer);
          if (!files.length) return false;
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (pos) view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos.pos))));
          imageFilesRef.current(files);
          return true;
        },
      },
      onUpdate: ({ editor, transaction }) => {
        if (transaction.getMeta('cm-external')) return;
        if (!dirty.current) {
          dirty.current = true;
          useStatusStore.getState().beginSave();
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(editor), SAVE_DELAY);
      },
    },
    [recipeId],
  );

  // Registry + flush on unmount / app hidden.
  useEffect(() => {
    if (!editor) return;
    editorRegistry.set(recipeId, editor);
    const onHide = () => void flush(editor);
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      void flush(editor);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      editorRegistry.delete(recipeId, editor);
    };
  }, [editor, recipeId, flush]);

  // External changes (sync pull, cooking mode, other tab) replace the content when there are no local edits.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (recipe.updatedAt === lastWrittenAt.current || dirty.current) return;
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(recipe.content)) {
      lastWrittenAt.current = recipe.updatedAt;
      return;
    }
    const { from, to } = editor.state.selection;
    editor
      .chain()
      .setMeta('cm-external', true)
      .setMeta('addToHistory', false)
      .setContent(recipe.content, { emitUpdate: false })
      .run();
    const max = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) });
    lastWrittenAt.current = recipe.updatedAt;
  }, [editor, recipe.updatedAt, recipe.content]);

  return { editor, flush: () => flush(editor) };
}

function imageFiles(data: DataTransfer | null): File[] {
  return [...(data?.files ?? [])].filter((f) => f.type.startsWith('image/'));
}
