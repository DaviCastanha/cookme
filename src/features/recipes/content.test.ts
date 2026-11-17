import { describe, expect, it } from 'vitest';
import { buildTutorialBundle } from '@/lib/mock/seed';
import type { RichContent } from '@/lib/schemas';
import { getAssetIds, getCookingPlan, getSections, mapAssetIds, uncheckAll } from './content';
import { durationLabel, findDuration, formatTimer } from './timers';

const bundle = buildTutorialBundle();
const recipe = (id: string) => bundle.recipes.find((r) => r.id === id)!.content;

describe('recipe content', () => {
  it('reads sections with their lines, skipping empty ones', () => {
    const sections = getSections(recipe('recipe_tut_pao_de_queijo'));
    expect(sections.map((s) => s.title)).toEqual(['Ingredientes', 'Modo de preparo', 'Dicas']);
    expect(sections[0].lines[0]).toEqual({ kind: 'bullet', text: '500 g de polvilho azedo', checked: false });
    expect(sections[1].lines[0]).toMatchObject({ kind: 'number', n: 1 });
    expect(sections[2].lines[0].kind).toBe('text');
  });

  it('keeps a section title whose content is split into parts', () => {
    const sections = getSections(recipe('recipe_tut_bolo_cenoura'));
    expect(sections.map((s) => [s.title, s.level])).toEqual([
      ['Ingredientes', 2],
      ['Massa', 3],
      ['Cobertura', 3],
      ['Modo de preparo', 2],
      ['Dicas', 2],
    ]);
    expect(sections[1].parentTitle).toBe('Ingredientes');
  });

  it('builds the cooking plan from ingredients and steps, including sub-parts', () => {
    const plan = getCookingPlan(recipe('recipe_tut_bolo_cenoura'));
    // Massa (6) + Cobertura (4).
    expect(plan.ingredients).toHaveLength(10);
    expect(plan.steps).toHaveLength(5);
    expect(plan.steps[0]).toMatch(/^Bata no liquidificador/);
  });

  it('ignores an untouched new recipe', () => {
    const empty: RichContent = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'Ingredientes' }] },
        { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
      ],
    };
    expect(getSections(empty)).toEqual([]);
    expect(getCookingPlan(empty)).toEqual({ ingredients: [], steps: [] });
  });

  it('finds, remaps and unchecks', () => {
    const doc: RichContent = {
      type: 'doc',
      content: [
        { type: 'assetImage', attrs: { assetId: 'asset_a' } },
        { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph' }] }] },
        { type: 'audioNote', attrs: { assetId: 'asset_b' } },
      ],
    };
    expect(getAssetIds(doc)).toEqual(['asset_a', 'asset_b']);
    expect(getAssetIds(mapAssetIds(doc, new Map([['asset_a', 'asset_x']])))).toEqual(['asset_x', 'asset_b']);
    expect(JSON.stringify(uncheckAll(doc))).not.toContain('"checked":true');
  });
});

describe('timers', () => {
  it('finds durations in steps', () => {
    expect(findDuration('Asse em forno preaquecido a 200 °C por 25 a 30 minutos, até dourar.')?.seconds).toBe(30 * 60);
    expect(findDuration('Cozinhe por uns 10 minutos.')?.seconds).toBe(600);
    expect(findDuration('Deixe descansar 1h30 na geladeira.')?.seconds).toBe(5400);
    expect(findDuration('Leve à geladeira por 2 horas.')?.seconds).toBe(7200);
    expect(findDuration('Bata por 10 segundos.')?.seconds).toBe(10);
    expect(findDuration('Corte em pedaços de 3 cm.')).toBeNull();
    expect(findDuration('Asse a 180 °C.')).toBeNull();
  });

  it('formats the countdown', () => {
    expect(formatTimer(65)).toBe('1:05');
    expect(formatTimer(3725)).toBe('1:02:05');
    expect([durationLabel(2400), durationLabel(5400), durationLabel(7200), durationLabel(10)]).toEqual(['40 min', '1h30', '2h', '10 s']);
  });
});
