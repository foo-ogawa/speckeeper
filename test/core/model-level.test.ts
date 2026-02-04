/**
 * FR-104: Model definition - modelLevel tests
 * 
 * Test functionality for setting modelLevel on model classes and enabling relation constraint validation
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Model, RelationSchema } from '../../src/core/model.js';
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

  describe('Integration with relation constraint validation', () => {
    it('Relation validation is possible on models with modelLevel set', () => {
      const model = new TestL2Model();
      const spec = {
        id: 'L2-001',
        name: 'Test Spec',
        relations: [
          { type: 'implements' as const, target: 'L1-001', description: 'Implements L1' },
        ],
      };
      
      // Verify that validateRelations can be called
      const errors = model.validateRelations(spec);
      expect(Array.isArray(errors)).toBe(true);
    });

    it('Relation validation works on models without modelLevel (level check is skipped)', () => {
      const model = new TestNoLevelModel();
      const spec = {
        id: 'NL-001',
        name: 'Test Spec',
        relations: [
          { type: 'relatedTo' as const, target: 'OTHER-001', description: 'Related' },
        ],
      };
      
      const errors = model.validateRelations(spec);
      expect(Array.isArray(errors)).toBe(true);
    });
  });
});
