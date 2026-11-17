'use client';

import { Cloud, HardDrive, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { SaveIndicator } from '@/components/layout/SaveIndicator';
import { useAccount } from '@/features/auth/AuthGate';
import { connectDriveUrl, useSessionStore } from '@/features/auth/sessionStore';
import { syncEngine } from '@/features/sync/syncEngine';
import styles from './AccountSection.module.scss';

/** Signed-in account and Drive sync status. */
export function AccountSection() {
  const session = useSessionStore();
  const { mode, account } = useAccount();
  const pathname = usePathname() ?? '/';

  if (mode === 'local') {
    return (
      <div className={styles.card}>
        <HardDrive size={20} className={styles.icon} />
        <div>
          <strong>Modo local</strong>
          <p>
            Seus cadernos estão salvos neste navegador. O login com Google não está configurado neste servidor (veja{' '}
            <code>docs/GOOGLE_SETUP.md</code>).
          </p>
        </div>
      </div>
    );
  }

  const user = session.user;
  return (
    <div className={styles.stack}>
      <div className={styles.user}>
        {user?.picture ? (
          // Google avatars are external URLs; next/image would need extra config for no gain here.
          <img src={user.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className={styles.avatar}>{(user?.name ?? account ?? '?').slice(0, 1).toUpperCase()}</span>
        )}
        <div className={styles.userText}>
          <strong>{user?.name ?? account}</strong>
          <span>{user?.email ?? 'Offline'}</span>
        </div>
        <Button variant="ghost" size="sm" icon={<LogOut size={15} />} onClick={() => void session.logout()}>
          Sair
        </Button>
      </div>

      {session.status === 'error' ? (
        <div className={styles.card}>
          <Cloud size={20} className={styles.icon} />
          <div>
            <strong>Sem conexão</strong>
            <p>Você pode continuar usando. As alterações ficam salvas neste aparelho e vão para o Drive quando a conexão voltar.</p>
          </div>
        </div>
      ) : session.driveConnected ? (
        <div className={styles.card}>
          <Cloud size={20} className={styles.iconOk} />
          <div>
            <strong>Salvando no seu Google Drive</strong>
            <p>
              Seus cadernos ficam na pasta <em>CookMe</em> do seu Drive e aparecem em qualquer aparelho onde você entrar.
              Funciona offline: tudo sobe quando a conexão voltar.
            </p>
            <div className={styles.row}>
              <SaveIndicator />
              <Button variant="soft" size="sm" icon={<RefreshCw size={14} />} onClick={() => void syncEngine.syncNow()}>
                Sincronizar agora
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <ShieldAlert size={20} className={styles.icon} />
          <div>
            <strong>Acesso ao Drive não autorizado</strong>
            <p>
              Na tela do Google, a permissão do Drive ficou desmarcada. Sem ela, os cadernos ficam só neste navegador. O
              CookMe acessa <em>apenas</em> a pasta que ele mesmo cria.
            </p>
            <Button variant="primary" icon={<Cloud size={16} />} onClick={() => (window.location.href = connectDriveUrl(pathname + window.location.search))}>
              Permitir acesso ao Drive
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
