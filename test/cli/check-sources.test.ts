/**
 * `speckeeper check` against configured sources.
 *
 * Uses real source files on disk, so the global scan actually runs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkCommand } from '../../src/cli/check.js';

vi.mock('../../src/utils/config-loader.js');

const { loadConfig } = await import('../../src/utils/config-loader.js');
const mockedLoadConfig = vi.mocked(loadConfig);

/** Spec ID carried by the OpenAPI document only */
const OPENAPI_SPEC_ID = 'API-001';
/** Spec ID carried by the DDL only (the table name) */
const DDL_SPEC_ID = 'audit_log';

const OPENAPI_DOC = `openapi: 3.0.0
info:
  title: Orders
  version: 1.0.0
paths:
  /orders:
    get:
      operationId: ${OPENAPI_SPEC_ID}
      responses:
        '200':
          description: ok
`;

const DDL = `CREATE TABLE ${DDL_SPEC_ID} (
  id INT PRIMARY KEY,
  total INT
);
`;

function createMockModel() {
  return {
    id: 'test-model',
    name: 'TestModel',
    register: vi.fn(),
  };
}

describe('FR-602-02: check filters the scanned sources by type', () => {
  let tempDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = mkdtempSync(join(tmpdir(), 'speckeeper-check-'));
    mkdirSync(join(tempDir, 'api'));
    mkdirSync(join(tempDir, 'db'));
    writeFileSync(join(tempDir, 'api', 'orders.yaml'), OPENAPI_DOC);
    writeFileSync(join(tempDir, 'db', 'schema.sql'), DDL);

    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;

    const model = createMockModel();
    mockedLoadConfig.mockResolvedValue({
      designDir: 'design',
      docsDir: 'docs',
      specsDir: 'specs',
      models: [model],
      specs: [
        {
          model: { id: model.id, register: model.register },
          data: [{ id: OPENAPI_SPEC_ID }, { id: DDL_SPEC_ID }],
        },
      ],
      sources: [
        { type: 'openapi', paths: ['api/*.yaml'], relation: 'implements' },
        { type: 'ddl', paths: ['db/*.sql'], relation: 'implements' },
      ],
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    rmSync(tempDir, { recursive: true, force: true });
  });

  function output(): string {
    return logSpy.mock.calls.map(c => String(c[0])).join('\n');
  }

  it('FR-602-02 scans only the OpenAPI source when the type is openapi', async () => {
    await checkCommand('openapi', { verbose: true });

    expect(output()).toContain(`Spec ID "${DDL_SPEC_ID}" not found in any configured source`);
    expect(output()).not.toContain(`Spec ID "${OPENAPI_SPEC_ID}" not found`);
    expect(process.exitCode).toBeUndefined();
  });

  it('FR-602-02 scans only the DDL source when the type is ddl', async () => {
    await checkCommand('ddl', { verbose: true });

    expect(output()).toContain(`Spec ID "${OPENAPI_SPEC_ID}" not found in any configured source`);
    expect(output()).not.toContain(`Spec ID "${DDL_SPEC_ID}" not found`);
    expect(process.exitCode).toBeUndefined();
  });

  it('FR-602-01 scans every source when the type is all', async () => {
    await checkCommand('all', { verbose: true });

    expect(output()).not.toContain('not found in any configured source');
    expect(process.exitCode).toBeUndefined();
  });
});

