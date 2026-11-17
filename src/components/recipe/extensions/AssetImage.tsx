'use client';

import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { ASSET_IMAGE_NODE } from '@/features/recipes/content';
import { getAssetBlob } from '@/lib/repository';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    assetImage: {
      /** Inserts an uploaded asset (`assetId`) or an image by link (`src`). */
      insertImage: (image: { assetId?: string; src?: string; alt?: string }) => ReturnType;
    };
  }
}

/**
 * Image block. Either a project asset (IndexedDB locally, separate file in Drive) or an image
 * by link. The document JSON keeps only the asset id or the URL, never Base64.
 */
export const AssetImage = Node.create({
  name: ASSET_IMAGE_NODE,
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      assetId: { default: null, parseHTML: (el) => el.getAttribute('data-asset-id'), renderHTML: (a) => ({ 'data-asset-id': a.assetId }) },
      src: { default: null, parseHTML: (el) => el.getAttribute('data-src'), renderHTML: (a) => ({ 'data-src': a.src }) },
      alt: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-asset-id]' }, { tag: 'figure[data-src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AssetImageView);
  },

  addCommands() {
    return {
      insertImage:
        ({ assetId, src, alt = '' }) =>
        ({ commands }) =>
          commands.insertContent([{ type: this.name, attrs: { assetId: assetId ?? null, src: src ?? null, alt } }, { type: 'paragraph' }]),
    };
  },
});

/**
 * Resolves what an <img>/<audio> should play: the link itself, or an object URL for an asset.
 * `missing` = asset not on this device yet (still syncing from Drive).
 */
export function useAssetSrc(assetId: string | null | undefined, link?: string | null) {
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    setAssetUrl(null);
    setMissing(false);
    if (!assetId || link) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    getAssetBlob(assetId).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setMissing(true);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setAssetUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId, link]);
  return { url: link || assetUrl, missing };
}

function AssetImageView({ node, selected }: ReactNodeViewProps) {
  const { url, missing } = useAssetSrc(node.attrs.assetId, node.attrs.src);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);

  let content;
  if (url && !broken) {
    content = <img src={url} alt={node.attrs.alt ?? ''} draggable={false} onError={() => setBroken(true)} />;
  } else if (broken) {
    content = (
      <div className="cm-image-placeholder">
        <ImageOff size={18} /> Não foi possível carregar a imagem deste link
      </div>
    );
  } else {
    content = (
      <div className="cm-image-placeholder">
        {missing ? (
          <>
            <ImageOff size={18} /> Imagem ainda não sincronizada neste dispositivo
          </>
        ) : (
          'Carregando imagem…'
        )}
      </div>
    );
  }

  return (
    <NodeViewWrapper className={`cm-image${selected ? ' is-selected' : ''}`} data-drag-handle>
      {content}
    </NodeViewWrapper>
  );
}
