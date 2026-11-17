/**
 * Tutorial caderno: teaches the app by using it. "Como usar o CookMe" explains each feature
 * in the shape of a recipe, and the other recipes are real, complete examples.
 * IDs are fixed here; `buildTutorialBundle(suffix)` makes them unique per copy.
 *
 * Existing copies are replaced automatically when TUTORIAL_VERSION grows (see
 * features/projects/tutorial.ts). Whenever this content changes: bump TUTORIAL_VERSION and set
 * T0 to the release date (open editors reload a recipe when its date changes).
 */
import type { ProjectBundle } from '@/lib/repository';
import type { ExplorerItem, Recipe, RichContent } from '@/lib/schemas';
import { SCHEMA_VERSION } from '@/lib/schemas';
import { SECTION_TITLES } from '@/features/recipes/content';

export const TUTORIAL_VERSION = 2;
const PID = 'project_tutorial';
const T0 = '2026-11-16T12:00:00.000Z';

type Segment = string | { em: string } | { b: string };

let blockCounter = 0;
const blockId = () => `b_tut_${++blockCounter}`;

function segments(list: Segment[]): RichContent[] {
  return list.map((s) => {
    if (typeof s === 'string') return { type: 'text', text: s };
    if ('em' in s) return { type: 'text', text: s.em, marks: [{ type: 'italic' }] };
    return { type: 'text', text: s.b, marks: [{ type: 'bold' }] };
  });
}
function p(...list: Segment[]): RichContent {
  return { type: 'paragraph', attrs: { id: blockId() }, content: list.length ? segments(list) : undefined };
}
function h(text: string, level = 2): RichContent {
  return { type: 'heading', attrs: { id: blockId(), level }, content: [{ type: 'text', text }] };
}
/** Ingredient checklist. */
function tasks(...items: (Segment[] | string)[]): RichContent {
  return {
    type: 'taskList',
    content: items.map((item) => ({
      type: 'taskItem',
      attrs: { checked: false },
      content: [p(...(typeof item === 'string' ? [item] : item))],
    })),
  };
}
function ol(...items: (Segment[] | string)[]): RichContent {
  return {
    type: 'orderedList',
    attrs: { start: 1 },
    content: items.map((item) => ({ type: 'listItem', content: [p(...(typeof item === 'string' ? [item] : item))] })),
  };
}
function ul(...items: (Segment[] | string)[]): RichContent {
  return {
    type: 'bulletList',
    content: items.map((item) => ({ type: 'listItem', content: [p(...(typeof item === 'string' ? [item] : item))] })),
  };
}
function doc(...content: RichContent[]): RichContent {
  return { type: 'doc', content };
}
const b = (text: string) => ({ b: text });
const em = (text: string) => ({ em: text });

function item(
  id: string,
  type: ExplorerItem['type'],
  name: string,
  parentId: string | null,
  order: number,
  extra: Partial<ExplorerItem> = {},
): ExplorerItem {
  return { id, projectId: PID, type, name, icon: null, color: null, parentId, order, createdAt: T0, updatedAt: T0, ...extra };
}

function recipe(id: string, content: RichContent, extra: Partial<Recipe> = {}): Recipe {
  return { id, projectId: PID, content, coverAssetId: null, coverUrl: null, servings: '', time: '', publicFileId: null, updatedAt: T0, ...extra };
}

/**
 * With a `suffix`, every id gets it appended, so tutorial copies created on different devices
 * (or twice by the same person) never collide once synced to the same Drive.
 */
export function buildTutorialBundle(suffix?: string): ProjectBundle {
  const bundle = buildBaseBundle();
  if (!suffix) return bundle;
  const json = JSON.stringify(bundle).replace(/"((?:project|folder|recipe)_[a-z0-9_]+)"/g, (_, id: string) => `"${id}_${suffix}"`);
  return JSON.parse(json) as ProjectBundle;
}

