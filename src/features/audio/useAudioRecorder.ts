'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Prefer MP4/AAC (plays everywhere, iPhone included); fall back to WebM/Opus. */
const MIME_CANDIDATES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

export const MAX_RECORDING_SECONDS = 10 * 60;

export function pickRecordingMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported?.(m));
}

export function canRecordAudio() {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'recorded' | 'error';

export interface Recording {
  blob: Blob;
  url: string;
  /** Seconds. */
  duration: number;
}

/**
 * Microphone recording with a live level meter. Everything is released (tracks, audio
 * context, object URLs) on reset and on unmount.
 */
export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [recording, setRecording] = useState<Recording | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);

  const releaseDevices = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timerRef.current = null;
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (!canRecordAudio()) {
      setError('Este navegador não permite gravar áudio aqui. Tente o Chrome, o Edge ou o Safari atualizados.');
      setState('error');
      return;
    }
    setError(null);
    setState('requesting');
    discardRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mimeType = pickRecordingMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 96_000 } : undefined);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        const duration = (Date.now() - startedAtRef.current) / 1000;
        releaseDevices();
        if (discardRef.current) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        setRecording((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { blob, url: URL.createObjectURL(blob), duration };
        });
        setState('recorded');
      };

      // Level meter: purely visual feedback that the microphone is picking up sound.
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 64));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }

      startedAtRef.current = Date.now();
      setElapsed(0);
      recorder.start(250);
      setState('recording');
      timerRef.current = setInterval(() => {
        const seconds = (Date.now() - startedAtRef.current) / 1000;
        setElapsed(seconds);
        if (seconds >= MAX_RECORDING_SECONDS) recorder.stop();
      }, 200);
    } catch (e) {
      releaseDevices();
      const name = e instanceof DOMException ? e.name : '';
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'O acesso ao microfone foi negado. Libere o microfone para este site nas configurações do navegador e tente de novo.'
          : name === 'NotFoundError'
            ? 'Nenhum microfone encontrado neste dispositivo.'
            : 'Não foi possível iniciar a gravação.',
      );
      setState('error');
    }
  }, [releaseDevices]);

  /** Uses an existing audio file instead of recording. */
  const loadFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    const duration = await new Promise<number>((resolve) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      audio.onerror = () => resolve(0);
      audio.src = url;
    });
    setRecording((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { blob: file, url, duration };
    });
    setError(null);
    setState('recorded');
  }, []);

  const reset = useCallback(() => {
    discardRef.current = true;
    stop();
    releaseDevices();
    setRecording((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setElapsed(0);
    setError(null);
    setState('idle');
  }, [stop, releaseDevices]);

  useEffect(
    () => () => {
      discardRef.current = true;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      releaseDevices();
    },
    [releaseDevices],
  );

  // Revoke the last preview URL on unmount.
  const recordingRef = useRef(recording);
  recordingRef.current = recording;
  useEffect(
    () => () => {
      if (recordingRef.current) URL.revokeObjectURL(recordingRef.current.url);
    },
    [],
  );

  return { state, error, elapsed, level, recording, start, stop, reset, loadFile };
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
