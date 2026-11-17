# Arquitetura e decisões

O CookMe nasceu de uma cópia do StoryForge (v1.1.0). A base é a mesma: local-first, sincronização com o Google Drive, login com um consentimento só, PWA e popup de novidades. Este documento registra o que foi mantido, o que mudou e por quê.

## Camadas

```text
Componentes (UI)  ──usa──▶  features/* (domínio, hooks, ações)
                                 │
                                 ▼
                     lib/repository (única porta de escrita)
                                 │ grava                ▲ lê (useLiveQuery)
                                 ▼                      │
                          IndexedDB (Dexie) ────────────┘
                                 │ fila syncQueue
                                 ▼
                 features/sync/syncEngine (segundo plano)
                                 │ fetch
                                 ▼
               /api/drive/* (servidor, com tokens) ──▶ Google Drive
```

- Componentes não falam com o Dexie nem com o Drive. Eles leem pelo `ProjectDataProvider` e escrevem por ações (`useWorkspaceActions`) ou pelo repositório.
- O estado de interface (receita aberta, painel, modo cozinhar, busca) fica no Zustand (`stores/workspaceStore`).

## Vocabulário

| Na interface | No código | No Drive |
| --- | --- | --- |
| Caderno | `Project` (`projects`) | `cadernos/<id>/caderno.json` |
| Pastas e receitas (a árvore) | `ExplorerItem` (`items`), tipos `folder` e `recipe` | `pastas.json` |
| Receita (corpo, capa, tempo, rendimento) | `Recipe` (`recipes`) | `receitas/<id>.json` |
| Foto / áudio | `Asset` + blob | `arquivos/fotos/…`, `arquivos/audios/…`, índice em `arquivos.json` |

O nome interno "project" foi mantido para reaproveitar o motor de sincronização do StoryForge sem reescrevê-lo.

## Decisões

### 1. Local-first (igual ao StoryForge)

O IndexedDB é a fonte de verdade no aparelho; cada gravação enfileira o arquivo afetado (`syncQueue`, uma entrada por arquivo) e o motor envia em segundo plano. Funciona offline. Conflitos: a versão local vence e a do Drive vira `<arquivo>.conflict-<data>.json` na mesma pasta.

### 2. Receita = um documento Tiptap com seções prontas

Como no StoryForge, o corpo é texto livre editável (Tiptap). Uma receita nova já nasce com:

- **Ingredientes**: lista de tarefas (`taskList`), para ir marcando enquanto separa;
- **Modo de preparo**: lista numerada (`orderedList`), estilizada como passos;
- **Dicas**: parágrafo.

As seções são só títulos (`heading` nível 2) e listas comuns: a pessoa pode renomear, apagar, criar outras ("Cobertura") ou dividir com subtítulos (nível 3). Os textos de ajuda das linhas vazias vêm do `Placeholder`, conforme o contexto (ingrediente, passo, dica), então a receita nova não tem texto nenhum gravado.

Fora do corpo ficam só **foto de capa**, **tempo** e **rendimento** (texto livre), no próprio `Recipe`. O nome fica no explorador, como no StoryForge (renomear altera um lugar só).

`features/recipes/content.ts` lê o JSON sem editor aberto: seções e linhas (`getSections`), ingredientes e passos para o modo cozinhar (`getCookingPlan`), fotos e áudios usados (`getAssetIds`).

### 3. Salvar corpo e metadados sem sobrescrever um ao outro

O editor salva o corpo com atraso (autosave); capa/tempo/rendimento são salvos na hora. As duas gravações fazem leitura + escrita **dentro de uma transação** do IndexedDB (`saveRecipeContent` e `saveRecipe`), então uma nunca apaga a outra. Há teste para isso.

### 4. Fotos reduzidas antes de salvar

Fotos de celular (4–12 MB) são reduzidas para no máximo 1800 px e regravadas em JPEG 85% (`lib/utils/image.ts`). GIFs, SVGs e imagens pequenas ficam como estão. Isso deixa o caderno leve no aparelho e no Drive.

