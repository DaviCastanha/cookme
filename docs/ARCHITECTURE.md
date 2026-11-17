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

- **Como imagem**: um cartão PNG (1080 px de largura) desenhado num `<canvas>` no próprio aparelho (`features/share/shareImage.ts`), com foto, título, tempo, seções e passos. Abre a folha de compartilhamento do sistema (WhatsApp, Instagram…) via Web Share API; sem suporte, baixa o arquivo.
- **Arquivo `.cookme`**: JSON com a receita e as fotos/áudios embutidos em base64 (`features/share/recipeFile.ts`). Quem recebe usa **Importar receita**; o app cria uma cópia com ids novos. Como algumas folhas de compartilhamento só aceitam certos tipos, o app tenta `.cookme` e depois `.cookme.txt`; a importação aceita os dois.
- **Link público**: ficou para depois (ver README).

### 7. Layout

PC/tablet: lista de pastas e receitas à esquerda (redimensionável, Ctrl+\ esconde) e a receita aberta à direita. Celular: duas telas (lista → receita), com "voltar" na barra da receita. Uma receita aberta por vez; não há abas.

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
      arquivos/fotos/<assetId>.jpg
      arquivos/audios/<assetId>.m4a
```

## Testes

`npm test` cobre: repositório (seções da receita nova, exclusão em cascata, duplicar, gravações concorrentes), conteúdo (seções, plano de cozinha, timers), novidades/versão e a sincronização ponta a ponta com um Drive simulado (dois "aparelhos", fotos, exclusões e conflitos).

> No Windows, rode os testes pelo PowerShell ou CMD. No Git Bash, a diferença de maiúscula na letra do drive (`c:` vs `C:`) faz o Vitest carregar dois módulos e falhar com "failed to find the runner".
