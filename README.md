# CookMe

Caderno de receitas pessoal: pastas com ícone e cor, foto de capa, ingredientes para ir marcando, passo a passo com fotos e áudios, modo Cozinhar e compartilhamento como imagem. Salva no navegador e, com login Google, no seu próprio Google Drive.

> Feito sobre a base do StoryForge. Decisões e diferenças: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Como rodar

Requer **Node 20.9+** (há um `.nvmrc` com `22`).

```bash
npm install
npm run dev          # http://localhost:3000
```

**Sem Google configurado (modo local):** o app cria o **Caderno de exemplo** e salva tudo no navegador. É o mais prático para desenvolver.

**Com Google configurado (como na Vercel):** o login é obrigatório, e cada pessoa guarda os cadernos na pasta `CookMe` do próprio Google Drive. Para configurar o Google Cloud, as variáveis e o deploy (ex.: `cookme-receitas.vercel.app`), siga [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md).

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run typecheck` | Verificação de tipos |
| `npm test` | Testes (repositório, conteúdo das receitas, timers, novidades e sincronização com um Drive simulado) |
| `node scripts/generate-icons.mjs` | Gera o favicon e os ícones do app instalável |

O service worker (app instalável e offline) só é registrado no build de produção.

## Versões e novidades

A versão fica em `package.json` e em `src/content/releases.ts`, que guarda as notas do popup **Novidades** (um teste garante que as duas coincidem). A cada atualização:

1. Acrescente uma entrada no topo de `RELEASES`, escrita para quem usa o app, e atualize `"version"` no `package.json`.
2. Se o caderno de exemplo mudou, aumente `TUTORIAL_VERSION` e a data `T0` (no passado) em `src/lib/mock/seed.ts`. As cópias de todo mundo são atualizadas sozinhas.

O popup aparece uma vez por versão em cada aparelho; quem acabou de chegar não vê (tudo é novo para essa pessoa).

## O que já funciona (1.0.0)

- **Cadernos**: criar, renomear, excluir, exportar/importar backup. O app abre direto no último caderno usado.
- **Pastas e receitas**: árvore com ícone e cor (ícones de comida, cores com nome de ingrediente), arrastar e soltar, Mover para…, Duplicar, renomear com F2 ou duplo clique, contagem de receitas por pasta.
- **Receita**:
  - foto de capa em destaque (câmera, galeria ou link), reduzida automaticamente;
  - tempo e rendimento em texto livre;
  - receita nova já com **Ingredientes** (lista para marcar), **Modo de preparo** (passos numerados) e **Dicas**, sem texto, só com dicas de preenchimento;
  - menu `/` e barra com seção, subtítulo, listas, destaque, foto e áudio; fotos coladas ou arrastadas também entram;
  - salvamento automático.
- **Modo Cozinhar**: ingredientes para marcar, um passo por tela, letra grande, tela sempre acesa, timer automático quando o passo cita um tempo.
- **Compartilhar**: cartão-imagem para WhatsApp/Instagram e arquivo `.cookme` (com fotos e áudios) para importar no CookMe de outra pessoa.
- **Busca** (Ctrl+K ou barra de busca): por nome, pasta ou ingrediente, levando ao trecho.
- **Google Drive**: login com um consentimento, pasta visível `CookMe`, sincronização entre aparelhos, offline, tratamento de conflitos.
- **App instalável** (PWA) no computador e no celular.

## Fica para depois

- **Link público de receita**: o arquivo da receita já está no Drive da pessoa; dá para torná-lo "qualquer pessoa com o link" e servir uma página de leitura (`/r/<id>`) lendo o Drive com uma chave de API, sem banco de dados próprio.
- Ajustar porções (recalcular quantidades) e lista de compras a partir dos ingredientes marcados.
- Cartão no formato Story (1080×1920) para o Instagram.
- Ler foto de receita escrita à mão (OCR).
- Tags além das pastas, favoritos e tema escuro.
