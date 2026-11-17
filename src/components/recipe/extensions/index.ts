import type { Extensions } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import UniqueID from '@tiptap/extension-unique-id';
import { BLOCK_ID_TYPES } from '@/features/recipes/content';
import { createId } from '@/lib/utils/id';
import { AssetImage } from './AssetImage';
import { AudioNote } from './AudioNote';
import { FlashHighlight } from './FlashHighlight';
import { SlashCommand } from './SlashCommand';

/** Hint shown in an empty line, depending on where it is. */
function hintFor(doc: PMNode, pos: number, node: PMNode): string {
  if (node.type.name === 'heading') return 'Título da seção';
  const $pos = doc.resolve(Math.min(pos + 1, doc.content.size));
  for (let depth = $pos.depth; depth > 0; depth--) {
    const name = $pos.node(depth).type.name;
    if (name === 'taskItem') return 'Ex.: 2 xícaras de farinha de trigo';
    if (name === 'listItem') {
      const list = $pos.node(depth - 1).type.name;
      return list === 'orderedList' ? 'Descreva este passo' : 'Item da lista';
    }
  }
  // Paragraph right under a section title: hint by section.
  const index = $pos.index(0);
  const before = index > 0 ? doc.child(index - 1) : null;
  if (before?.type.name === 'heading' && /dica|nota|observa/i.test(before.textContent)) {
    return 'Variações, segredos, de onde veio a receita…';
  }
  return 'Escreva aqui, ou digite / para inserir foto, áudio, lista…';
}

export function buildExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: { openOnClick: false, autolink: true },
      codeBlock: false,
      code: false,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({
      placeholder: ({ editor, node, pos }) => hintFor(editor.state.doc, pos, node),
      // Every empty section shows its hint, so a new recipe reads like a form to fill in.
      showOnlyCurrent: false,
      includeChildren: true,
    }),
    UniqueID.configure({
      types: BLOCK_ID_TYPES,
      generateID: () => createId('b'),
    }),
    AssetImage,
    AudioNote,
    FlashHighlight,
    SlashCommand,
  ];
}
