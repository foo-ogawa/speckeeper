import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { testChecker, externalOpenAPIChecker, externalSqlSchemaChecker, relationCoverage } from '../../../src/core/dsl/checkers.js';

interface SimpleSpec {
  id: string;
  name: string;
  relations?: Array<{ type: string; target: string }>;
}

const FIXTURES_DIR = join(__dirname, 'fixtures');

function fixturePath(filename: string): string {
  return join(FIXTURES_DIR, filename);
}

// ---------------------------------------------------------------------------
// testChecker (unchanged — existing tests)
// ---------------------------------------------------------------------------

describe('testChecker', () => {
  const checker = testChecker<SimpleSpec>();

  it('returns ExternalChecker with targetType "test"', () => {
    expect(checker.targetType).toBe('test');
  });

  it('check returns success with warnings when no test files match', () => {
    const result = checker.check({ id: 'FR-NOT-IN-ANY-TEST-FILE', name: 'Test' }, undefined);
    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toContain('FR-NOT-IN-ANY-TEST-FILE');
  });
});

// ---------------------------------------------------------------------------
// sourcePath fallback resolution (T010)
// ---------------------------------------------------------------------------

describe('sourcePath fallback resolution', () => {
  it('OpenAPI: uses config sourcePath when provided', () => {
    const checker = externalOpenAPIChecker<SimpleSpec>({
      sourcePath: () => 'custom/openapi.yaml',
      mapper: (s) => ({ path: `/${s.id}` }),
    });
    expect(checker.sourcePath({ id: 'FR-001', name: 'X' })).toBe('custom/openapi.yaml');
  });

  it('OpenAPI: falls back to default api/openapi.yaml when no config', () => {
    const checker = externalOpenAPIChecker<SimpleSpec>();
    expect(checker.sourcePath({ id: 'FR-001', name: 'X' })).toBe('api/openapi.yaml');
  });

  it('SQL: uses config sourcePath when provided', () => {
    const checker = externalSqlSchemaChecker<SimpleSpec>({
      sourcePath: () => 'custom/schema.sql',
      mapper: (s) => ({ tableName: s.id }),
    });
    expect(checker.sourcePath({ id: 'FR-001', name: 'X' })).toBe('custom/schema.sql');
  });

  it('SQL: falls back to default db/schema.sql when no config', () => {
    const checker = externalSqlSchemaChecker<SimpleSpec>();
    expect(checker.sourcePath({ id: 'FR-001', name: 'X' })).toBe('db/schema.sql');
  });
});

// ---------------------------------------------------------------------------
// externalOpenAPIChecker (US1)
// ---------------------------------------------------------------------------

