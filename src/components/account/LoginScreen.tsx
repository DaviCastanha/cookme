'use client';

import { ChefHat, CloudOff } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { loginUrl } from '@/features/auth/sessionStore';
import styles from './LoginScreen.module.scss';

const FEATURES = [
  'Suas receitas ficam salvas no seu próprio Google Drive',
  'Use no celular, na cozinha, e no computador',
  'Funciona offline e sincroniza quando a conexão voltar',
];

export function LoginScreen({ offline = false }: { offline?: boolean }) {
  const pathname = usePathname() ?? '/';
  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden>
          <ChefHat size={34} strokeWidth={1.8} />
        </span>
        <h1>CookMe</h1>
        <p>Suas receitas, do seu jeito.</p>
      </div>

      <div className={styles.card}>
        {offline ? (
          <div className={styles.offline}>
            <CloudOff size={20} />
            <p>Sem conexão. Conecte-se à internet para entrar pela primeira vez neste dispositivo.</p>
          </div>
        ) : (
          <>
            <ul className={styles.features}>
              {FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <a className={styles.google} href={loginUrl(pathname + window.location.search)}>
              <GoogleLogo />
              Entrar com Google
            </a>
            <p className={styles.note}>
              O CookMe só acessa a pasta “CookMe” que ele mesmo cria no seu Drive. Seus outros arquivos continuam
              invisíveis para o app.
            </p>
          </>
        )}
      </div>

      <footer className={styles.legal}>
        <Link href="/privacidade">Política de Privacidade</Link>
        <Link href="/termos">Termos de Uso</Link>
      </footer>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
