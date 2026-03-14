import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { relationCoverage } from '../../../src/core/dsl/checkers.js';
import {
  openapiScanner,
  ddlScanner,
  runGlobalScan,
  runDeepValidation,
  type LookupKeyMap,
} from '../../../src/core/global-scanner.js';
import { computeTransitiveCoverage } from '../../../src/cli/check.js';
import type { SourceConfig } from '../../../src/core/config-api.js';

interface SimpleSpec {
  id: string;
  name: string;
  relations?: Array<{ type: string; target: string }>;
}

const FIXTURES_DIR = join(__dirname, 'fixtures');

function fixturePath(filename: string): string {
  return join(FIXTURES_DIR, filename);
}

function loadYaml(filename: string): unknown {
  const content = readFileSync(fixturePath(filename), 'utf-8');
  return parseYaml(content);
}

function loadJson(filename: string): unknown {
  const content = readFileSync(fixturePath(filename), 'utf-8');
  return JSON.parse(content);
}

function loadSql(filename: string): string {
  return readFileSync(fixturePath(filename), 'utf-8');
}

// ---------------------------------------------------------------------------
// openapiScanner
// ---------------------------------------------------------------------------

describe('openapiScanner', () => {
  describe('spec ID existence check', () => {
    it('finds spec ID via operationId', () => {
      const doc = loadYaml('valid.openapi.yaml');
      const matches = openapiScanner.findSpecIds(doc, ['listUsers'], 'api/openapi.yaml');
      expect(matches).toHaveLength(1);
      expect(matches[0].specId).toBe('listUsers');
    });

    it('finds spec ID via x-spec-id extension', () => {
      const doc = loadYaml('valid.openapi.yaml');
      const matches = openapiScanner.findSpecIds(doc, ['FR-001'], 'api/openapi.yaml');
      expect(matches).toHaveLength(1);
      expect(matches[0].specId).toBe('FR-001');
    });

    it('finds spec ID via path segment', () => {
      const doc = loadYaml('valid.openapi.yaml');
      const matches = openapiScanner.findSpecIds(doc, ['users'], 'api/openapi.yaml');
      expect(matches).toHaveLength(1);
      expect(matches[0].specId).toBe('users');
    });

    it('finds spec ID via schema name', () => {
      const doc = loadYaml('valid.openapi.yaml');
      const matches = openapiScanner.findSpecIds(doc, ['User'], 'api/openapi.yaml');
      expect(matches).toHaveLength(1);
      expect(matches[0].specId).toBe('User');
    });

    it('returns empty when spec ID is missing from document', () => {
      const doc = loadYaml('valid.openapi.yaml');
      const matches = openapiScanner.findSpecIds(doc, ['nonExistentOperation'], 'api/openapi.yaml');
      expect(matches).toHaveLength(0);
    });

    it('does NOT match spec ID that appears only in YAML comment', () => {
      const doc = loadYaml('comment-only-id.openapi.yaml');
      const matches = openapiScanner.findSpecIds(doc, ['FR-001'], 'api/openapi.yaml');
      expect(matches).toHaveLength(0);
    });

    it('finds multiple spec IDs in one scan', () => {
      const doc = loadYaml('valid.openapi.yaml');
      const matches = openapiScanner.findSpecIds(
        doc,
        ['listUsers', 'getUser', 'User', 'nonExistent'],
        'api/openapi.yaml',
      );
      const foundIds = matches.map(m => m.specId);
      expect(foundIds).toContain('listUsers');
      expect(foundIds).toContain('getUser');
      expect(foundIds).toContain('User');
      expect(foundIds).not.toContain('nonExistent');
    });
  });

  describe('JSON format', () => {
    it('parses JSON format OpenAPI file', () => {
      const doc = loadJson('valid.openapi.json');
      const matches = openapiScanner.findSpecIds(doc, ['listUsers'], 'api/openapi.json');
      expect(matches).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// ddlScanner
// ---------------------------------------------------------------------------

describe('ddlScanner', () => {
  describe('table existence check', () => {
    it('finds existing table (case-insensitive)', () => {
      const content = loadSql('valid.schema.sql');
      const matches = ddlScanner.findSpecIds(content, ['users', 'USERS'], 'db/schema.sql');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches.some(m => m.specId === 'users')).toBe(true);
    });

    it('returns empty when table is missing', () => {
      const content = loadSql('missing-table.schema.sql');
      const matches = ddlScanner.findSpecIds(content, ['orders'], 'db/schema.sql');
      expect(matches).toHaveLength(0);
    });

    it('does NOT match table name in SQL comment', () => {
      const content = loadSql('comment-only-id.schema.sql');
      const matches = ddlScanner.findSpecIds(content, ['users'], 'db/schema.sql');
      expect(matches).toHaveLength(0);
    });
  });

  describe('schema-qualified table names', () => {
    it('strips schema prefix (public.users -> users)', () => {
      const content = loadSql('schema-qualified.schema.sql');
      const matches = ddlScanner.findSpecIds(content, ['users', 'orders', 'products'], 'db/schema.sql');
      const ids = matches.map(m => m.specId);
      expect(ids).toContain('users');
      expect(ids).toContain('orders');
      expect(ids).toContain('products');
    });
  });

  describe('PostgreSQL dialect', () => {
    it('parses PostgreSQL DDL and finds table', () => {
      const content = loadSql('postgres-dialect.schema.sql');
      const matches = ddlScanner.findSpecIds(content, ['accounts'], 'db/schema.sql');
      expect(matches).toHaveLength(1);
      expect(matches[0].specId).toBe('accounts');
    });
  });
});

// ---------------------------------------------------------------------------
// runGlobalScan integration
// ---------------------------------------------------------------------------

describe('runGlobalScan', () => {
  it('scans OpenAPI source and returns matches', () => {
    const sources: SourceConfig[] = [{
      type: 'openapi',
      paths: ['test/core/dsl/fixtures/valid.openapi.yaml'],
      relation: 'implements',
    }];
    const { matches, warnings } = runGlobalScan(sources, ['listUsers', 'getUser', 'nonExistent']);
    expect(matches.has('listUsers')).toBe(true);
    expect(matches.has('getUser')).toBe(true);
    expect(matches.has('nonExistent')).toBe(false);
    expect(warnings.filter(w => w.message.includes('Failed'))).toHaveLength(0);
  });

  it('scans DDL source and returns matches', () => {
    const sources: SourceConfig[] = [{
      type: 'ddl',
      paths: ['test/core/dsl/fixtures/valid.schema.sql'],
      relation: 'implements',
    }];
    const { matches } = runGlobalScan(sources, ['users', 'orders', 'nonExistent']);
    expect(matches.has('users')).toBe(true);
    expect(matches.has('nonExistent')).toBe(false);
  });

  it('reports warning when no scanner found for unknown type', () => {
    const sources: SourceConfig[] = [{
      type: 'unknown-type',
      paths: ['some/path'],
      relation: 'implements',
    }];
    const { warnings } = runGlobalScan(sources, ['any-id']);
    expect(warnings.some(w => w.message.includes('No scanner found'))).toBe(true);
  });

  it('sets relation from source config on matches', () => {
    const sources: SourceConfig[] = [{
      type: 'openapi',
      paths: ['test/core/dsl/fixtures/valid.openapi.yaml'],
      relation: 'verifiedBy',
    }];
    const { matches } = runGlobalScan(sources, ['listUsers']);
    const m = matches.get('listUsers');
    expect(m).toBeDefined();
    expect(m![0].relation).toBe('verifiedBy');
  });
});

// ---------------------------------------------------------------------------
// runDeepValidation — OpenAPI
// ---------------------------------------------------------------------------

describe('runDeepValidation (OpenAPI)', () => {
  function getOpenAPIMatchesForSpec(specId: string, fixture = 'valid.openapi.yaml') {
    const sources: SourceConfig[] = [{
      type: 'openapi',
      paths: [`test/core/dsl/fixtures/${fixture}`],
      relation: 'implements',
    }];
    const { matches } = runGlobalScan(sources, [specId]);
    return matches.get(specId) ?? [];
  }

  it('does not warn when method matches', () => {
    const matches = getOpenAPIMatchesForSpec('listUsers');
    const result = runDeepValidation('listUsers', matches, {
      openapi: { mapper: () => ({ path: '/users', method: 'GET' }) },
    }, { id: 'listUsers', name: 'List' });
    expect(result.warnings).toHaveLength(0);
  });

  it('warns on method mismatch', () => {
    const matches = getOpenAPIMatchesForSpec('listUsers');
    const result = runDeepValidation('listUsers', matches, {
      openapi: { mapper: () => ({ path: '/users', method: 'DELETE' }) },
    }, { id: 'listUsers', name: 'List' });
    expect(result.warnings.some(w => w.message.includes('Method mismatch'))).toBe(true);
  });

  it('finds expected parameter', () => {
    const matches = getOpenAPIMatchesForSpec('getUser');
    const result = runDeepValidation('getUser', matches, {
      openapi: {
        mapper: () => ({
          path: '/users/{id}',
          parameters: [{ name: 'id', in: 'path', type: 'string' }],
        }),
      },
    }, { id: 'getUser', name: 'Get User' });
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when parameter is missing', () => {
    const matches = getOpenAPIMatchesForSpec('getUser');
    const result = runDeepValidation('getUser', matches, {
      openapi: {
        mapper: () => ({
          path: '/users/{id}',
          parameters: [{ name: 'limit', in: 'query' }],
        }),
      },
    }, { id: 'getUser', name: 'Get User' });
    expect(result.warnings.some(w => w.message.includes('limit') && w.message.includes('not found'))).toBe(true);
  });

  it('warns on parameter type mismatch', () => {
    const matches = getOpenAPIMatchesForSpec('getUser');
    const result = runDeepValidation('getUser', matches, {
      openapi: {
        mapper: () => ({
          path: '/users/{id}',
          parameters: [{ name: 'id', in: 'path', type: 'number' }],
        }),
      },
    }, { id: 'getUser', name: 'Get User' });
    expect(result.warnings.some(w => w.message.includes('type mismatch'))).toBe(true);
  });

  it('finds expected response properties', () => {
    const matches = getOpenAPIMatchesForSpec('listUsers');
    const result = runDeepValidation('listUsers', matches, {
      openapi: {
        mapper: () => ({
          path: '/users',
          responseProperties: [
            { name: 'id', type: 'integer' },
            { name: 'name', type: 'string' },
          ],
        }),
      },
    }, { id: 'listUsers', name: 'List Users' });
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when response property is missing', () => {
    const matches = getOpenAPIMatchesForSpec('listUsers');
    const result = runDeepValidation('listUsers', matches, {
      openapi: {
        mapper: () => ({
          path: '/users',
          responseProperties: [{ name: 'nonexistent' }],
        }),
      },
    }, { id: 'listUsers', name: 'List Users' });
    expect(result.warnings.some(w => w.message.includes('nonexistent'))).toBe(true);
  });

  it('resolves $ref for parameters', () => {
    const matches = getOpenAPIMatchesForSpec('getItem', 'ref-resolution.openapi.yaml');
    const result = runDeepValidation('getItem', matches, {
      openapi: {
        mapper: () => ({
          path: '/items/{id}',
          parameters: [{ name: 'id', in: 'path', type: 'string' }],
        }),
      },
    }, { id: 'getItem', name: 'Get Item' });
    expect(result.warnings).toHaveLength(0);
  });

  it('resolves $ref for response schema', () => {
    const matches = getOpenAPIMatchesForSpec('getItem', 'ref-resolution.openapi.yaml');
    const result = runDeepValidation('getItem', matches, {
      openapi: {
        mapper: () => ({
          path: '/items/{id}',
          responseProperties: [
            { name: 'id', type: 'integer' },
            { name: 'name', type: 'string' },
            { name: 'price', type: 'number' },
          ],
        }),
      },
    }, { id: 'getItem', name: 'Get Item' });
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// runDeepValidation — DDL
// ---------------------------------------------------------------------------

describe('runDeepValidation (DDL)', () => {
  function getDDLMatchesForSpec(specId: string, fixture = 'valid.schema.sql') {
    const sources: SourceConfig[] = [{
      type: 'ddl',
      paths: [`test/core/dsl/fixtures/${fixture}`],
      relation: 'implements',
    }];
    const { matches } = runGlobalScan(sources, [specId]);
    return matches.get(specId) ?? [];
  }

  it('finds existing columns', () => {
    const matches = getDDLMatchesForSpec('users');
    const result = runDeepValidation('users', matches, {
      ddl: {
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'id' }, { name: 'name' }, { name: 'email' }],
        }),
      },
    }, { id: 'users', name: 'Users' });
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when column is missing', () => {
    const matches = getDDLMatchesForSpec('users', 'missing-column.schema.sql');
    const result = runDeepValidation('users', matches, {
      ddl: {
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'id' }, { name: 'email' }],
        }),
      },
    }, { id: 'users', name: 'Users' });
    expect(result.warnings.some(w => w.message.includes('email') && w.message.includes('not found'))).toBe(true);
  });

  it('accepts wider type (SMALLINT in INT column)', () => {
    const matches = getDDLMatchesForSpec('users');
    const result = runDeepValidation('users', matches, {
      ddl: {
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'id', type: 'SMALLINT' }],
          checkTypes: true,
        }),
      },
    }, { id: 'users', name: 'Users' });
    const typeWarnings = result.warnings.filter(w => w.message.includes('type mismatch'));
    expect(typeWarnings).toHaveLength(0);
  });

  it('warns on narrower type', () => {
    const matches = getDDLMatchesForSpec('users', 'type-mismatch.schema.sql');
    const result = runDeepValidation('users', matches, {
      ddl: {
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'id', type: 'INT' }],
          checkTypes: true,
        }),
      },
    }, { id: 'users', name: 'Users' });
    expect(result.warnings.some(w => w.message.includes('type mismatch'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// relationCoverage (unchanged — existing tests)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// runGlobalScan with lookupKeyMap
// ---------------------------------------------------------------------------

describe('runGlobalScan with lookupKeyMap', () => {
  it('matches DDL table via lookup key instead of spec ID', () => {
    const sources: SourceConfig[] = [{
      type: 'ddl',
      paths: ['test/core/dsl/fixtures/valid.schema.sql'],
      relation: 'implements',
    }];
    // Spec ID is "user-entity" but DDL table is "users"
    const lookupKeyMap: LookupKeyMap = new Map([
      ['user-entity', { ddl: 'users' }],
    ]);
    const { matches } = runGlobalScan(sources, ['user-entity'], undefined, lookupKeyMap);
    expect(matches.has('user-entity')).toBe(true);
    const m = matches.get('user-entity')!;
    expect(m[0].specId).toBe('user-entity');
    expect(m[0].sourceType).toBe('ddl');
  });

  it('does not match when lookup key does not exist in DDL', () => {
    const sources: SourceConfig[] = [{
      type: 'ddl',
      paths: ['test/core/dsl/fixtures/valid.schema.sql'],
      relation: 'implements',
    }];
    const lookupKeyMap: LookupKeyMap = new Map([
      ['user-entity', { ddl: 'nonexistent_table' }],
    ]);
    const { matches } = runGlobalScan(sources, ['user-entity'], undefined, lookupKeyMap);
    expect(matches.has('user-entity')).toBe(false);
  });

  it('uses spec ID as-is for source types without lookup key override', () => {
    const sources: SourceConfig[] = [
      {
        type: 'openapi',
        paths: ['test/core/dsl/fixtures/valid.openapi.yaml'],
        relation: 'implements',
      },
      {
        type: 'ddl',
        paths: ['test/core/dsl/fixtures/valid.schema.sql'],
        relation: 'implements',
      },
    ];
    // Only DDL has a lookup key override; OpenAPI uses "listUsers" as-is
    const lookupKeyMap: LookupKeyMap = new Map([
      ['listUsers', { ddl: 'users' }],
    ]);
    const { matches } = runGlobalScan(sources, ['listUsers'], undefined, lookupKeyMap);
    expect(matches.has('listUsers')).toBe(true);
    const m = matches.get('listUsers')!;
    const sourceTypes = m.map(x => x.sourceType);
    expect(sourceTypes).toContain('openapi');
    expect(sourceTypes).toContain('ddl');
  });

  it('falls back to spec ID when lookupKeyMap is not provided', () => {
    const sources: SourceConfig[] = [{
      type: 'ddl',
      paths: ['test/core/dsl/fixtures/valid.schema.sql'],
      relation: 'implements',
    }];
    const { matches } = runGlobalScan(sources, ['users']);
    expect(matches.has('users')).toBe(true);
  });

  it('supports deep validation after lookup key match', () => {
    const sources: SourceConfig[] = [{
      type: 'ddl',
      paths: ['test/core/dsl/fixtures/valid.schema.sql'],
      relation: 'implements',
    }];
    const lookupKeyMap: LookupKeyMap = new Map([
      ['user-entity', { ddl: 'users' }],
    ]);
    const { matches } = runGlobalScan(sources, ['user-entity'], undefined, lookupKeyMap);
    const specMatches = matches.get('user-entity') ?? [];
    expect(specMatches).toHaveLength(1);

    const result = runDeepValidation('user-entity', specMatches, {
      ddl: {
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'id' }, { name: 'name' }],
        }),
      },
    }, { id: 'user-entity', name: 'User Entity' });
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// computeTransitiveCoverage
// ---------------------------------------------------------------------------

describe('computeTransitiveCoverage', () => {
  it('returns only direct coverage when transitiveRelations is empty', () => {
    const direct = new Set(['FR-001', 'FR-002']);
    const specs = [
      { id: 'FR-001', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      { id: 'FR-002', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      { id: 'UC-001' },
    ];
    const result = computeTransitiveCoverage(direct, specs, []);
    expect(result.coveredSet.size).toBe(2);
    expect(result.transitiveCount).toBe(0);
    expect(result.coveredSet.has('UC-001')).toBe(false);
  });

  it('transitively covers target when all sources are covered', () => {
    const direct = new Set(['FR-001', 'FR-002']);
    const specs = [
      { id: 'FR-001', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      { id: 'FR-002', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      { id: 'UC-001' },
    ];
    const result = computeTransitiveCoverage(direct, specs, ['satisfies']);
    expect(result.coveredSet.has('UC-001')).toBe(true);
    expect(result.directCount).toBe(2);
    expect(result.transitiveCount).toBe(1);
  });

  it('does not transitively cover target when some sources are uncovered', () => {
    const direct = new Set(['FR-001']);
    const specs = [
      { id: 'FR-001', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      { id: 'FR-002', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      { id: 'UC-001' },
    ];
    const result = computeTransitiveCoverage(direct, specs, ['satisfies']);
    expect(result.coveredSet.has('UC-001')).toBe(false);
    expect(result.transitiveCount).toBe(0);
  });

  it('does not transitively cover target when no sources exist', () => {
    const direct = new Set(['FR-001']);
    const specs = [
      { id: 'FR-001' },
      { id: 'UC-001' },
    ];
    const result = computeTransitiveCoverage(direct, specs, ['satisfies']);
    expect(result.coveredSet.has('UC-001')).toBe(false);
  });

  it('handles multi-level transitive chains', () => {
    const direct = new Set(['TEST-001']);
    const specs = [
      { id: 'TEST-001', relations: [{ type: 'verifies', target: 'FR-001' }] },
      { id: 'FR-001', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      { id: 'UC-001' },
    ];
    const result = computeTransitiveCoverage(direct, specs, ['satisfies', 'verifies']);
    expect(result.coveredSet.has('FR-001')).toBe(true);
    expect(result.coveredSet.has('UC-001')).toBe(true);
    expect(result.transitiveCount).toBe(2);
  });

  it('ignores non-transitive relation types', () => {
    const direct = new Set(['FR-001']);
    const specs = [
      { id: 'FR-001', relations: [{ type: 'dependsOn', target: 'UC-001' }] },
      { id: 'UC-001' },
    ];
    const result = computeTransitiveCoverage(direct, specs, ['satisfies']);
    expect(result.coveredSet.has('UC-001')).toBe(false);
  });

  it('handles specs without relations gracefully', () => {
    const direct = new Set(['FR-001']);
    const specs = [
      { id: 'FR-001' },
      { id: 'UC-001' },
    ];
    const result = computeTransitiveCoverage(direct, specs, ['satisfies']);
    expect(result.coveredSet.size).toBe(1);
    expect(result.coveredSet.has('FR-001')).toBe(true);
  });
});