describe('FR-1003, FR-1010, FR-1013: check warns about spec IDs absent from a source', () => {
  let tempDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  /** Spec IDs the artifacts do carry, alongside one they do not */
  const ABSENT_OPERATION = 'API-999';
  const ABSENT_TABLE = 'orders';

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = mkdtempSync(join(tmpdir(), 'speckeeper-absent-'));
    mkdirSync(join(tempDir, 'api'));
    mkdirSync(join(tempDir, 'db'));
    writeFileSync(join(tempDir, 'api', 'orders.yaml'), OPENAPI_DOC);
    writeFileSync(join(tempDir, 'db', 'schema.sql'), DDL);

    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    rmSync(tempDir, { recursive: true, force: true });
  });

  function output(): string {
    return logSpy.mock.calls.map(c => String(c[0])).join('\n');
  }

  /** Configure a single source and the spec IDs to look for in it. */
  function useConfig(source: { type: string; paths: string[] }, specIds: string[]): void {
    const model = createMockModel();
    mockedLoadConfig.mockResolvedValue({
      designDir: 'design',
      docsDir: 'docs',
      specsDir: 'specs',
      models: [model],
      specs: [{
        model: { id: model.id, register: model.register },
        data: specIds.map(id => ({ id })),
      }],
      sources: [{ ...source, relation: 'implements' }],
    } as never);
  }

  it('FR-1003-01 warns about an operation absent from the OpenAPI document without --verbose', async () => {
    useConfig({ type: 'openapi', paths: ['api/*.yaml'] }, [OPENAPI_SPEC_ID, ABSENT_OPERATION]);

    await checkCommand('openapi', {});

    expect(output()).toContain(`Spec ID "${ABSENT_OPERATION}" not found in any configured source`);
    // The operation the document does declare must not be reported.
    expect(output()).not.toContain(`Spec ID "${OPENAPI_SPEC_ID}" not found`);
  });

  it('FR-1010-01, FR-1013-01 warns about a table absent from the DDL without --verbose', async () => {
    useConfig({ type: 'ddl', paths: ['db/*.sql'] }, [DDL_SPEC_ID, ABSENT_TABLE]);

    await checkCommand('ddl', {});

    expect(output()).toContain(`Spec ID "${ABSENT_TABLE}" not found in any configured source`);
    // The table the DDL does declare must not be reported.
    expect(output()).not.toContain(`Spec ID "${DDL_SPEC_ID}" not found`);
  });

  it('FR-1010-01 keeps a missing table a warning, not a failing exit', async () => {
    useConfig({ type: 'ddl', paths: ['db/*.sql'] }, [ABSENT_TABLE]);

    await checkCommand('ddl', {});

    expect(output()).toContain(`Spec ID "${ABSENT_TABLE}" not found in any configured source`);
    expect(process.exitCode).toBeUndefined();
  });
});

describe('FR-604: check --coverage fails when it measures nothing or too little', () => {
  let tempDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = mkdtempSync(join(tmpdir(), 'speckeeper-coverage-'));
    mkdirSync(join(tempDir, 'api'));
    writeFileSync(join(tempDir, 'api', 'orders.yaml'), OPENAPI_DOC);

    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    rmSync(tempDir, { recursive: true, force: true });
  });

  function output(): string {
    return logSpy.mock.calls.map(c => String(c[0])).join('\n');
  }

  /** One OpenAPI source; API-001 is in the document, the other IDs are not. */
  function useConfig(specIds: string[], threshold?: number): void {
    // No per-model coverage checker: the transitive coverage alone decides.
    const model = { ...createMockModel(), getCoverageChecker: vi.fn().mockReturnValue(undefined) };
    mockedLoadConfig.mockResolvedValue({
      designDir: 'design',
      docsDir: 'docs',
      specsDir: 'specs',
      models: [model],
      specs: [{ model: { id: model.id, register: model.register }, data: specIds.map(id => ({ id })) }],
      sources: [{ type: 'openapi', paths: ['api/*.yaml'], relation: 'implements' }],
      coverage: { transitiveRelations: ['satisfies'], ...(threshold === undefined ? {} : { threshold }) },
    } as never);
  }

  it('fails when no configured source has the requested type', async () => {
    useConfig([OPENAPI_SPEC_ID]);

    await checkCommand('test', { coverage: true });

    expect(output()).toContain('No source of type "test" is configured');
    expect(process.exitCode).toBe(1);
  });

  it('fails when transitive coverage is below the default 80% threshold', async () => {
    useConfig([OPENAPI_SPEC_ID, 'API-002', 'API-003']);

    await checkCommand('openapi', { coverage: true });

    expect(output()).toContain('Transitive coverage 33% is below the 80% threshold (1/3)');
    expect(output()).not.toContain('All coverage checks passed');
    expect(process.exitCode).toBe(1);
  });

  it('passes when transitive coverage meets the configured threshold', async () => {
    useConfig([OPENAPI_SPEC_ID, 'API-002', 'API-003'], 33);

    await checkCommand('openapi', { coverage: true });

    expect(output()).toContain('All coverage checks passed (≥33%)');
    expect(process.exitCode).toBeUndefined();
  });
});
