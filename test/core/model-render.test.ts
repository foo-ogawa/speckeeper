/**
 * FR-301: Rendering feature for external programs — Model.renderers
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Model } from '../../src/core/model.js';
import type { ModelLevel, LintRule, Exporter, Renderer, RenderContext } from '../../src/core/model.js';

const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
});

type Item = z.infer<typeof ItemSchema>;

class RequirementLikeModel extends Model<typeof ItemSchema> {
  readonly id = 'render-requirement';
  readonly name = 'RenderRequirement';
  readonly idPrefix = 'RR';
  readonly schema = ItemSchema;
  protected modelLevel: ModelLevel = 'L1';
  protected lintRules: LintRule<Item>[] = [];
  protected exporters: Exporter<Item>[] = [];
  protected renderers: Renderer<Item>[] = [
    {
      format: 'table',
      render: (specs, ctx) => ctx.markdown.table(['ID', 'Name'], specs.map(s => [s.id, s.name])),
    },
    {
      format: 'list',
      render: (specs) => specs.map(s => `- ${s.id}: ${s.name}`).join('\n'),
    },
  ];
}

class EntityLikeModel extends Model<typeof ItemSchema> {
  readonly id = 'render-entity';
  readonly name = 'RenderEntity';
  readonly idPrefix = 'RE';
  readonly schema = ItemSchema;
  protected modelLevel: ModelLevel = 'L2';
  protected lintRules: LintRule<Item>[] = [];
  protected exporters: Exporter<Item>[] = [];
  protected renderers: Renderer<Item>[] = [
    {
      format: 'table',
      render: (specs) => specs.map(s => `ENTITY ${s.id}`).join('\n'),
    },
  ];
}

class NoRendererModel extends Model<typeof ItemSchema> {
  readonly id = 'render-none';
  readonly name = 'RenderNone';
  readonly idPrefix = 'RN';
  readonly schema = ItemSchema;
  protected lintRules: LintRule<Item>[] = [];
  protected exporters: Exporter<Item>[] = [];
}

const ctx: RenderContext = {
  params: {},
  markdown: {
    table: (headers, rows) => [
      `| ${headers.join(' | ')} |`,
      `| ${headers.map(() => '---').join(' | ')} |`,
      ...rows.map(r => `| ${r.join(' | ')} |`),
    ].join('\n'),
  },
};

const specs: Item[] = [
  { id: 'RR-001', name: 'First' },
  { id: 'RR-002', name: 'Second' },
];

describe('FR-104, FR-301, NFR-004: Model renderers', () => {
  describe('FR-301-01: renderers are declared on the Model class', () => {
    it('FR-301-01 exposes every renderer declared in the subclass', () => {
      const model = new RequirementLikeModel();

      expect(model.getRenderers().map(r => r.format)).toEqual(['table', 'list']);
      expect(model.getAvailableFormats()).toEqual(['table', 'list']);
      expect(model.hasRenderer('table')).toBe(true);
      expect(model.hasRenderer('detail')).toBe(false);
    });

    it('FR-301-01 reports no formats for a model that declares no renderers', () => {
      const model = new NoRendererModel();

      expect(model.getRenderers()).toEqual([]);
      expect(model.getAvailableFormats()).toEqual([]);
      expect(model.hasRenderer('table')).toBe(false);
    });
  });

  describe('FR-301-02: rendering is invoked through the common Model.render interface', () => {
    it('FR-301-02 renders through Model.render using the supplied RenderContext', () => {
      const model = new RequirementLikeModel();

      const rendered = model.render('table', specs, ctx);

      expect(rendered).toBe(
        [
          '| ID | Name |',
          '| --- | --- |',
          '| RR-001 | First |',
          '| RR-002 | Second |',
        ].join('\n'),
      );
    });
  });

  describe('FR-301-03: rendering result depends on the model class', () => {
    it('FR-301-03 renders the same format differently per model class', () => {
      const requirementOutput = new RequirementLikeModel().render('table', specs, ctx);
      const entityOutput = new EntityLikeModel().render('table', specs, ctx);

      expect(requirementOutput).toContain('| RR-001 | First |');
      expect(entityOutput).toBe('ENTITY RR-001\nENTITY RR-002');
      expect(entityOutput).not.toBe(requirementOutput);
    });
  });

  describe('FR-104-04, FR-301-04, NFR-004-02: the format parameter selects the renderer', () => {
    it('FR-301-04 selects the renderer matching the requested format', () => {
      const model = new RequirementLikeModel();

      expect(model.render('list', specs, ctx)).toBe('- RR-001: First\n- RR-002: Second');
      expect(model.render('table', specs, ctx)).toContain('| ID | Name |');
    });

    it('FR-301-04 returns null for a format no renderer declares', () => {
      const model = new RequirementLikeModel();

      expect(model.render('spec-chapter', specs, ctx)).toBeNull();
    });

    it('FR-104-04, NFR-004-02 lets each model class define its own output functions', () => {
      expect(new RequirementLikeModel().getAvailableFormats()).toEqual(['table', 'list']);
      expect(new EntityLikeModel().getAvailableFormats()).toEqual(['table']);
    });
  });
});
