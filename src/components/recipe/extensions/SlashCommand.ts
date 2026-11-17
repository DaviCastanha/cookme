import { Extension, type Editor, type Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import { create } from 'zustand';
import { normalize } from '@/lib/utils/text';

export interface SlashItem {
  id: string;
  label: string;
  hint: string;
  icon: string;
  keywords: string[];
  run: (editor: Editor, range: Range) => void;
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: 'text',
    label: 'Texto',
    hint: 'Parágrafo simples',
    icon: 'text',
    keywords: ['paragrafo', 'texto'],
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run(),
  },
  {
    id: 'h2',
    label: 'Seção',
    hint: 'Título de seção (ex.: Cobertura)',
    icon: 'heading-2',
    keywords: ['secao', 'titulo', 'heading', 'h2'],
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Subtítulo',
    hint: 'Divide uma seção (ex.: Massa, Recheio)',
    icon: 'heading-3',
    keywords: ['subtitulo', 'h3', 'parte'],
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run(),
  },
  {
    id: 'ingredients',
    label: 'Ingredientes',
    hint: 'Lista para ir marcando',
    icon: 'list-checks',
    keywords: ['ingredientes', 'checklist', 'tarefas', 'marcar'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    id: 'steps',
    label: 'Passos',
    hint: 'Passo a passo numerado',
    icon: 'list-ordered',
    keywords: ['passos', 'preparo', 'numerada', 'ordered'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    id: 'bullet',
    label: 'Lista',
    hint: 'Lista com marcadores',
    icon: 'list',
    keywords: ['lista', 'bullet', 'marcadores'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    id: 'quote',
    label: 'Destaque',
    hint: 'Um aviso ou segredo da receita',
    icon: 'lightbulb',
    keywords: ['destaque', 'aviso', 'citacao', 'quote', 'dica'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    id: 'image',
    label: 'Foto',
    hint: 'Da câmera, da galeria ou por link',
    icon: 'image',
    keywords: ['foto', 'imagem', 'image', 'camera'],
    run: (e, r) => {
      e.chain().focus().deleteRange(r).run();
      useSlashStore.getState().requestImage?.();
    },
  },
  {
    id: 'audio',
    label: 'Áudio',
    hint: 'Grave uma explicação',
    icon: 'mic',
    keywords: ['audio', 'gravar', 'voz', 'microfone'],
    run: (e, r) => {
      e.chain().focus().deleteRange(r).run();
      useSlashStore.getState().requestAudio?.();
    },
  },
  {
    id: 'divider',
    label: 'Separador',
    hint: 'Linha horizontal',
    icon: 'minus',
    keywords: ['separador', 'linha', 'divider'],
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
];

interface SlashState {
  props: SuggestionProps<SlashItem, SlashItem> | null;
  selected: number;
  /** Set by the active editor pane to open its image picker. */
  requestImage: (() => void) | null;
  setRequestImage: (fn: (() => void) | null) => void;
  /** Set by the active editor pane to open its audio recorder. */
  requestAudio: (() => void) | null;
  setRequestAudio: (fn: (() => void) | null) => void;
}

export const useSlashStore = create<SlashState>()((set) => ({
  props: null,
  selected: 0,
  requestImage: null,
  setRequestImage: (requestImage) => set({ requestImage }),
  requestAudio: null,
  setRequestAudio: (requestAudio) => set({ requestAudio }),
}));

export function filterSlashItems(query: string) {
  const q = normalize(query);
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((i) => normalize(i.label).includes(q) || i.keywords.some((k) => k.startsWith(q)));
}

function onKeyDown({ event }: SuggestionKeyDownProps) {
  const { props, selected } = useSlashStore.getState();
  if (!props || !props.items.length) return false;
  if (event.key === 'ArrowDown') {
    useSlashStore.setState({ selected: (selected + 1) % props.items.length });
    return true;
  }
  if (event.key === 'ArrowUp') {
    useSlashStore.setState({ selected: (selected - 1 + props.items.length) % props.items.length });
    return true;
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    props.command(props.items[selected]);
    return true;
  }
  if (event.key === 'Escape') {
    useSlashStore.setState({ props: null });
    return true;
  }
  return false;
}

/** "/" menu to insert blocks. Rendering lives in SlashMenu.tsx, driven by `useSlashStore`. */
export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        pluginKey: new PluginKey('slashCommand'),
        editor: this.editor,
        char: '/',
        startOfLine: false,
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => ({
          onStart: (props) => useSlashStore.setState({ props, selected: 0 }),
          onUpdate: (props) => useSlashStore.setState({ props, selected: 0 }),
          onExit: () => useSlashStore.setState({ props: null }),
          onKeyDown,
        }),
      }),
    ];
  },
});
