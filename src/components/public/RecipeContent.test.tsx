import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildTutorialBundle } from '@/lib/mock/seed';
import { PublicRecipeSchema } from '@/features/share/publicRecipe';
import type { RichContent } from '@/lib/schemas';
import { RecipeContent } from './RecipeContent';

describe('public recipe page', () => {
  it('renders the recipe like the editor (checklist, steps, images through our route)', () => {
    const content: RichContent = {
      type: 'doc',
      content: [
        ...buildTutorialBundle().recipes.find((r) => r.id === 'recipe_tut_brigadeiro')!.content.content!,
        { type: 'assetImage', attrs: { assetId: 'asset_1', alt: 'ponto' } },
        { type: 'assetImage', attrs: { assetId: 'asset_missing' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'perigo', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
      ],
    };
    const html = renderToStaticMarkup(
      <RecipeContent content={content} assetUrl={(id) => (id === 'asset_1' ? `/r/x/arquivo/${id}` : null)} />,
    );
    expect(html).toContain('class="cm-prose cm-prose-readonly"');
    expect(html).toContain('data-type="taskList"');
    expect(html).toContain('<input type="checkbox"');
    expect(html).toContain('<ol>');
    expect(html).toContain('1 lata de leite condensado');
    expect(html).toContain('src="/r/x/arquivo/asset_1"');
    expect(html).not.toContain('asset_missing');
    expect(html).not.toContain('javascript:');
  });

  it('accepts the public copy format and rejects anything else', () => {
    const copy = {
      format: 'cookme-public',
      version: 1,
      publishedAt: '2026-11-17T00:00:00.000Z',
      name: 'Bolo',
      content: { type: 'doc', content: [] },
      files: { asset_1: 'abc' },
    };
    expect(PublicRecipeSchema.safeParse(copy).success).toBe(true);
    expect(PublicRecipeSchema.safeParse({ ...copy, format: 'cookme-recipe' }).success).toBe(false);
  });
});