describe('externalOpenAPIChecker', () => {
  it('returns ExternalChecker with targetType "openapi"', () => {
    const checker = externalOpenAPIChecker<SimpleSpec>();
    expect(checker.targetType).toBe('openapi');
  });

  it('has proper defaults when no config (OpenAPI)', () => {
    const checker = externalOpenAPIChecker<SimpleSpec>();
    expect(checker.targetType).toBe('openapi');
    expect(checker.sourcePath({ id: 'X', name: 'X' })).toBe('api/openapi.yaml');
  });

  it('returns success without structural warnings when no mapper is provided', () => {
    const checker = externalOpenAPIChecker<SimpleSpec>({
      sourcePath: () => fixturePath('valid.openapi.yaml'),
    } as Parameters<typeof externalOpenAPIChecker<SimpleSpec>>[0]);
    const result = checker.check({ id: 'listUsers', name: 'List Users' }, undefined);
    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  describe('file existence check', () => {
    it('reports error when file does not exist', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => 'nonexistent/openapi.yaml',
        mapper: (s) => ({ path: `/${s.id}` }),
      });
      const result = checker.check({ id: 'FR-001', name: 'Test' }, undefined);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('not found');
    });

    it('reports error when file is empty', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('empty.openapi.yaml'),
        mapper: (s) => ({ path: `/${s.id}` }),
      });
      const result = checker.check({ id: 'FR-001', name: 'Test' }, undefined);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('empty');
    });

    it('resolves relative path from process.cwd()', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => 'test/core/dsl/fixtures/valid.openapi.yaml',
        mapper: () => ({ path: '/users' }),
      });
      const result = checker.check({ id: 'listUsers', name: 'List Users' }, undefined);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('parse check', () => {
    it('reports error when YAML is malformed', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('invalid.openapi.yaml'),
        mapper: (s) => ({ path: `/${s.id}` }),
      });
      const result = checker.check({ id: 'FR-001', name: 'Test' }, undefined);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('parse');
    });
  });

  describe('spec ID existence check', () => {
    it('finds spec ID via operationId', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({ path: '/users' }),
      });
      const result = checker.check({ id: 'listUsers', name: 'List Users' }, undefined);
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('finds spec ID via x-spec-id extension', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({ path: '/users' }),
      });
      const result = checker.check({ id: 'FR-001', name: 'FR' }, undefined);
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('finds spec ID via path segment', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({ path: '/users' }),
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('finds spec ID via schema name', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({ path: '/users' }),
      });
      const result = checker.check({ id: 'User', name: 'User Schema' }, undefined);
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('warns when spec ID is missing from document', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({ path: '/nonexistent' }),
      });
      const result = checker.check({ id: 'nonExistentOperation', name: 'X' }, undefined);
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('nonExistentOperation');
      expect(result.warnings[0].message).toContain('not found');
    });

    it('does NOT match spec ID that appears only in YAML comment', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('comment-only-id.openapi.yaml'),
        mapper: () => ({ path: '/health' }),
      });
      const result = checker.check({ id: 'FR-001', name: 'X' }, undefined);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('not found');
    });
  });

  describe('JSON format', () => {
    it('parses JSON format OpenAPI file', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.json'),
        mapper: () => ({ path: '/users' }),
      });
      const result = checker.check({ id: 'listUsers', name: 'List Users' }, undefined);
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('method check', () => {
    it('does not warn when method matches', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({ path: '/users', method: 'GET' }),
      });
      const result = checker.check({ id: 'listUsers', name: 'List' }, undefined);
      expect(result.warnings).toHaveLength(0);
    });

    it('warns on method mismatch', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({ path: '/users', method: 'DELETE' }),
      });
      const result = checker.check({ id: 'listUsers', name: 'List' }, undefined);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('Method mismatch');
    });
  });

  describe('parameter check', () => {
    it('warns on parameter type mismatch', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({
          path: '/users/{id}',
          parameters: [{ name: 'id', in: 'path', type: 'number' }],
        }),
      });
      const result = checker.check({ id: 'getUser', name: 'Get User' }, undefined);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('type mismatch');
    });

    it('finds expected parameter', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({
          path: '/users/{id}',
          parameters: [{ name: 'id', in: 'path', type: 'string' }],
        }),
      });
      const result = checker.check({ id: 'getUser', name: 'Get User' }, undefined);
      expect(result.warnings).toHaveLength(0);
    });

    it('warns when parameter is missing', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({
          path: '/users/{id}',
          parameters: [{ name: 'limit', in: 'query' }],
        }),
      });
      const result = checker.check({ id: 'getUser', name: 'Get User' }, undefined);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('limit');
      expect(result.warnings[0].message).toContain('not found');
    });
  });

  describe('response property check', () => {
    it('finds expected response properties', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({
          path: '/users',
          responseProperties: [
            { name: 'id', type: 'integer' },
            { name: 'name', type: 'string' },
          ],
        }),
      });
      const result = checker.check({ id: 'listUsers', name: 'List Users' }, undefined);
      expect(result.warnings).toHaveLength(0);
    });

    it('warns when response property is missing', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({
          path: '/users',
          responseProperties: [{ name: 'nonexistent' }],
        }),
      });
      const result = checker.check({ id: 'listUsers', name: 'List Users' }, undefined);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('nonexistent');
    });

    it('warns on response property type mismatch', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({
          path: '/users',
          responseProperties: [{ name: 'id', type: 'number' }],
        }),
      });
      const result = checker.check({ id: 'listUsers', name: 'List Users' }, undefined);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('type mismatch');
    });

    it('finds response properties from 201 status code', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.openapi.yaml'),
        mapper: () => ({
          path: '/users',
          responseProperties: [
            { name: 'id', type: 'integer' },
            { name: 'email', type: 'string' },
          ],
        }),
      });
      const result = checker.check({ id: 'createUser', name: 'Create User' }, undefined);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('$ref resolution', () => {
    it('resolves $ref for parameters', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('ref-resolution.openapi.yaml'),
        mapper: () => ({
          path: '/items/{id}',
          parameters: [{ name: 'id', in: 'path', type: 'string' }],
        }),
      });
      const result = checker.check({ id: 'getItem', name: 'Get Item' }, undefined);
      expect(result.warnings).toHaveLength(0);
    });

    it('resolves $ref for response schema', () => {
      const checker = externalOpenAPIChecker<SimpleSpec>({
        sourcePath: () => fixturePath('ref-resolution.openapi.yaml'),
        mapper: () => ({
          path: '/items/{id}',
          responseProperties: [
            { name: 'id', type: 'integer' },
            { name: 'name', type: 'string' },
            { name: 'price', type: 'number' },
          ],
        }),
      });
      const result = checker.check({ id: 'getItem', name: 'Get Item' }, undefined);
      expect(result.warnings).toHaveLength(0);
    });
  });

});


