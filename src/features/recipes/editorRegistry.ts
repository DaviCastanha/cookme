import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { flashKey } from '@/components/recipe/extensions/FlashHighlight';
import { findAll } from '@/lib/utils/text';

/** Live editor instances by recipe id. */
const registry = new Map<string, Editor>();

export const editorRegistry = {
  set: (documentId: string, editor: Editor) => registry.set(documentId, editor),
  delete: (documentId: string, editor: Editor) => {
    if (registry.get(documentId) === editor) registry.delete(documentId);
  },
  get: (documentId: string) => registry.get(documentId),
};

export function findNodePosById(editor: Editor, id: string): number | null {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.attrs?.id === id) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

/**
 * Moves the cursor to a block (optionally selecting `text` inside it), scrolls it into view
 * and flashes it so the person sees where they landed.
 */
export function revealInEditor(editor: Editor, target: { blockId?: string; text?: string }) {
  const id = target.blockId;
  if (!id) return false;
  const pos = findNodePosById(editor, id);
  if (pos === null) {
    // Block id changed (e.g. after heavy edits): fall back to finding the text.
    return target.text ? revealText(editor, target.text) : false;
  }
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return false;

  let from = pos + 1;
  let to = from;
  if (target.text) {
    const offset = findAll(node.textContent, target.text)[0];
    if (offset !== undefined) {
      from = textPosAt(node, pos, offset);
      to = textPosAt(node, pos, offset + target.text.length);
    }
  }
  const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to));
  editor.view.dispatch(tr);
  flash(editor, pos);
  return true;
}

function revealText(editor: Editor, text: string) {
  let hit: { pos: number; offset: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (hit || !node.isTextblock) return !hit;
    const offset = findAll(node.textContent, text)[0];
    if (offset !== undefined) hit = { pos, offset };
    return false;
  });
  if (!hit) return false;
  const { pos, offset } = hit;
  const node = editor.state.doc.nodeAt(pos)!;
  const tr = editor.state.tr.setSelection(
    TextSelection.create(editor.state.doc, textPosAt(node, pos, offset), textPosAt(node, pos, offset + text.length)),
  );
  editor.view.dispatch(tr);
  flash(editor, pos);
  return true;
}

/** Converts a character offset inside a textblock into a document position. */
function textPosAt(node: import('@tiptap/pm/model').Node, nodePos: number, offset: number) {
  let remaining = offset;
  let result = nodePos + 1;
  let done = false;
  node.forEach((child, childOffset) => {
    if (done) return;
    const len = child.isText ? child.text!.length : child.textContent.length;
    if (remaining <= len) {
      result = nodePos + 1 + childOffset + (child.isText ? remaining : 0);
      done = true;
    } else {
      remaining -= len;
    }
  });
  if (!done) result = nodePos + node.nodeSize - 1;
  return result;
}

function flash(editor: Editor, pos: number) {
  editor.view.dispatch(editor.state.tr.setMeta(flashKey, { pos }).setMeta('addToHistory', false));
  requestAnimationFrame(() => {
    const dom = editor.view.nodeDOM(pos);
    if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  setTimeout(() => {
    if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(flashKey, { clear: true }).setMeta('addToHistory', false));
  }, 2400);
}