### 5. Modo Cozinhar

Tela cheia sobre o app (`components/recipe/CookingMode.tsx`): primeiro os ingredientes para marcar, depois um passo por tela, com letra grande, deslizar ou setas para navegar, e a tela sempre acesa (Wake Lock, quando o navegador permite). Passos que citam um tempo ("25 a 30 minutos", "1h30") ganham um botão de timer (`features/recipes/timers.ts`; numa faixa, vale o maior valor). As marcações do modo cozinhar não são salvas: é uma folha de rascunho.

### 6. Compartilhar

- **Como imagem**: PNG desenhado num `<canvas>` no próprio aparelho (`features/share/shareImage.ts`). Dois formatos: **cartão** (1080 px de largura, altura variável, receita inteira) e **Story** (1080×1920: foto, título, tempo e ingredientes; a fonte diminui um pouco para listas longas e o resto vira "+ N ingredientes"; o rodapé fica fora dos ~250 px que o Instagram cobre). Abre a folha de compartilhamento do sistema via Web Share API; sem suporte, baixa o arquivo.
- **Arquivo `.cookme`**: JSON com a receita e as fotos/áudios embutidos em base64 (`features/share/recipeFile.ts`). Quem recebe usa **Importar receita**; o app cria uma cópia com ids novos. Como algumas folhas de compartilhamento só aceitam certos tipos, o app tenta `.cookme` e depois `.cookme.txt`; a importação aceita os dois.

### 6b. Link público, sem banco de dados

- **Criar** (`syncEngine.publish`): envia as mudanças pendentes, grava uma **cópia pública** em `cadernos/<id>/publicas/<receitaId>.json` (nome, capa, tempo, rendimento, corpo e o id no Drive de cada foto/áudio) e marca a cópia e essas fotos como "qualquer pessoa com o link" (`/api/drive/share`, permissão `anyone`/`reader`, sem aparecer em buscas). O id da cópia vai para `Recipe.publicFileId`, então os outros aparelhos também sabem que o link existe.
- **Atualizar**: sempre que a receita é enviada ao Drive e tem `publicFileId`, o motor regrava a cópia (`refreshPublicCopies`). Só fotos ainda não compartilhadas geram chamadas de permissão (lista em `meta`, `public:<receitaId>`).
- **Desativar** (`unpublish`): a cópia vai para a lixeira e as fotos voltam a ser privadas. Excluir a receita também manda a cópia para a lixeira (unidade `public:<fileId>` na fila).
- **Página** `/r/<fileId>` (servidor, `lib/server/publicDrive.ts`): lê a cópia pública com `GOOGLE_API_KEY` (API oficial) ou, sem chave, pelo download público do Google; revalida a cada 60 s. Fotos e áudios passam por `/r/<id>/arquivo/<assetId>`, que só entrega arquivos listados naquela cópia (não é um proxy aberto do Drive) e deixa o CDN guardar. `/r/<id>/cookme` monta um `.cookme` para "Salvar no meu CookMe". O corpo é renderizado no servidor por `components/public/RecipeContent.tsx` com as mesmas classes `.cm-prose` do editor; links só `http(s)`.
- A cópia pública é separada do arquivo da receita para que o arquivo original (e o resto do caderno) continue privado.

### 7. Layout

PC/tablet: lista de pastas e receitas à esquerda (redimensionável, Ctrl+\ esconde) e a receita aberta à direita. Celular: duas telas trocadas pela barra inferior (Receitas · receita aberta · Buscar); a seta "voltar" da receita só mostra a lista, sem fechar a receita. Uma receita aberta por vez; não há abas.

No celular, o arrastar e soltar do HTML não funciona com o dedo. A lista usa "segurar e arrastar" (`useTouchDrag` em `ExplorerTree.tsx`): segurar parado por ~0,4 s pega o item (vibra), e um deslize rápido continua rolando a lista. Enquanto arrasta, a página não rola, a lista rola sozinha nas bordas e um rótulo segue o dedo. Em pastas, o terço de cima insere antes e o resto solta dentro. O menu de contexto do toque longo é ignorado (o menu fica no ⋯).