function buildBaseBundle(): ProjectBundle {
  blockCounter = 0;
  const F = { start: 'folder_tut_start', savory: 'folder_tut_savory', sweet: 'folder_tut_sweet', drinks: 'folder_tut_drinks' };
  const R = {
    howto: 'recipe_tut_howto',
    share: 'recipe_tut_share',
    paoDeQueijo: 'recipe_tut_pao_de_queijo',
    bolo: 'recipe_tut_bolo_cenoura',
    brigadeiro: 'recipe_tut_brigadeiro',
    limonada: 'recipe_tut_limonada',
  };

  const items: ExplorerItem[] = [
    item(F.start, 'folder', 'Comece aqui', null, 1024, { icon: 'sparkles', color: 'saffron' }),
    item(R.howto, 'recipe', 'Como usar o CookMe', F.start, 1024, { icon: 'chef-hat', color: 'saffron' }),
    item(R.share, 'recipe', 'Compartilhar e instalar', F.start, 2048, { icon: 'send', color: 'saffron' }),
    item(F.savory, 'folder', 'Salgados', null, 2048, { icon: 'cooking-pot', color: 'tomato' }),
    item(R.paoDeQueijo, 'recipe', 'Pão de queijo mineiro', F.savory, 1024, { icon: 'croissant', color: 'saffron' }),
    item(F.sweet, 'folder', 'Doces', null, 3072, { icon: 'cake-slice', color: 'beet' }),
    item(R.bolo, 'recipe', 'Bolo de cenoura com chocolate', F.sweet, 1024, { icon: 'carrot', color: 'carrot' }),
    item(R.brigadeiro, 'recipe', 'Brigadeiro de panela', F.sweet, 2048, { icon: 'candy', color: 'cocoa' }),
    item(F.drinks, 'folder', 'Bebidas', null, 4096, { icon: 'cup-soda', color: 'blueberry' }),
    item(R.limonada, 'recipe', 'Limonada suíça', F.drinks, 1024, { icon: 'citrus', color: 'basil' }),
  ];

  const recipes: Recipe[] = [
    recipe(
      R.howto,
      doc(
        p(
          'Bem-vindo ao ',
          b('CookMe'),
          '! Este caderno é um espaço de testes: mexa à vontade. Ele se atualiza sozinho a cada versão, então guarde suas receitas de verdade num caderno seu.',
        ),
        h(SECTION_TITLES.ingredients),
        tasks(
          '1 caderno de receitas (crie quantos quiser na tela inicial)',
          'Pastas a gosto, com ícone e cor',
          'Uma foto bonita para a capa',
          'Ingredientes, um por linha',
          'O passo a passo, numerado',
          'Áudios e fotos dos passos (opcional)',
        ),
        p(em('Toque no quadradinho ao lado de cada ingrediente para marcar o que já separou.')),
        h(SECTION_TITLES.steps),
        ol(
          [b('Crie uma receita'), ': toque em “+ Receita” no rodapé da lista ou no “+” ao lado de uma pasta. Ela já vem com Ingredientes, Modo de preparo e Dicas, prontos para preencher.'],
          [b('Coloque a foto de capa'), ': toque na área da foto no topo da receita. Dá para tirar na hora, escolher da galeria ou colar um link.'],
          [b('Preencha tempo e porções'), ' logo abaixo do título. É texto livre: “50 min”, “1h30”, “8 fatias”.'],
          [b('Escreva os ingredientes'), ': cada Enter cria uma nova linha. Para tirar o quadradinho, use o botão de lista na barra.'],
          [b('Escreva o passo a passo'), ': cada Enter cria o próximo passo, já numerado.'],
          [b('Digite “/”'), ' em qualquer linha para inserir título, lista, foto, áudio ou separador. Fotos e áudios também ficam nos botões da barra.'],
          [b('Organize'), ': arraste receitas e pastas na lista para reordenar ou mover. No celular, segure o item por um instante e arraste. No menu ⋯ de cada item há Renomear, Ícone e cor, Mover para… e Excluir.'],
          [b('Cozinhe'), ': o botão “Cozinhar” abre o passo a passo em tela cheia, com letra grande e a tela sempre acesa.'],
        ),
        h(SECTION_TITLES.tips),
        ul(
          [b('Busca'), ': a lupa (ou Ctrl+K) encontra receitas pelo nome ou por qualquer ingrediente.'],
          [b('Salvamento'), ': tudo é salvo sozinho, no próprio aparelho, e funciona sem internet.'],
          [b('Google Drive'), ': entrando com o Google, seus cadernos ficam na pasta “CookMe” do seu Drive e aparecem em todos os seus aparelhos.'],
        ),
      ),
      { time: '5 min', servings: 'Você e quem mais cozinhar' },
    ),
    recipe(
      R.share,
      doc(
        h('Mandar uma receita para alguém'),
        p('No botão de compartilhar de uma receita aberta há quatro jeitos:'),
        ol(
          [b('Link público'), ': cria um link que qualquer pessoa abre no navegador, sem conta. Ele acompanha as suas edições, e quem abre pode salvar uma cópia no próprio CookMe. Dá para desativar quando quiser. (Precisa entrar com o Google.)'],
          [b('Imagem (WhatsApp)'), ': gera um cartão com a foto, os ingredientes e o modo de preparo. No celular, abre direto o WhatsApp ou o app que você escolher.'],
          [b('Story do Instagram'), ': uma imagem no formato do Story, com a foto, o tempo e os ingredientes.'],
          [b('Enviar arquivo CookMe'), ': gera um arquivo “.cookme” com tudo, inclusive fotos e áudios. Quem recebe usa “Importar receita” no próprio CookMe e ganha uma cópia editável.'],
        ),
        h('Instalar no celular'),
        ul(
          [b('Android'), ': no Chrome, menu ⋮ → “Instalar app” ou “Adicionar à tela inicial”.'],
          [b('iPhone'), ': no Safari, botão Compartilhar → “Adicionar à Tela de Início”.'],
          [b('Computador'), ': no Chrome ou no Edge, ícone de instalar na barra de endereço.'],
        ),
        p('Instalado, o CookMe abre na própria janela e funciona sem internet. Veja também “Sobre o CookMe”, no ⓘ do rodapé.'),
      ),
    ),
    recipe(
      R.paoDeQueijo,
      doc(
        h(SECTION_TITLES.ingredients),
        tasks(
          '500 g de polvilho azedo',
          '1 xícara (240 ml) de leite',
          '½ xícara (120 ml) de óleo',
          '1 colher (chá) de sal',
          '2 ovos',
          '200 g de queijo meia cura ralado (ou parmesão)',
        ),
        h(SECTION_TITLES.steps),
        ol(
          'Ferva o leite com o óleo e o sal.',
          'Despeje sobre o polvilho e misture bem com uma colher até escaldar tudo. Deixe amornar.',
          'Junte os ovos, um de cada vez, sovando até a massa ficar lisa e grudar levemente nas mãos.',
          'Acrescente o queijo e misture até incorporar.',
          'Com as mãos untadas, faça bolinhas de 3 cm e coloque numa assadeira, com espaço entre elas.',
          'Asse em forno preaquecido a 200 °C por 25 a 30 minutos, até dourar.',
        ),
        h(SECTION_TITLES.tips),
        p('Dá para congelar as bolinhas cruas numa assadeira e depois guardar num saco. Asse direto do congelador, com uns 10 minutos a mais.'),
      ),
      { time: '50 min', servings: '40 unidades' },
    ),
    recipe(
      R.bolo,
      doc(
        h(SECTION_TITLES.ingredients),
        h('Massa', 3),
        tasks('3 cenouras médias, descascadas e picadas', '3 ovos', '1 xícara de óleo', '2 xícaras de açúcar', '2 ½ xícaras de farinha de trigo', '1 colher (sopa) de fermento em pó'),
        h('Cobertura', 3),
        tasks('1 colher (sopa) de manteiga', '3 colheres (sopa) de chocolate em pó', '1 xícara de açúcar', '5 colheres (sopa) de leite'),
        h(SECTION_TITLES.steps),
        ol(
          'Bata no liquidificador as cenouras, os ovos e o óleo até ficar bem liso.',
          'Numa tigela, misture o creme com o açúcar e a farinha. Por último, o fermento, delicadamente.',
          'Despeje numa forma untada e enfarinhada e asse a 180 °C por cerca de 40 minutos (faça o teste do palito).',
          'Para a cobertura, leve tudo ao fogo baixo, mexendo até engrossar um pouco.',
          'Espalhe a cobertura ainda quente sobre o bolo morno.',
        ),
        h(SECTION_TITLES.tips),
        p('Este exemplo mostra que dá para dividir os ingredientes em partes (Massa e Cobertura) usando subtítulos: digite “/” e escolha Subtítulo.'),
      ),
      { time: '1h10', servings: '12 fatias' },
    ),
    recipe(
      R.brigadeiro,
      doc(
        h(SECTION_TITLES.ingredients),
        tasks('1 lata de leite condensado', '1 colher (sopa) de manteiga', '3 colheres (sopa) de chocolate em pó 50%', 'Chocolate granulado para enrolar'),
        h(SECTION_TITLES.steps),
        ol(
          'Numa panela, misture o leite condensado, a manteiga e o chocolate em pó.',
          'Cozinhe em fogo baixo, mexendo sem parar, por uns 10 minutos.',
          'Está no ponto quando, ao inclinar a panela, a massa desgruda do fundo inteira.',
          'Passe para um prato untado e deixe esfriar.',
          'Com as mãos untadas, enrole as bolinhas e passe no granulado.',
        ),
        h(SECTION_TITLES.tips),
        p('Para comer de colher, desligue o fogo um pouco antes do ponto de enrolar.'),
      ),
      { time: '30 min', servings: '25 unidades' },
    ),
    recipe(
      R.limonada,
      doc(
        h(SECTION_TITLES.ingredients),
        tasks('2 limões-taiti', '1 litro de água gelada', '6 colheres (sopa) de açúcar', '5 colheres (sopa) de leite condensado (opcional)', 'Gelo a gosto'),
        h(SECTION_TITLES.steps),
        ol(
          'Lave bem os limões e corte cada um em 8 pedaços, tirando o miolo branco do centro.',
          'Bata no liquidificador com a água e o açúcar, só por uns 10 segundos (pulsando).',
          'Coe numa peneira, apertando bem.',
          'Volte ao liquidificador com o leite condensado, se quiser, e bata rapidinho.',
          'Sirva na hora, com bastante gelo.',
        ),
        h(SECTION_TITLES.tips),
        p('Não bata demais: a casca deixa a limonada amarga.'),
      ),
      { time: '10 min', servings: '4 copos' },
    ),
  ];

  return {
    project: {
      id: PID,
      name: 'Caderno de exemplo',
      kind: 'tutorial',
      contentVersion: TUTORIAL_VERSION,
      schemaVersion: SCHEMA_VERSION,
      description: 'Aprenda usando. Ele se atualiza sozinho a cada versão: teste à vontade, mas guarde suas receitas num caderno seu.',
      createdAt: T0,
      updatedAt: T0,
    },
    items,
    recipes,
    assets: [],
  };
}
