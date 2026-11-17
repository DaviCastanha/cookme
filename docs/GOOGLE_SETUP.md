# Configurar o Google (login + Drive) e publicar na Vercel

Com o Google configurado, o CookMe pede login, e cada pessoa que entra guarda os cadernos de receitas **no próprio Google Drive**, numa pasta "CookMe". Sem essa configuração (por exemplo, em desenvolvimento local), o app roda em **modo local**, salvando apenas no navegador.

## 1. Projeto no Google Cloud

1. Acesse <https://console.cloud.google.com/>. Crie um projeto novo (recomendado, para o login mostrar o nome “CookMe”) ou reaproveite o do StoryForge/TrackMe.
2. Em **APIs e serviços → Biblioteca**, ative a **Google Drive API**. No projeto do TrackMe ela já está ativa.

## 2. Tela de consentimento OAuth

No menu **Google Auth Platform**:

1. **Branding:** nome do app `CookMe`, e-mail de suporte, logo (opcional: `public/icon-512.png`) e os links do app, que já existem no próprio site:
   - Página inicial: `https://cookme-recipes.vercel.app`
   - Política de Privacidade: `https://cookme-recipes.vercel.app/privacidade`
   - Termos de Serviço: `https://cookme-recipes.vercel.app/termos`
   - Domínios autorizados: `cookme-recipes.vercel.app`

   Para as duas páginas mostrarem um e-mail de contato (em vez de “o e-mail de suporte exibido na tela de login do Google”), defina `NEXT_PUBLIC_CONTACT_EMAIL` na Vercel e faça um novo deploy.
2. **Público (Audience):** tipo **Externo**. Enquanto estiver em **Teste**, adicione em *Usuários de teste* os e-mails que vão usar o app.
3. **Acesso a dados (Data access):** adicione os escopos
   - `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   - `https://www.googleapis.com/auth/drive.file`, que dá acesso **somente aos arquivos que o CookMe cria**.

> **Modo Teste × Produção:**
> - **Em Teste:** só os usuários de teste conseguem entrar, e a autorização expira a cada **7 dias**. Depois disso, a pessoa precisa entrar de novo.
> - **Para abrir a qualquer pessoa sem expiração:** clique em **Publicar app**. O `drive.file` é um escopo não sensível, então não é preciso fazer a auditoria de segurança exigida para escopos restritos.
> - **Aviso “app não verificado”:** o Google pode mostrá-lo até a verificação da marca ser concluída.
>
> Se você reaproveitar o projeto do TrackMe, a tela de consentimento é compartilhada entre os dois apps. Para que o login mostre o nome “CookMe”, prefira um projeto próprio.

## 3. Credencial OAuth

Em **Clientes → Criar cliente**:

- Tipo: **Aplicativo da Web**
- **URIs de redirecionamento autorizados:**
  - `http://localhost:3000/api/auth/callback`
  - `https://cookme-recipes.vercel.app/api/auth/callback`

> O caminho é `/api/auth/callback`, diferente do TrackMe (`/api/auth/callback/google`), porque o CookMe (assim como o StoryForge) não usa o NextAuth.

Copie o **ID do cliente** e a **chave secreta**.

## 4. Variáveis de ambiente

| Variável | Valor |
| --- | --- |
| `APP_URL` | `http://localhost:3000` (local) ou `https://cookme-recipes.vercel.app` (produção), sem barra no final |
| `GOOGLE_CLIENT_ID` | ID do cliente |
| `GOOGLE_CLIENT_SECRET` | Chave secreta |
| `SESSION_SECRET` | 32+ caracteres aleatórios. Gere com o comando abaixo |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Opcional. E-mail de contato da Política de Privacidade e dos Termos |
| `GOOGLE_API_KEY` | Recomendado para links públicos (veja abaixo) |

**Chave de API para os links públicos.** A página `/r/<id>` lê a cópia pública da receita sem login. Com uma chave de API ela usa a API oficial do Drive; sem chave, usa o endereço público de download do Google, que funciona mas é menos garantido. Para criar a chave: **APIs e serviços → Credenciais → Criar credenciais → Chave de API**. Depois, em **Restrições de API**, permita só a **Google Drive API**. Ela não dá acesso a nenhum arquivo privado: só lê o que já está como "qualquer pessoa com o link".

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- **Local:** coloque as variáveis em `.env.local`, que não vai para o git.
- **Vercel:** cadastre-as em **Project → Settings → Environment Variables** e faça um novo deploy.

## 5. Vercel

1. **Add New → Project**, e importe o repositório do GitHub. O framework é detectado como Next.js, sem configuração extra.
2. Cadastre as 4 variáveis do passo 4.
3. Depois do primeiro deploy, confira se o domínio gerado bate com o `APP_URL` e com o redirect cadastrado no passo 3.

## Como funciona para quem usa

- A pessoa entra com Google e aceita **uma** tela de consentimento (identidade + Drive).
- Os cadernos ficam em `Meu Drive/CookMe/cadernos/` (receitas em `receitas/`, fotos e áudios em `arquivos/`) e são baixados automaticamente ao entrar em outro aparelho.
- O app salva localmente na hora e funciona offline. A sincronização com o Drive acontece em segundo plano.
- Cada conta tem o próprio cache local, então duas pessoas no mesmo navegador não veem os cadernos uma da outra.
- Se a pessoa desmarcar a permissão do Drive na tela do Google, o app avisa e oferece **Permitir acesso ao Drive**.

## Segurança

- Os tokens do Google ficam **somente no servidor**, num cookie `httpOnly` criptografado (AES-256-GCM com `SESSION_SECRET`). O navegador nunca os vê, e eles nunca vão para os arquivos dos cadernos.
- O navegador fala com o Drive pelo proxy `/api/drive/*`, que recusa requisições de outras origens.
- Excluir um caderno ou receita **move o arquivo para a lixeira** do Drive, de onde dá para recuperar.