// ---------------------------------------------------------------------------
// externalSqlSchemaChecker (US2)
// ---------------------------------------------------------------------------

describe('externalSqlSchemaChecker', () => {
  it('returns ExternalChecker with targetType "ddl"', () => {
    const checker = externalSqlSchemaChecker<SimpleSpec>();
    expect(checker.targetType).toBe('ddl');
  });

  it('returns success without structural warnings when no mapper is provided', () => {
    const checker = externalSqlSchemaChecker<SimpleSpec>({
      sourcePath: () => fixturePath('valid.schema.sql'),
    } as Parameters<typeof externalSqlSchemaChecker<SimpleSpec>>[0]);
    const result = checker.check({ id: 'users', name: 'Users' }, undefined);
    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  describe('file existence check', () => {
    it('reports error when file does not exist', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => 'nonexistent/schema.sql',
        mapper: (s) => ({ tableName: s.id }),
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('not found');
    });

    it('reports error when file is empty', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('empty.schema.sql'),
        mapper: (s) => ({ tableName: s.id }),
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('empty');
    });

    it('resolves relative path from process.cwd()', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => 'test/core/dsl/fixtures/valid.schema.sql',
        mapper: () => ({ tableName: 'users' }),
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('table existence check', () => {
    it('matches table name case-insensitively', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.schema.sql'),
        mapper: () => ({ tableName: 'USERS' }),
      });
      const result = checker.check({ id: 'USERS', name: 'Users' }, undefined);
      expect(result.warnings.filter(w => w.message.includes('not found'))).toHaveLength(0);
    });

    it('finds existing table', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.schema.sql'),
        mapper: () => ({ tableName: 'users' }),
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('warns when table is missing', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('missing-table.schema.sql'),
        mapper: () => ({ tableName: 'orders' }),
      });
      const result = checker.check({ id: 'orders', name: 'Orders' }, undefined);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.includes('orders') && w.message.includes('not found'))).toBe(true);
    });

    it('does NOT match table name in SQL comment', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('comment-only-id.schema.sql'),
        mapper: () => ({ tableName: 'users' }),
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.includes('not found'))).toBe(true);
    });
  });

  describe('column existence check', () => {
    it('finds existing columns', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.schema.sql'),
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'id' }, { name: 'name' }, { name: 'email' }],
        }),
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('matches column name case-insensitively', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.schema.sql'),
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'ID' }, { name: 'EMAIL' }],
        }),
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      expect(result.warnings.filter(w => w.message.includes('not found'))).toHaveLength(0);
    });

    it('warns when column is missing', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('missing-column.schema.sql'),
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'id' }, { name: 'email' }],
        }),
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.includes('email') && w.message.includes('not found'))).toBe(true);
    });

    it('skips column check when table is missing (table warning takes precedence)', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('missing-table.schema.sql'),
        mapper: () => ({
          tableName: 'orders',
          columns: [{ name: 'id' }, { name: 'total' }],
        }),
      });
      const result = checker.check({ id: 'orders', name: 'Orders' }, undefined);
      const tableWarning = result.warnings.find(w => w.message.includes('orders') && w.message.includes('not found'));
      expect(tableWarning).toBeDefined();
      const columnWarnings = result.warnings.filter(w => w.message.includes('Column'));
      expect(columnWarnings).toHaveLength(0);
    });

    it('table-only spec skips column check', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('table-only.schema.sql'),
        mapper: () => ({ tableName: 'categories' }),
      });
      const result = checker.check({ id: 'categories', name: 'Categories' }, undefined);
      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('type containment check', () => {
    it('accepts wider type (SMALLINT → INT is OK)', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('valid.schema.sql'),
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'id', type: 'SMALLINT' }],
        }),
        checkTypes: true,
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      const typeWarnings = result.warnings.filter(w => w.message.includes('type mismatch'));
      expect(typeWarnings).toHaveLength(0);
    });

    it('warns on narrower type (INT → SMALLINT is NG)', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('type-mismatch.schema.sql'),
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'id', type: 'INT' }],
        }),
        checkTypes: true,
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      expect(result.warnings.some(w => w.message.includes('type mismatch'))).toBe(true);
    });

    it('does not warn on type mismatch when checkTypes is not enabled', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('type-mismatch.schema.sql'),
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'id', type: 'INT' }],
        }),
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      const typeWarnings = result.warnings.filter(w => w.message.includes('type mismatch'));
      expect(typeWarnings).toHaveLength(0);
    });

    it('warns on VARCHAR length narrowing (VARCHAR(255) → VARCHAR(50) is NG)', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('type-mismatch.schema.sql'),
        mapper: () => ({
          tableName: 'users',
          columns: [{ name: 'name', type: 'VARCHAR(255)' }],
        }),
        checkTypes: true,
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      expect(result.warnings.some(w => w.message.includes('type mismatch') && w.message.includes('name'))).toBe(true);
    });
  });

  describe('DDL parse fallback', () => {
    it('uses regex fallback when parser fails and still extracts tables', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('parser-fail-regex-ok.schema.sql'),
        mapper: () => ({ tableName: 'audit_log' }),
      });
      const result = checker.check({ id: 'audit_log', name: 'Audit Log' }, undefined);
      expect(result.warnings.some(w => w.message.includes('fallback'))).toBe(true);
      expect(result.warnings.some(w => w.message.includes('audit_log') && w.message.includes('not found'))).toBe(false);
    });

    it('reports table not found when both parser and regex fail', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('invalid.schema.sql'),
        mapper: () => ({ tableName: 'users' }),
      });
      const result = checker.check({ id: 'users', name: 'Users' }, undefined);
      expect(result.warnings.some(w => w.message.includes('users') && w.message.includes('not found'))).toBe(true);
    });
  });

  describe('PostgreSQL dialect', () => {
    it('parses PostgreSQL dialect DDL and finds table and columns', () => {
      const checker = externalSqlSchemaChecker<SimpleSpec>({
        sourcePath: () => fixturePath('postgres-dialect.schema.sql'),
        mapper: () => ({
          tableName: 'accounts',
          columns: [{ name: 'id' }, { name: 'username' }, { name: 'balance' }],
        }),
      });
      const result = checker.check({ id: 'accounts', name: 'Accounts' }, undefined);
      expect(result.success).toBe(true);
      const missingColWarnings = result.warnings.filter(w =>
        w.message.includes('not found') && w.message.includes('Column'),
      );
      expect(missingColWarnings).toHaveLength(0);
    });
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
