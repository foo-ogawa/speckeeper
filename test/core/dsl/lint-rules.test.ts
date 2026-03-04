import { describe, it, expect } from 'vitest';
import { requireField, arrayMinLength, idFormat, childIdFormat } from '../../../src/core/dsl/lint-rules.js';
import type { LintRule } from '../../../src/core/model.js';

interface TestSpec {
  id: string;
  name: string;
  description: string;
  items: string[];
  children: { childId: string }[];
}

describe('requireField', () => {
  const rule = requireField<TestSpec>('description');

  it('returns true when field is empty string', () => {
    expect(rule.check({ id: 'T-001', name: 'x', description: '', items: [], children: [] })).toBe(true);
  });

  it('returns true when field is whitespace', () => {
    expect(rule.check({ id: 'T-001', name: 'x', description: '  ', items: [], children: [] })).toBe(true);
  });

  it('returns false when field has value', () => {
    expect(rule.check({ id: 'T-001', name: 'x', description: 'hello', items: [], children: [] })).toBe(false);
  });

  it('uses provided severity', () => {
    const errRule = requireField<TestSpec>('name', 'error');
    expect(errRule.severity).toBe('error');
  });

  it('defaults to warning severity', () => {
    expect(rule.severity).toBe('warning');
  });
});

describe('arrayMinLength', () => {
  const rule = arrayMinLength<TestSpec>('items', 1);

  it('returns true when array is empty', () => {
    expect(rule.check({ id: 'T-001', name: 'x', description: 'x', items: [], children: [] })).toBe(true);
  });

  it('returns false when array meets minimum', () => {
    expect(rule.check({ id: 'T-001', name: 'x', description: 'x', items: ['a'], children: [] })).toBe(false);
  });

  it('returns true when field is not an array', () => {
    const spec = { id: 'T-001', name: 'x', description: 'x', items: 'not-array' as unknown as string[], children: [] };
    expect(rule.check(spec)).toBe(true);
  });
});

describe('idFormat', () => {
  const rule = idFormat<TestSpec>('FR');

  it('returns false for valid ID FR-001', () => {
    expect(rule.check({ id: 'FR-001', name: 'x', description: 'x', items: [], children: [] })).toBe(false);
  });

  it('returns true for invalid ID FR-1', () => {
    expect(rule.check({ id: 'FR-1', name: 'x', description: 'x', items: [], children: [] })).toBe(true);
  });

  it('supports custom digits', () => {
    const rule4 = idFormat<TestSpec>('UC', { digits: 4 });
    expect(rule4.check({ id: 'UC-0001', name: 'x', description: 'x', items: [], children: [] })).toBe(false);
    expect(rule4.check({ id: 'UC-001', name: 'x', description: 'x', items: [], children: [] })).toBe(true);
  });

  it('supports custom pattern', () => {
    const customRule = idFormat<TestSpec>('X', { pattern: /^TEST-\d+$/ });
    expect(customRule.check({ id: 'TEST-42', name: 'x', description: 'x', items: [], children: [] })).toBe(false);
    expect(customRule.check({ id: 'FR-001', name: 'x', description: 'x', items: [], children: [] })).toBe(true);
  });
});

describe('childIdFormat', () => {
  const rule = childIdFormat<TestSpec>('children', 'childId');

  it('returns false when all children follow parent ID', () => {
    const spec: TestSpec = { id: 'FR-001', name: 'x', description: 'x', items: [], children: [{ childId: 'FR-001-01' }] };
    expect(rule.check(spec)).toBe(false);
  });

  it('returns true when a child does not follow parent ID', () => {
    const spec: TestSpec = { id: 'FR-001', name: 'x', description: 'x', items: [], children: [{ childId: 'OTHER-01' }] };
    expect(rule.check(spec)).toBe(true);
  });

  it('returns false when children array is empty', () => {
    const spec: TestSpec = { id: 'FR-001', name: 'x', description: 'x', items: [], children: [] };
    expect(rule.check(spec)).toBe(false);
  });
});

describe('FR-SCF-014: core factory + custom lint rule coexistence', () => {
  const factoryRules: LintRule<TestSpec>[] = [
    requireField<TestSpec>('description', 'error'),
    arrayMinLength<TestSpec>('items', 1),
    idFormat<TestSpec>('FR'),
    childIdFormat<TestSpec>('children', 'childId'),
  ];

  const customRule: LintRule<TestSpec> = {
    id: 'custom-name-not-test',
    severity: 'warning',
    message: 'Name must not be "test"',
    check: (spec) => spec.name === 'test',
  };

  const allRules = [...factoryRules, customRule];

  it('combines factory and custom rules in one array', () => {
    expect(allRules).toHaveLength(5);
    expect(allRules.map(r => r.id)).toEqual([
      'has-description',
      'items-min-1',
      'id-format',
      'children-id-format',
      'custom-name-not-test',
    ]);
  });

  it('all rules execute independently on valid spec', () => {
    const valid: TestSpec = {
      id: 'FR-001', name: 'Feature', description: 'A feature',
      items: ['a'], children: [{ childId: 'FR-001-01' }],
    };
    const violations = allRules.filter(r => r.check(valid));
    expect(violations).toHaveLength(0);
  });

  it('factory and custom rules detect violations independently', () => {
    const spec: TestSpec = {
      id: 'BAD', name: 'test', description: '',
      items: [], children: [{ childId: 'OTHER-01' }],
    };
    const violations = allRules.filter(r => r.check(spec));
    expect(violations).toHaveLength(5);
  });

  it('only custom rule triggers on spec that passes factory rules', () => {
    const spec: TestSpec = {
      id: 'FR-001', name: 'test', description: 'ok',
      items: ['a'], children: [{ childId: 'FR-001-01' }],
    };
    const violations = allRules.filter(r => r.check(spec));
    expect(violations).toHaveLength(1);
    expect(violations[0].id).toBe('custom-name-not-test');
  });
});
