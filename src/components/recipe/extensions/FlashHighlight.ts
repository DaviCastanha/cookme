import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Briefly highlights a block (after jumping to a search hit or citation). Implemented as a
 * decoration because ProseMirror reverts classes added to its DOM directly.
 */
export const flashKey = new PluginKey<DecorationSet>('flashHighlight');

export const FlashHighlight = Extension.create({
  name: 'flashHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: flashKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(flashKey) as { pos?: number; clear?: boolean } | undefined;
            if (meta?.clear) return DecorationSet.empty;
            if (meta?.pos !== undefined) {
              const node = tr.doc.nodeAt(meta.pos);
              if (!node) return set;
              return DecorationSet.create(tr.doc, [Decoration.node(meta.pos, meta.pos + node.nodeSize, { class: 'cm-flash' })]);
            }
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => flashKey.getState(state),
        },
      }),
    ];
  },
});
