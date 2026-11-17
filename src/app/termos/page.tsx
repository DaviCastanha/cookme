import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactLine, LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Termos de Uso · CookMe' };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updated="16 de novembro de 2026">
      <p>Ao usar o CookMe, você concorda com estes termos.</p>

      <h2>1. O serviço</h2>
      <p>
        O CookMe é uma ferramenta gratuita para guardar e organizar receitas, com os dados salvos
        no Google Drive da sua própria conta. O serviço é oferecido “como está”, podendo mudar ou ser interrompido.
      </p>

      <h2>2. Seu conteúdo</h2>
      <p>
        Tudo o que você cria é seu: receitas, fotos e áudios. O CookMe não reivindica nenhum direito sobre o seu conteúdo e só o acessa para
        salvá-lo e sincronizá-lo, conforme a <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>3. Responsabilidades</h2>
      <ul>
        <li>Você é responsável pela sua conta Google e pelo conteúdo que cria.</li>
        <li>Não use o app para atividades ilegais ou que violem direitos de terceiros.</li>
        <li>Ao compartilhar receitas e fotos de outras pessoas, respeite os direitos de quem as criou.</li>
        <li>
          Recomendamos manter backups dos seus cadernos (Configurações → Exportar backup). Embora o app trate conflitos de
          sincronização para evitar perdas, não podemos garantir a ausência total de falhas.
        </li>
      </ul>

      <h2>4. Limitação de responsabilidade</h2>
      <p>
        Na medida permitida pela lei, o CookMe não se responsabiliza por perdas de dados ou danos decorrentes do uso do
        app, de indisponibilidade do serviço ou de serviços de terceiros, como o Google Drive.
      </p>

      <h2>5. Contato</h2>
      <p>
        Dúvidas: <ContactLine />.
      </p>
    </LegalPage>
  );
}
