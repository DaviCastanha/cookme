'use client';

import { Check, ChefHat, MonitorDown, Sparkles, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { APP_VERSION, formatReleaseDate, RELEASES, type Release } from '@/content/releases';
import { installPlatform, promptInstall, usePwaStore } from '@/features/pwa/install';
import { useAboutStore } from '@/stores/aboutStore';
import styles from './AboutDialogs.module.scss';

/** "Sobre o CookMe" and "Novidades". Mounted once (see AppHosts). */
export function AboutDialogs() {
  const view = useAboutStore((s) => s.view);
  const fresh = useAboutStore((s) => s.fresh);
  const close = useAboutStore((s) => s.close);
  if (view === 'about') return <AboutDialog onClose={close} />;
  if (view === 'news') return <NewsDialog fresh={fresh} onClose={close} />;
  return null;
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  const current = RELEASES[0];
  return (
    <Modal open onClose={onClose} title="Sobre o CookMe" size="sm">
      <div className={styles.about}>
        <div className={styles.hero}>
          <span className={styles.logo} aria-hidden>
            <ChefHat size={34} strokeWidth={1.8} />
          </span>
          <h3 className={styles.name}>CookMe</h3>
          <p className={styles.version}>
            Versão {APP_VERSION} · {formatReleaseDate(current.date)}
          </p>
          <p className={styles.tagline}>Suas receitas, do seu jeito.</p>
          <p className={styles.text}>
            Um caderno de receitas simples: pastas com ícone e cor, foto de capa, ingredientes para ir marcando, passo a
            passo com fotos e áudios, e um modo para cozinhar com a tela sempre acesa.
          </p>
          <Button variant="soft" size="sm" icon={<Sparkles size={15} />} onClick={() => useAboutStore.getState().showNews()}>
            Novidades da versão
          </Button>
        </div>

        <InstallCard />

        <section className={styles.card}>
          <h4>Créditos</h4>
          <p>Criado por Davi Castanha</p>
        </section>

        <nav className={styles.links}>
          <Link href="/privacidade" onClick={onClose}>
            Política de Privacidade
          </Link>
          <Link href="/termos" onClick={onClose}>
            Termos de Uso
          </Link>
        </nav>
      </div>
    </Modal>
  );
}

function InstallCard() {
  const installEvent = usePwaStore((s) => s.installEvent);
  const standalone = usePwaStore((s) => s.standalone);
  const offlineReady = usePwaStore((s) => s.offlineReady);
  const platform = installPlatform();

  return (
    <section className={styles.card}>
      <h4>Usar como aplicativo</h4>
      {standalone ? (
        <p className={styles.ok}>
          <Check size={15} /> Você está usando o CookMe instalado.
        </p>
      ) : installEvent ? (
        <>
          <p>Instale para abrir o CookMe na própria janela, com ícone na área de trabalho ou na tela inicial.</p>
          <Button variant="primary" size="sm" icon={<MonitorDown size={15} />} onClick={() => void promptInstall()}>
            Instalar CookMe
          </Button>
        </>
      ) : (
        <p>
          {platform === 'ios'
            ? 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.'
            : platform === 'android'
              ? 'No Chrome, abra o menu ⋮ e toque em “Instalar app” (ou “Adicionar à tela inicial”).'
              : 'No Chrome ou no Edge, clique no ícone de instalar na barra de endereço, ou no menu ⋮ → “Instalar CookMe”.'}
        </p>
      )}
      {offlineReady && (
        <p className={styles.ok}>
          <WifiOff size={15} /> Pronto para abrir sem internet neste aparelho.
        </p>
      )}
    </section>
  );
}

function NewsDialog({ fresh, onClose }: { fresh: Release[]; onClose: () => void }) {
  const [showOlder, setShowOlder] = useState(false);
  const freshVersions = new Set(fresh.map((r) => r.version));
  const highlighted = fresh.length ? fresh : RELEASES.slice(0, 1);
  const older = RELEASES.filter((r) => !highlighted.some((h) => h.version === r.version));

  return (
    <Modal
      open
      onClose={onClose}
      title={fresh.length ? 'Novidades do CookMe' : 'Novidades'}
      size="md"
      footer={
        <Button variant="primary" onClick={onClose}>
          Entendi
        </Button>
      }
    >
      <div className={styles.news}>
        {fresh.length > 0 && <p className={styles.intro}>O que mudou desde a última vez que você abriu o app:</p>}
        {highlighted.map((r) => (
          <ReleaseEntry key={r.version} release={r} isNew={freshVersions.has(r.version)} />
        ))}
        {older.length > 0 &&
          (showOlder ? (
            older.map((r) => <ReleaseEntry key={r.version} release={r} />)
          ) : (
            <button className={styles.older} onClick={() => setShowOlder(true)}>
              Ver versões anteriores ({older.length})
            </button>
          ))}
      </div>
    </Modal>
  );
}

function ReleaseEntry({ release, isNew }: { release: Release; isNew?: boolean }) {
  return (
    <article className={styles.release}>
      <header>
        <span className={isNew ? styles.badgeNew : styles.badge}>v{release.version}</span>
        <h3>{release.title}</h3>
        <time dateTime={release.date}>{formatReleaseDate(release.date)}</time>
      </header>
      <ul>
        {release.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}
