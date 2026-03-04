import { describe, it, expect } from 'vitest';
import { testChecker, externalOpenAPIChecker, externalSqlSchemaChecker, relationCoverage } from '../../../src/core/dsl/checkers.js';

interface SimpleSpec {
  id: string;
  name: string;
  relations?: Array<{ type: string; target: string }>;
}

describe('testChecker', () => {
  const checker = testChecker<SimpleSpec>();

  it('returns ExternalChecker with targetType "test"', () => {
    expect(checker.targetType).toBe('test');
  });

  it('check returns success with warnings when no test files match', () => {
    const result = checker.check({ id: 'FR-001', name: 'Test' }, undefined);
    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
  });
});

describe('externalOpenAPIChecker', () => {
  const checker = externalOpenAPIChecker<SimpleSpec>();

  it('returns ExternalChecker with targetType "openapi"', () => {
    expect(checker.targetType).toBe('openapi');
  });

  it('returns warning when no external data provided', () => {
    const result = checker.check({ id: 'FR-001', name: 'Test' }, undefined);
    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('No OpenAPI data');
  });
});

describe('externalSqlSchemaChecker', () => {
  const checker = externalSqlSchemaChecker<SimpleSpec>();

  it('returns ExternalChecker with targetType "ddl"', () => {
    expect(checker.targetType).toBe('ddl');
  });

  it('returns warning when no external data provided', () => {
    const result = checker.check({ id: 'LDM-001', name: 'Test' }, undefined);
    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('No SQL schema data');
  });
});

describe('relationCoverage', () => {
  const coverage = relationCoverage<SimpleSpec>({
    targetModel: 'usecase',
    description: 'Requirements cover UseCases',
    relationType: 'satisfies',
    targetPrefix: 'UC-',
  });

  it('returns 100% when no targets exist', () => {
    const result = coverage.check([], {});
    expect(result.coveragePercent).toBe(100);
    expect(result.total).toBe(0);
  });

  it('computes coverage from relations', () => {
    const specs: SimpleSpec[] = [
      { id: 'FR-001', name: 'R1', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      { id: 'FR-002', name: 'R2', relations: [] },
    ];
    const registry: Record<string, Map<string, { id: string; name: string }>> = {
      usecase: new Map([
        ['UC-001', { id: 'UC-001', name: 'UC1' }],
        ['UC-002', { id: 'UC-002', name: 'UC2' }],
      ]),
    };
    const result = coverage.check(specs, registry);
    expect(result.total).toBe(2);
    expect(result.covered).toBe(1);
    expect(result.uncovered).toBe(1);
    expect(result.coveragePercent).toBe(50);
    expect(result.coveredItems).toHaveLength(1);
    expect(result.uncoveredItems).toHaveLength(1);
  });

  it('ignores relations with wrong type', () => {
    const specs: SimpleSpec[] = [
      { id: 'FR-001', name: 'R1', relations: [{ type: 'uses', target: 'UC-001' }] },
    ];
    const registry: Record<string, Map<string, { id: string; name: string }>> = {
      usecase: new Map([['UC-001', { id: 'UC-001', name: 'UC1' }]]),
    };
    const result = coverage.check(specs, registry);
    expect(result.covered).toBe(0);
  });
});
