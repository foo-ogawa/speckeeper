/**
 * FR-401, FR-701: relation level constraints and circular reference detection
 */
import { describe, it, expect } from 'vitest';
import {
  RELATION_CONSTRAINTS,
  validateRelationLevel,
  detectCycles,
} from '../../src/core/relation.js';
import type { RelationType } from '../../src/core/relation.js';

describe('FR-701: validateRelationLevel', () => {
  describe('FR-701-04: constraints are defined per relation type', () => {
    it('FR-701-04 applies a different target-level constraint to each relation type', () => {
      const relation = { type: 'implements' as const, target: 'X-001' };

      // implements only accepts an L1 target; verifiedBy only accepts L2/L3.
      expect(validateRelationLevel('L3', 'A-001', relation, 'L1')).toBeNull();
      expect(validateRelationLevel('L3', 'A-001', relation, 'L3')).toMatchObject({
        type: 'target_level_violation',
      });

      const verifiedBy = { type: 'verifiedBy' as const, target: 'X-001' };
      expect(validateRelationLevel('L1', 'A-001', verifiedBy, 'L3')).toBeNull();
      expect(validateRelationLevel('L1', 'A-001', verifiedBy, 'L1')).toMatchObject({
        type: 'target_level_violation',
      });
    });

    it('FR-701-04 every relation type declares a level rule and a propagation direction', () => {
      for (const [type, constraint] of Object.entries(RELATION_CONSTRAINTS)) {
        expect(constraint.levelRule, type).toBeDefined();
        expect(constraint.propagation, type).toBeDefined();
      }
    });
  });

  describe('FR-701-05: level violations are detected', () => {
    it('FR-701-05 reports a level violation when source is not more concrete than target', () => {
      const refines = { type: 'refines' as const, target: 'B-001' };

      // refines uses levelRule source>target, so L1 → L1 is a violation.
      expect(validateRelationLevel('L2', 'A-001', refines, 'L1')).toBeNull();
      expect(validateRelationLevel('L1', 'A-001', refines, 'L1')).toMatchObject({
        type: 'level_violation',
      });
    });

    it('FR-701-05 reports a level violation when a same-level relation crosses levels', () => {
      const includes = { type: 'includes' as const, target: 'B-001' };

      expect(validateRelationLevel('L1', 'A-001', includes, 'L1')).toBeNull();
      expect(validateRelationLevel('L1', 'A-001', includes, 'L2')).toMatchObject({
        type: 'level_violation',
      });
    });

    it('FR-701-05 reports a self reference regardless of level', () => {
      const error = validateRelationLevel('L1', 'A-001', { type: 'relatedTo', target: 'A-001' }, 'L1');

      expect(error).toMatchObject({ type: 'self_reference', sourceId: 'A-001' });
    });

    it('FR-701-05 skips the level check when either level is unknown', () => {
      const refines = { type: 'refines' as const, target: 'B-001' };

      expect(validateRelationLevel(undefined, 'A-001', refines, 'L1')).toBeNull();
      expect(validateRelationLevel('L1', 'A-001', refines, undefined)).toBeNull();
    });
  });
});

describe('FR-401: detectCycles', () => {
  function rel(sourceId: string, targetId: string, type: RelationType = 'dependsOn') {
    return { sourceId, targetId, type };
  }

  describe('FR-401-04: circular references are detected', () => {
    it('FR-401-04 returns no error for an acyclic relation graph', () => {
      const errors = detectCycles([
        rel('FR-001', 'UC-001'),
        rel('UC-001', 'TERM-001'),
        rel('FR-002', 'UC-001'),
      ]);

      expect(errors).toEqual([]);
    });

    it('FR-401-04 detects a cycle and names every node on the cycle path', () => {
      const errors = detectCycles([
        rel('FR-001', 'FR-002'),
        rel('FR-002', 'FR-003'),
        rel('FR-003', 'FR-001'),
      ]);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('cycle_detected');
      expect(errors[0].message).toContain('FR-001');
      expect(errors[0].message).toContain('FR-002');
      expect(errors[0].message).toContain('FR-003');
    });

    it('FR-401-04 detects a direct two-node cycle', () => {
      const errors = detectCycles([
        rel('FR-001', 'FR-002'),
        rel('FR-002', 'FR-001'),
      ]);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('cycle_detected');
      expect(errors[0].relation.target).toBe('FR-001');
    });
  });
});
