/**
 * FR-104: Model definition - modelLevel tests
 * 
 * Test functionality for setting modelLevel on model classes and enabling relation constraint validation
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Model, RelationSchema } from '../../src/core/model.js';
import { runDesignLint, COMMON_LINT_RULES } from '../../src/core/design-lint.js';
import type { ModelLevel, LintRule, Exporter } from '../../src/core/model.js';

// ============================================================================
// Test model definitions
// ============================================================================

const TestL0Schema = z.object({
  id: z.string(),
  name: z.string(),
  relations: z.array(RelationSchema).optional(),
});

const TestL1Schema = z.object({
  id: z.string(),
  name: z.string(),
  relations: z.array(RelationSchema).optional(),
});

const TestL2Schema = z.object({
  id: z.string(),
  name: z.string(),
  relations: z.array(RelationSchema).optional(),
});

class TestL0Model extends Model<typeof TestL0Schema> {
  readonly id = 'test-l0';
  readonly name = 'TestL0';
  readonly idPrefix = 'L0';
  readonly schema = TestL0Schema;
  protected modelLevel: ModelLevel = 'L0';
  protected lintRules: LintRule<z.infer<typeof TestL0Schema>>[] = [];
  protected exporters: Exporter<z.infer<typeof TestL0Schema>>[] = [];
}

class TestL1Model extends Model<typeof TestL1Schema> {
  readonly id = 'test-l1';
  readonly name = 'TestL1';
  readonly idPrefix = 'L1';
  readonly schema = TestL1Schema;
  protected modelLevel: ModelLevel = 'L1';
  protected lintRules: LintRule<z.infer<typeof TestL1Schema>>[] = [];
  protected exporters: Exporter<z.infer<typeof TestL1Schema>>[] = [];
}

class TestL2Model extends Model<typeof TestL2Schema> {
  readonly id = 'test-l2';
  readonly name = 'TestL2';
  readonly idPrefix = 'L2';
  readonly schema = TestL2Schema;
  protected modelLevel: ModelLevel = 'L2';
  protected lintRules: LintRule<z.infer<typeof TestL2Schema>>[] = [];
  protected exporters: Exporter<z.infer<typeof TestL2Schema>>[] = [];
}

class TestNoLevelModel extends Model<typeof TestL0Schema> {
  readonly id = 'test-no-level';
  readonly name = 'TestNoLevel';
  readonly idPrefix = 'NL';
  readonly schema = TestL0Schema;
  // modelLevel not set
  protected lintRules: LintRule<z.infer<typeof TestL0Schema>>[] = [];
  protected exporters: Exporter<z.infer<typeof TestL0Schema>>[] = [];
}

// ============================================================================
// Tests
// ============================================================================

describe('FR-104: Model definition - modelLevel', () => {
  describe('FR-104-08: modelLevel configuration', () => {
    it('FR-104-08: Can set modelLevel to L0 on model class', () => {
      const model = new TestL0Model();
      expect(model.level).toBe('L0');
    });

    it('FR-104-08: Can set modelLevel to L1 on model class', () => {
      const model = new TestL1Model();
      expect(model.level).toBe('L1');
    });

    it('FR-104-08: Can set modelLevel to L2 on model class', () => {
      const model = new TestL2Model();
      expect(model.level).toBe('L2');
    });

    it('FR-104-08: Returns undefined when modelLevel is not set', () => {
      const model = new TestNoLevelModel();
      expect(model.level).toBeUndefined();
    });
  });

  describe('FR-104-09: level property retrieval', () => {
    it('FR-104-09: Can retrieve L0 level via level property', () => {
      const model = new TestL0Model();
      expect(model.level).toBe('L0');
    });

    it('FR-104-09: Can retrieve L1 level via level property', () => {
      const model = new TestL1Model();
      expect(model.level).toBe('L1');
    });

    it('FR-104-09: Can retrieve L2 level via level property', () => {
      const model = new TestL2Model();
      expect(model.level).toBe('L2');
    });

    it('FR-104-09: level returns ModelLevel type (L0/L1/L2/L3)', () => {
      const model = new TestL1Model();
      const level = model.level;
      expect(['L0', 'L1', 'L2', 'L3', undefined]).toContain(level);
    });
  });

  describe('FR-104-08: the modelLevel of a model drives the relation level check of lint', () => {
    it('FR-104-08 reports a relation whose target level the modelLevel of the models does not allow', async () => {
      const l0 = new TestL0Model();
      const l1 = new TestL1Model();
      const l2 = new TestL2Model();
      const results = await runDesignLint([
        { model: l0, data: [{ id: 'L0-001', name: 'Business' }] },
        { model: l1, data: [{ id: 'L1-001', name: 'Requirement' }] },
        {
          model: l2,
          data: [{
            id: 'L2-001',
            name: 'Design',
            relations: [{ type: 'implements', target: 'L1-001' }, { type: 'implements', target: 'L0-001' }],
          }],
        },
      ], { models: [l0, l1, l2] });

      const violations = results.filter(result => result.ruleId === COMMON_LINT_RULES.relationLevel);
      expect(violations.map(violation => violation.message)).toEqual([expect.stringContaining('"L0-001"')]);
    });

    it('FR-104-08 leaves relations of a model without modelLevel unchecked', async () => {
      const l0 = new TestL0Model();
      const noLevel = new TestNoLevelModel();
      const results = await runDesignLint([
        { model: l0, data: [{ id: 'L0-001', name: 'Business' }] },
        { model: noLevel, data: [{ id: 'NL-001', name: 'Unlevelled', relations: [{ type: 'implements', target: 'L0-001' }] }] },
      ], { models: [l0, noLevel] });

      expect(results.filter(result => result.ruleId === COMMON_LINT_RULES.relationLevel)).toEqual([]);
    });
  });
});
