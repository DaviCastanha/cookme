import { ChefHat } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './LegalPage.module.scss';

/** Contact shown on the legal pages. Set NEXT_PUBLIC_CONTACT_EMAIL in the deploy environment. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '';

export function ContactLine() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <>o e-mail de suporte exibido na tela de login do Google</>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <ChefHat size={22} /> CookMe
        </Link>
      </header>
      <article className={styles.article}>
        <h1>{title}</h1>
        <p className={styles.updated}>Última atualização: {updated}</p>
        {children}
      </article>
      <footer className={styles.footer}>
        <Link href="/privacidade">Política de Privacidade</Link>
        <Link href="/termos">Termos de Uso</Link>
        <Link href="/">Voltar ao CookMe</Link>
      </footer>
    </div>
  );
}
