import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import nodeSqlParser from 'node-sql-parser';
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

describe('FR-1001, FR-1002: openapiScanner', () => {
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

describe('FR-1009: ddlScanner', () => {
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

  describe('FR-1015: parser failure fallback', () => {
    it('falls back to regex parsing when node-sql-parser rejects the file', () => {
      const content = loadSql('parser-fail-regex-ok.schema.sql');
      // Without a working fallback this file yields nothing: the parser rejects it.
      expect(() => new nodeSqlParser.Parser().astify(content)).toThrow();

      const matches = ddlScanner.findSpecIds(content, ['audit_log'], 'db/schema.sql');
      expect(matches).toHaveLength(1);
      expect(matches[0].specId).toBe('audit_log');
    });
  });
});

// ---------------------------------------------------------------------------
// runGlobalScan integration
// ---------------------------------------------------------------------------

describe('FR-600, FR-601, FR-1016: runGlobalScan', () => {
  it('scans OpenAPI source and returns matches', () => {
    const sources: SourceConfig[] = [{
      type: 'openapi',
      paths: ['test/core/dsl/fixtures/valid.openapi.yaml'],
      relation: 'implements',
    }];
    const { matches, diagnostics } = runGlobalScan(sources, ['listUsers', 'getUser', 'nonExistent']);
    expect(matches.has('listUsers')).toBe(true);
    expect(matches.has('getUser')).toBe(true);
    expect(matches.has('nonExistent')).toBe(false);
    expect(diagnostics.filter(d => d.message.includes('Failed'))).toHaveLength(0);
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
    const { diagnostics } = runGlobalScan(sources, ['any-id']);
    const noScanner = diagnostics.filter(d => d.message.includes('No scanner found'));
    expect(noScanner).toHaveLength(1);
    expect(noScanner[0].severity).toBe('warning');
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
// Scan diagnostics: missing file, unparseable file, parse fallback
// ---------------------------------------------------------------------------

describe('FR-1007, FR-1008, FR-1014, FR-1015: scan diagnostics', () => {
  function scan(type: string, path: string, specIds: string[] = ['anything']) {
    const sources: SourceConfig[] = [{ type, paths: [path], relation: 'implements' }];
    return runGlobalScan(sources, specIds);
  }

  it('reports an error naming the missing OpenAPI file path', () => {
    const missing = 'test/core/dsl/fixtures/no-such-file.openapi.yaml';
    const { diagnostics } = scan('openapi', missing);
    const errors = diagnostics.filter(d => d.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain(missing);
    expect(errors[0].sourceType).toBe('openapi');
  });

  it('reports an error naming the missing DDL file path', () => {
    const missing = 'test/core/dsl/fixtures/no-such-file.schema.sql';
    const { diagnostics } = scan('ddl', missing);
    const errors = diagnostics.filter(d => d.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain(missing);
    expect(errors[0].sourceType).toBe('ddl');
  });

  it('reports an error for an unparseable OpenAPI file', () => {
    // The fixture is malformed YAML, so no document can be produced from it.
    expect(() => parseYaml(readFileSync(fixturePath('invalid.openapi.yaml'), 'utf-8'))).toThrow();

    const { diagnostics, matches } = scan('openapi', 'test/core/dsl/fixtures/invalid.openapi.yaml', ['listUsers']);
    const errors = diagnostics.filter(d => d.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('invalid.openapi.yaml');
    // The unusable file must not be silently treated as a source with no matches.
    expect(matches.size).toBe(0);
  });

  it('reports an error for an empty OpenAPI file', () => {
    expect(readFileSync(fixturePath('empty.openapi.yaml'), 'utf-8')).toBe('');

    const { diagnostics } = scan('openapi', 'test/core/dsl/fixtures/empty.openapi.yaml', ['listUsers']);
    const errors = diagnostics.filter(d => d.severity === 'error');
    expect(errors).toHaveLength(1);
    // Assert the reason, not the path: the fixture name also contains "empty".
    expect(errors[0].message).toContain('holds no OpenAPI document');
    expect(errors[0].filePath).toBe('test/core/dsl/fixtures/empty.openapi.yaml');
  });

  it('emits a warning when DDL parsing falls back to regex', () => {
    const { diagnostics, matches } = scan(
      'ddl', 'test/core/dsl/fixtures/parser-fail-regex-ok.schema.sql', ['audit_log'],
    );
    // The fallback still finds the table — the warning reports the degradation.
    expect(matches.has('audit_log')).toBe(true);
    const fallback = diagnostics.filter(d => d.message.includes('fell back to regex'));
    expect(fallback).toHaveLength(1);
    expect(fallback[0].severity).toBe('warning');
    expect(fallback[0].filePath).toBe('test/core/dsl/fixtures/parser-fail-regex-ok.schema.sql');
  });

  it('emits no fallback warning when the DDL parser succeeds', () => {
    const { diagnostics, matches } = scan('ddl', 'test/core/dsl/fixtures/valid.schema.sql', ['users']);
    expect(matches.has('users')).toBe(true);
    expect(diagnostics.filter(d => d.message.includes('fell back to regex'))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// runDeepValidation — OpenAPI
// ---------------------------------------------------------------------------

describe('FR-1004, FR-1005, FR-1006: runDeepValidation (OpenAPI)', () => {
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

  it('compares response property types by containment, not equality', () => {
    const matches = getOpenAPIMatchesForSpec('listOrders');
    // Order.total is declared as "number"; "integer" is contained by it.
    const contained = runDeepValidation('listOrders', matches, {
      openapi: {
        mapper: () => ({
          path: '/orders',
          responseProperties: [{ name: 'total', type: 'integer' }],
        }),
      },
    }, { id: 'listOrders', name: 'List Orders' });
    expect(contained.warnings).toHaveLength(0);

    const unrelated = runDeepValidation('listOrders', matches, {
      openapi: {
        mapper: () => ({
          path: '/orders',
          responseProperties: [{ name: 'total', type: 'string' }],
        }),
      },
    }, { id: 'listOrders', name: 'List Orders' });
    expect(unrelated.warnings.some(w => w.message.includes('type mismatch'))).toBe(true);
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

  it('leaves the method check off unless the mapper opts in', () => {
    // The fixture serves /users with GET, so DELETE is a genuine mismatch.
    const matches = getOpenAPIMatchesForSpec('listUsers');
    const spec = { id: 'listUsers', name: 'List' };

    const optedOut = runDeepValidation('listUsers', matches, {
      openapi: { mapper: () => ({ path: '/users' }) },
    }, spec);
    expect(optedOut.warnings.filter(w => w.message.includes('Method mismatch'))).toHaveLength(0);

    const optedIn = runDeepValidation('listUsers', matches, {
      openapi: { mapper: () => ({ path: '/users', method: 'DELETE' }) },
    }, spec);
    expect(optedIn.warnings.filter(w => w.message.includes('Method mismatch'))).toHaveLength(1);
  });

  it('leaves the parameter check off unless the mapper opts in', () => {
    // The fixture declares only the "id" path parameter, so "limit" is missing.
    const matches = getOpenAPIMatchesForSpec('getUser');
    const spec = { id: 'getUser', name: 'Get User' };

    const optedOut = runDeepValidation('getUser', matches, {
      openapi: { mapper: () => ({ path: '/users/{id}' }) },
    }, spec);
    expect(optedOut.warnings).toHaveLength(0);

    const optedIn = runDeepValidation('getUser', matches, {
      openapi: {
        mapper: () => ({ path: '/users/{id}', parameters: [{ name: 'limit', in: 'query' }] }),
      },
    }, spec);
    expect(optedIn.warnings.filter(w => w.field === 'limit')).toHaveLength(1);
  });

  it('leaves the response property check off unless the mapper opts in', () => {
    // The fixture's User schema has no "nonexistent" property.
    const matches = getOpenAPIMatchesForSpec('listUsers');
    const spec = { id: 'listUsers', name: 'List Users' };

    const optedOut = runDeepValidation('listUsers', matches, {
      openapi: { mapper: () => ({ path: '/users' }) },
    }, spec);
    expect(optedOut.warnings).toHaveLength(0);

    const optedIn = runDeepValidation('listUsers', matches, {
      openapi: {
        mapper: () => ({ path: '/users', responseProperties: [{ name: 'nonexistent' }] }),
      },
    }, spec);
    expect(optedIn.warnings.filter(w => w.field === 'nonexistent')).toHaveLength(1);
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

describe('FR-1011, FR-1012, FR-1013: runDeepValidation (DDL)', () => {
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

  it('skips the column check when the table is missing', () => {
    // Same mapper, same declared columns; only the DDL differs.
    const mapper = () => ({
      tableName: 'orders',
      columns: [{ name: 'no_such_column' }],
    });
    const spec = { id: 'orders', name: 'Orders' };

    // missing-table.schema.sql declares users and products, but no orders table.
    const withoutTable = getDDLMatchesForSpec('orders', 'missing-table.schema.sql');
    expect(withoutTable).toHaveLength(0);
    const skipped = runDeepValidation('orders', withoutTable, { ddl: { mapper } }, spec);
    expect(skipped.warnings).toHaveLength(0);

    // With the table present the very same mapper does produce a column warning,
    // so the silence above comes from the missing table, not from an inert mapper.
    const withTable = getDDLMatchesForSpec('orders');
    expect(withTable).toHaveLength(1);
    const checked = runDeepValidation('orders', withTable, { ddl: { mapper } }, spec);
    expect(checked.warnings.filter(w => w.field === 'no_such_column')).toHaveLength(1);
  });

  it('leaves the type check off unless checkTypes opts in', () => {
    const matches = getDDLMatchesForSpec('users', 'type-mismatch.schema.sql');
    const result = runDeepValidation('users', matches, {
      ddl: {
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'id', type: 'INT' }],
        }),
      },
    }, { id: 'users', name: 'Users' });
    expect(result.warnings.filter(w => w.message.includes('type mismatch'))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// relationCoverage (unchanged — existing tests)
// ---------------------------------------------------------------------------

describe('FR-107, FR-604: relationCoverage', () => {
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
