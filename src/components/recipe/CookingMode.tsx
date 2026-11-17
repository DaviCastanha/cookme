'use client';

import { Check, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useProjectData } from '@/features/projects/ProjectDataProvider';
import { getCookingPlan } from '@/features/recipes/content';
import { findDuration, formatTimer } from '@/features/recipes/timers';
import { useStatusStore } from '@/stores/statusStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import styles from './CookingMode.module.scss';

/**
 * Full-screen step-by-step view for when the hands are busy: big type, one step at a time,
 * the screen stays on, and steps that mention a time get a one-tap timer.
 */
export function CookingMode() {
  const cookingId = useWorkspaceStore((s) => s.cookingId);
  const { recipes, itemsById } = useProjectData();
  const recipe = cookingId ? recipes.get(cookingId) : undefined;
  const item = cookingId ? itemsById.get(cookingId) : undefined;
  if (!recipe || !item) return null;
  return createPortal(<CookingView key={recipe.id} name={item.name} content={recipe.content} />, document.body);
}

function CookingView({ name, content }: { name: string; content: Parameters<typeof getCookingPlan>[0] }) {
  // Snapshot when opened: edits elsewhere do not move the person's place.
  const [plan] = useState(() => getCookingPlan(content));
  const hasIngredients = plan.ingredients.length > 0;
  const pages = (hasIngredients ? 1 : 0) + plan.steps.length;
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const timer = useTimer();
  const close = useCallback(() => useWorkspaceStore.getState().setCooking(null), []);
  useWakeLock();

  const go = useCallback((delta: number) => setPage((p) => Math.min(pages, Math.max(0, p + delta))), [pages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, close]);

  // Swipe left/right to change steps.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  const stepIndex = page - (hasIngredients ? 1 : 0);
  const isIngredients = hasIngredients && page === 0;
  const isDone = page === pages;
  const step = !isIngredients && !isDone ? plan.steps[stepIndex] : null;
  const duration = step ? findDuration(step) : null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`Cozinhando: ${name}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.kicker}>Cozinhando</span>
          <h1>{name}</h1>
        </div>
        {timer.remaining !== null && (
          <button className={[styles.timerChip, timer.finished && styles.timerDone].filter(Boolean).join(' ')} onClick={timer.toggle}>
            <Timer size={18} />
            <span>{timer.finished ? 'Tempo!' : formatTimer(timer.remaining)}</span>
            {!timer.finished && (timer.running ? <Pause size={15} /> : <Play size={15} />)}
          </button>
        )}
        {timer.remaining !== null && (
          <button className={styles.iconButton} onClick={timer.clear} aria-label="Cancelar timer" title="Cancelar timer">
            <RotateCcw size={18} />
          </button>
        )}
        <button className={styles.iconButton} onClick={close} aria-label="Sair do modo cozinhar">
          <X size={22} />
        </button>
      </header>

      <div className={styles.progress} aria-hidden>
        {Array.from({ length: pages }, (_, i) => (
          <span key={i} className={i < page ? styles.filled : i === page ? styles.current : ''} />
        ))}
      </div>

      <main className={styles.body}>
        {!pages && (
          <div className={styles.center}>
            <p className={styles.lead}>Esta receita ainda não tem ingredientes nem passos.</p>
            <p className={styles.hint}>Escreva os ingredientes numa lista para marcar e o modo de preparo numa lista numerada.</p>
          </div>
        )}

        {isIngredients && (
          <section className={styles.ingredients}>
            <h2>Separe os ingredientes</h2>
            <ul>
              {plan.ingredients.map((text, i) => {
                const on = checked.has(i);
                return (
                  <li key={i}>
                    <button
                      className={on ? styles.checked : ''}
                      aria-pressed={on}
                      onClick={() =>
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        })
                      }
                    >
                      <span className={styles.box}>{on && <Check size={18} strokeWidth={3} />}</span>
                      <span>{text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {step !== null && (
          <section className={styles.step}>
            <span className={styles.stepNumber}>
              Passo {stepIndex + 1} <span>de {plan.steps.length}</span>
            </span>
            <p className={styles.stepText}>{step}</p>
            {duration && (
              <button className={styles.startTimer} onClick={() => timer.start(duration.seconds)}>
                <Timer size={20} /> Iniciar timer de {duration.label}
              </button>
            )}
          </section>
        )}

        {isDone && pages > 0 && (
          <div className={styles.center}>
            <p className={styles.done}>Bom apetite!</p>
            <p className={styles.hint}>Você chegou ao fim da receita.</p>
            <button className={styles.startTimer} onClick={close}>
              Voltar para a receita
            </button>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <button className={styles.nav} onClick={() => go(-1)} disabled={page === 0}>
          <ChevronLeft size={26} /> Anterior
        </button>
        <button className={[styles.nav, styles.next].join(' ')} onClick={() => (isDone ? close() : go(1))} disabled={!pages}>
          {isDone ? 'Concluir' : page === pages - 1 ? 'Terminar' : 'Próximo'} <ChevronRight size={26} />
        </button>
      </footer>
    </div>
  );
}

/** Keeps the screen on while cooking (where supported). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        if (!nav.wakeLock || document.visibilityState !== 'visible') return;
        const next = await nav.wakeLock.request('screen');
        if (cancelled) void next.release();
        else lock = next;
      } catch {
        // Not allowed (battery saver, old browser): the cooking mode still works.
      }
    };
    void request();
    const onVisible = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);
}

/** A single countdown that keeps counting while the person moves between steps. */
function useTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);

  const running = endsAt !== null;
  const remaining = running ? Math.max(0, (endsAt - now) / 1000) : pausedLeft;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || remaining === null || remaining > 0 || finished) return;
    setFinished(true);
    setEndsAt(null);
    setPausedLeft(0);
    alarm();
    useStatusStore.getState().toast('O tempo do timer acabou!', 'info');
  }, [running, remaining, finished]);

  return {
    remaining,
    running,
    finished,
    start: (seconds: number) => {
      setFinished(false);
      setPausedLeft(null);
      setNow(Date.now());
      setEndsAt(Date.now() + seconds * 1000);
    },
    toggle: () => {
      if (finished) {
        setFinished(false);
        setPausedLeft(null);
        return;
      }
      if (running) {
        setPausedLeft(remaining);
        setEndsAt(null);
      } else if (pausedLeft) {
        setNow(Date.now());
        setEndsAt(Date.now() + pausedLeft * 1000);
        setPausedLeft(null);
      }
    },
    clear: () => {
      setEndsAt(null);
      setPausedLeft(null);
      setFinished(false);
    },
  };
}

/** Three short beeps (and a vibration on phones). */
function alarm() {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    [0, 0.45, 0.9].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.32);
    });
    setTimeout(() => void ctx.close(), 1600);
  } catch {
    // No audio: the toast and the chip still show it.
  }
}
