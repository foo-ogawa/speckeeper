import { describe, it, expect } from 'vitest';
import { resolveModelTemplate, inferLevelFromSubgraph } from '../../src/scaffold/template-registry.js';

describe('resolveModelTemplate', () => {
  describe('always uses base template (FR-SCF-028)', () => {
    it('resolves any class to base template with correct name derivation', () => {
      const result = resolveModelTemplate('FR', ['speckeeper', 'requirement']);
      expect(result.templateName).toBe('base');
      expect(result.modelName).toBe('Requirement');
      expect(result.fileName).toBe('requirement');
    });

    it('resolves usecase class to base template', () => {
      const result = resolveModelTemplate('UC', ['speckeeper', 'usecase']);
      expect(result.templateName).toBe('base');
      expect(result.modelName).toBe('Usecase');
      expect(result.fileName).toBe('usecase');
    });

    it('resolves unknown class to base template', () => {
      const result = resolveModelTemplate('X', ['speckeeper', 'custom-artifact']);
      expect(result.templateName).toBe('base');
      expect(result.modelName).toBe('CustomArtifact');
      expect(result.fileName).toBe('custom-artifact');
    });

    it('resolves logical-entity class to base with correct names', () => {
      const result = resolveModelTemplate('LDM', ['speckeeper', 'logical-entity']);
      expect(result.templateName).toBe('base');
      expect(result.modelName).toBe('LogicalEntity');
      expect(result.fileName).toBe('logical-entity');
    });

    it('uses base when no classes provided', () => {
      const result = resolveModelTemplate('MyNode');
      expect(result.templateName).toBe('base');
      expect(result.modelName).toBe('Mynode');
      expect(result.fileName).toBe('my-node');
    });

    it('uses base when only speckeeper class', () => {
      const result = resolveModelTemplate('MyNode', ['speckeeper']);
      expect(result.templateName).toBe('base');
    });

    it('no structural difference between class-specified and unspecified', () => {
      const withClass = resolveModelTemplate('FR', ['speckeeper', 'requirement']);
      const withoutClass = resolveModelTemplate('SomeNode');
      expect(withClass.templateName).toBe(withoutClass.templateName);
    });
  });

  describe('subgraph level inference', () => {
    it('infers L0 from business subgraph', () => {
      const result = resolveModelTemplate('T', ['speckeeper', 'term'], 'business');
      expect(result.defaultLevel).toBe('L0');
    });

    it('infers L1 from requirement subgraph', () => {
      const result = resolveModelTemplate('FR', ['speckeeper', 'requirement'], 'requirement');
      expect(result.defaultLevel).toBe('L1');
    });

    it('infers L2 from design subgraph', () => {
      const result = resolveModelTemplate('CDM', ['speckeeper', 'entity'], 'design');
      expect(result.defaultLevel).toBe('L2');
    });

    it('infers L3 from implementation subgraph', () => {
      const result = resolveModelTemplate('LDM', ['speckeeper', 'logical-entity'], 'implementation');
      expect(result.defaultLevel).toBe('L3');
    });

    it('infers L0 for explicit L0 subgraph', () => {
      const result = resolveModelTemplate('T', [], 'L0');
      expect(result.defaultLevel).toBe('L0');
    });

    it('infers L2 for architecture subgraph', () => {
      const result = resolveModelTemplate('COMP', [], 'architecture');
      expect(result.defaultLevel).toBe('L2');
    });

    it('defaults to L0 when no subgraph', () => {
      const result = resolveModelTemplate('X', ['speckeeper', 'term']);
      expect(result.defaultLevel).toBe('L0');
    });

    it('defaults to L0 for unrecognised subgraph name', () => {
      const result = resolveModelTemplate('X', [], 'myCustomGroup');
      expect(result.defaultLevel).toBe('L0');
    });
  });

  describe('idPrefix derivation', () => {
    it('uses node ID as default idPrefix', () => {
      const result = resolveModelTemplate('FR', ['speckeeper', 'requirement']);
      expect(result.defaultIdPrefix).toBe('FR');
    });

    it('preserves original node ID casing for idPrefix', () => {
      const result = resolveModelTemplate('MyModel', ['speckeeper', 'base']);
      expect(result.defaultIdPrefix).toBe('MyModel');
    });
  });
});

describe('inferLevelFromSubgraph', () => {
  it('returns L0 for undefined', () => {
    expect(inferLevelFromSubgraph(undefined)).toBe('L0');
  });

  it('matches domain keyword', () => {
    expect(inferLevelFromSubgraph('domain')).toBe('L0');
  });

  it('matches external keyword for L3', () => {
    expect(inferLevelFromSubgraph('external')).toBe('L3');
  });

  it('is case-insensitive', () => {
    expect(inferLevelFromSubgraph('REQUIREMENT')).toBe('L1');
    expect(inferLevelFromSubgraph('Design')).toBe('L2');
  });
});
