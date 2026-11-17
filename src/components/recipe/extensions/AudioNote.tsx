'use client';

import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { Mic, Pause, Play, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AUDIO_NOTE_NODE } from '@/features/recipes/content';
import { formatDuration } from '@/features/audio/useAudioRecorder';
import { useAssetSrc } from './AssetImage';
import styles from './AudioNote.module.scss';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    audioNote: {
      insertAudio: (audio: { assetId: string; duration: number; title?: string }) => ReturnType;
    };
  }
}

/**
 * Audio block (a voice tip inside a step, for example). The audio is a caderno asset (IndexedDB
 * locally, a file in the Drive "assets/audio" folder); the recipe keeps only its id, duration and title.
 */
export const AudioNote = Node.create({
  name: AUDIO_NOTE_NODE,
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      assetId: { default: null, parseHTML: (el) => el.getAttribute('data-asset-id'), renderHTML: (a) => ({ 'data-asset-id': a.assetId }) },
      duration: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-duration') ?? 0),
        renderHTML: (a) => ({ 'data-duration': a.duration }),
      },
      title: { default: 'Áudio', parseHTML: (el) => el.getAttribute('data-title') ?? '', renderHTML: (a) => ({ 'data-title': a.title }) },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-audio-note]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-audio-note': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioNoteView);
  },

  addCommands() {
    return {
      insertAudio:
        ({ assetId, duration, title = 'Áudio' }) =>
        ({ commands }) =>
          commands.insertContent([{ type: this.name, attrs: { assetId, duration, title } }, { type: 'paragraph' }]),
    };
  },
});

function AudioNoteView({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const { url, missing } = useAssetSrc(node.attrs.assetId);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [failed, setFailed] = useState(false);
  // Recorded WebM files often report an infinite duration: the stored one is reliable.
  const duration = Number(node.attrs.duration) || 0;

  useEffect(() => setFailed(false), [url]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setFailed(true));
    else audio.pause();
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  };

  const ready = !!url && !failed;
  const max = Math.max(duration, current, 0.1);

  return (
    <NodeViewWrapper className={[styles.note, selected && styles.selected].filter(Boolean).join(' ')} contentEditable={false} data-drag-handle>
      <button
        className={styles.play}
        onClick={toggle}
        disabled={!ready}
        aria-label={playing ? 'Pausar' : 'Tocar áudio'}
        title={playing ? 'Pausar' : 'Tocar'}
      >
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <Mic size={13} className={styles.mic} />
          <input
            className={styles.title}
            value={String(node.attrs.title ?? '')}
            placeholder="Áudio"
            aria-label="Título do áudio"
            readOnly={!editor.isEditable}
            onChange={(e) => updateAttributes({ title: e.target.value })}
          />
        </div>
        {ready ? (
          <div className={styles.progressRow}>
            <input
              type="range"
              className={styles.progress}
              min={0}
              max={max}
              step={0.1}
              value={Math.min(current, max)}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Posição do áudio"
              style={{ '--pct': `${(Math.min(current, max) / max) * 100}%` } as React.CSSProperties}
            />
            <span className={styles.time}>
              {formatDuration(current)} / {formatDuration(duration)}
            </span>
          </div>
        ) : (
          <p className={styles.status}>
            {failed
              ? 'Este navegador não conseguiu tocar o áudio.'
              : missing
                ? 'Áudio ainda não sincronizado neste dispositivo.'
                : 'Carregando áudio…'}
          </p>
        )}
      </div>

      {editor.isEditable && (
        <button className={styles.remove} onClick={() => deleteNode()} aria-label="Remover áudio" title="Remover">
          <Trash2 size={15} />
        </button>
      )}

      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
          }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (!duration && Number.isFinite(d)) updateAttributes({ duration: d });
          }}
          onError={() => setFailed(true)}
        />
      )}
    </NodeViewWrapper>
  );
}
