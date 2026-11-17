import type { Metadata } from 'next';
import { ContactLine, LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Política de Privacidade · CookMe' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updated="16 de novembro de 2026">
      <p>
        O CookMe é um aplicativo para guardar e organizar receitas. Esta política explica quais dados o app acessa, como
        eles são usados e onde ficam guardados.
      </p>

      <h2>1. Dados que acessamos</h2>
      <ul>
        <li>
          <strong>Dados da sua conta Google</strong>: nome, endereço de e-mail e foto de perfil, obtidos no login, apenas
          para identificar você no app.
        </li>
        <li>
          <strong>Google Drive (escopo <code>drive.file</code>)</strong>: o app só consegue ver e alterar os arquivos que
          ele mesmo cria, dentro da pasta “CookMe” no seu Drive. Ele não tem acesso aos seus outros arquivos.
        </li>
        <li>
          <strong>Conteúdo que você cria</strong>: cadernos, pastas, receitas, fotos e áudios que você adiciona no app.
        </li>
        <li>
          <strong>Câmera e microfone</strong>: usados somente quando você tira uma foto ou grava um áudio, depois de
          autorizar no navegador. A foto e o áudio são salvos como arquivos no seu caderno e no seu Google Drive e não são
          enviados para outros serviços.
        </li>
        <li>
          <strong>Compartilhamento</strong>: a imagem e o arquivo de uma receita são gerados no seu aparelho e só saem dele
          quando você os envia, pelo app que escolher (WhatsApp, Instagram, e-mail…).
        </li>
      </ul>

      <h2>2. Onde os dados ficam</h2>
      <ul>
        <li>
          <strong>No seu Google Drive</strong>, na pasta “CookMe”, sob o controle da sua conta.
        </li>
        <li>
          <strong>No seu navegador</strong> (IndexedDB), como cópia local para o app funcionar rápido e offline.
        </li>
      </ul>
      <p>
        O CookMe <strong>não mantém banco de dados próprio</strong> com o seu conteúdo. Quando o app sincroniza com o
        Drive, os arquivos passam pelo servidor do CookMe (hospedado na Vercel) apenas para serem encaminhados à API do
        Google, sem serem armazenados.
      </p>
      <p>
        As credenciais de acesso ao Google ficam em um cookie criptografado no seu navegador, legível apenas pelo servidor do
        app. Elas nunca são gravadas nos seus arquivos nem compartilhadas.
      </p>

      <h2>3. Como usamos os dados</h2>
      <p>
        Os dados são usados exclusivamente para oferecer as funções do app: exibir sua conta, salvar e sincronizar seus
        cadernos entre aparelhos. Não vendemos, alugamos nem compartilhamos dados com terceiros, não exibimos anúncios e
        não usamos seus dados para treinar modelos de inteligência artificial.
      </p>
      <p>
        O uso e a transferência, para qualquer outro app, de informações recebidas das APIs do Google seguem a{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Política de Dados do Usuário dos Serviços de API do Google
        </a>
        , incluindo os requisitos de Uso Limitado.
      </p>

      <h2>4. Serviços de terceiros</h2>
      <ul>
        <li>
          <strong>Google</strong> (login e Drive), sujeito à{' '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
            Política de Privacidade do Google
          </a>
          .
        </li>
        <li>
          <strong>Vercel</strong> (hospedagem), que pode registrar dados técnicos de acesso, como endereço IP e data da
          requisição, para operação e segurança do serviço.
        </li>
      </ul>

      <h2>5. Seus controles</h2>
      <ul>
        <li>
          <strong>Revogar o acesso</strong> a qualquer momento em{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
            myaccount.google.com/permissions
          </a>
          .
        </li>
        <li>
          <strong>Apagar seus dados</strong> excluindo a pasta “CookMe” do seu Google Drive e limpando os dados do site
          no seu navegador.
        </li>
        <li>
          <strong>Exportar</strong> um caderno a qualquer momento em Configurações → Exportar backup.
        </li>
      </ul>

      <h2>6. Alterações</h2>
      <p>
        Esta política pode ser atualizada. A data no topo indica a versão vigente; mudanças relevantes serão informadas no
        app.
      </p>

      <h2>7. Contato</h2>
      <p>
        Dúvidas sobre privacidade: <ContactLine />.
      </p>
    </LegalPage>
  );
}