### 7b. Temas de cores

Os componentes só usam variáveis CSS (`styles/_tokens.scss`). Tudo o que um tema pode mudar (cores, paleta das pastas, sombras, cantos e a fonte dos títulos) fica no mixin `theme-defaults`, que é o tema Terracota e é aplicado no `:root`. Cada tema em `styles/_themes.scss` é um bloco `[data-theme='…']` que inclui esse mixin e sobrescreve o que muda. Anel de foco, realce, sombras coloridas e o destaque dos toasts são derivados da cor principal com `color-mix`, então um tema novo só precisa das cores-base.

- **Lista** em `features/theme/themes.ts` (nome, descrição, cor de fundo para o `theme-color` do navegador). Um teste confere que a lista e o SCSS batem.
- **Sem piscar**: um script inline no `<head>` (`themeBootScript`) lê `localStorage` e põe `data-theme` no `<html>` antes da primeira pintura, como manda o guia "Preventing flash before hydration" do Next; o `<html>` tem `suppressHydrationWarning`. `ThemeSync` reaplica depois da hidratação e acompanha outras abas.
- **Prévia ao vivo**: o seletor (Configurações → Tema) desenha cada cartão com o próprio `data-theme`. Como todo bloco parte do mixin, uma prévia não herda nada do tema em uso.
- **Por aparelho**, não sincronizado: o tema é preferência de tela, como a largura do painel.
- **Café** é o tema escuro: `color-scheme: dark`, textos sobre a cor principal ficam escuros (`--color-on-primary`, `--color-on-danger`) e os fundos das cores de pasta viram tons escuros da mesma cor.
- A imagem de compartilhar mantém as cores padrão, para a receita ter a mesma cara para quem recebe. A página pública `/r/<id>` segue o tema salvo no navegador de quem abre (o padrão, para quem nunca usou o CookMe).

### 8. Abrir direto no último caderno

`/` redireciona para o último caderno usado neste aparelho (`lib/utils/routes.ts`). **Todos os cadernos** leva a `/?inicio=1`, que mostra a lista sem redirecionar.

### 9. Caderno de exemplo atualizado no lugar

Como o tutorial do StoryForge: `kind: 'tutorial'` + `contentVersion`. Quando `TUTORIAL_VERSION` cresce, cada cópia é substituída pelo conteúdo novo, mantendo o id. O conteúdo é determinístico (ids e datas fixas, `T0` sempre no passado), então dois aparelhos que atualizam a mesma cópia enviam arquivos idênticos.

### 10. O que saiu do StoryForge

Cenas, fichas, Conectar/citações, painel de referências, modelos/biblioteca, abas e transcrição de voz. Os áudios continuam (gravar ou enviar arquivo), sem transcrição.

## Layout no Google Drive

```text
Meu Drive/
  CookMe/
    app-index.json                  lista de cadernos (inclui excluídos, para propagar)
    cadernos/<id>/
      caderno.json  pastas.json  arquivos.json
      receitas/<receitaId>.json
      publicas/<receitaId>.json     cópia pública (só existe com o link ativo)
      arquivos/fotos/<assetId>.jpg
      arquivos/audios/<assetId>.m4a
```

## Testes

`npm test` cobre: repositório (seções da receita nova, exclusão em cascata, duplicar, gravações concorrentes), conteúdo (seções, plano de cozinha, timers), novidades/versão e a sincronização ponta a ponta com um Drive simulado (dois "aparelhos", fotos, exclusões e conflitos).

> No Windows, rode os testes pelo PowerShell ou CMD. No Git Bash, a diferença de maiúscula na letra do drive (`c:` vs `C:`) faz o Vitest carregar dois módulos e falhar com "failed to find the runner".
