/**
 * Read-only rendering of a recipe's Tiptap JSON, on the server (public recipe page). Uses the
 * same `.cm-prose` styles as the editor, so the recipe looks the same as in the app.
 */
import type { ReactNode } from 'react';
import type { RichContent } from '@/lib/schemas';

type AssetUrl = (assetId: string) => string | null;

function text(node: RichContent, key: number): ReactNode {
  let out: ReactNode = node.text ?? '';
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') out = <strong>{out}</strong>;
    else if (mark.type === 'italic') out = <em>{out}</em>;
    else if (mark.type === 'underline') out = <u>{out}</u>;
    else if (mark.type === 'strike') out = <s>{out}</s>;
    else if (mark.type === 'link' && typeof mark.attrs?.href === 'string' && /^https?:\/\//.test(mark.attrs.href)) {
      out = (
        <a href={mark.attrs.href} target="_blank" rel="noreferrer nofollow">
          {out}
        </a>
      );
    }
  }
  return <span key={key}>{out}</span>;
}

function children(node: RichContent, assetUrl: AssetUrl): ReactNode[] {
  return (node.content ?? []).map((child, i) => renderNode(child, i, assetUrl));
}

function renderNode(node: RichContent, key: number, assetUrl: AssetUrl): ReactNode {
  switch (node.type) {
    case 'text':
      return text(node, key);
    case 'hardBreak':
      return <br key={key} />;
    case 'paragraph':
      return <p key={key}>{children(node, assetUrl)}</p>;
    case 'heading': {
      const level = Number(node.attrs?.level ?? 2);
      return level >= 3 ? <h3 key={key}>{children(node, assetUrl)}</h3> : <h2 key={key}>{children(node, assetUrl)}</h2>;
    }
    case 'bulletList':
      return <ul key={key}>{children(node, assetUrl)}</ul>;
    case 'orderedList':
      return <ol key={key}>{children(node, assetUrl)}</ol>;
    case 'listItem':
      return <li key={key}>{children(node, assetUrl)}</li>;
    case 'taskList':
      return (
        <ul key={key} data-type="taskList">
          {children(node, assetUrl)}
        </ul>
      );
    case 'taskItem':
      // Unchecked for every visitor: a checklist to tick while cooking (kept in the page only).
      return (
        <li key={key} data-type="taskItem">
          <label>
            <input type="checkbox" aria-label="Marcar ingrediente" />
          </label>
          <div>{children(node, assetUrl)}</div>
        </li>
      );
    case 'blockquote':
      return <blockquote key={key}>{children(node, assetUrl)}</blockquote>;
    case 'horizontalRule':
      return <hr key={key} />;
    case 'assetImage': {
      const src = node.attrs?.assetId ? assetUrl(String(node.attrs.assetId)) : typeof node.attrs?.src === 'string' ? node.attrs.src : null;
      if (!src) return null;
      return (
        <figure key={key} className="cm-image">
          <img src={src} alt={String(node.attrs?.alt ?? '')} loading="lazy" />
        </figure>
      );
    }
    case 'audioNote': {
      const src = node.attrs?.assetId ? assetUrl(String(node.attrs.assetId)) : null;
      if (!src) return null;
      return (
        <figure key={key} className="cm-public-audio">
          <figcaption>{String(node.attrs?.title || 'Áudio')}</figcaption>
          <audio src={src} controls preload="none" />
        </figure>
      );
    }
    default:
      return null;
  }
}

export function RecipeContent({ content, assetUrl }: { content: RichContent; assetUrl: AssetUrl }) {
  return <div className="cm-prose cm-prose-readonly">{children(content, assetUrl)}</div>;
}
