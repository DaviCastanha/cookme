import { ChefHat } from 'lucide-react';
import styles from './Splash.module.scss';

export function Splash({ message = 'Carregando…' }: { message?: string }) {
  return (
    <div className={styles.splash} role="status">
      <ChefHat size={34} className={styles.icon} />
      <span>{message}</span>
    </div>
  );
}
