/**
 * FR-602-02: `speckeeper check [type]` scans only the sources of that type
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
  let exitSpy: ReturnType<typeof vi.spyOn>;

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
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

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
    rmSync(tempDir, { recursive: true, force: true });
  });

  function output(): string {
    return logSpy.mock.calls.map(c => String(c[0])).join('\n');
  }

  it('FR-602-02 scans only the OpenAPI source when the type is openapi', async () => {
    await checkCommand('openapi', { verbose: true });

    expect(output()).toContain(`Spec ID "${DDL_SPEC_ID}" not found in any configured source`);
    expect(output()).not.toContain(`Spec ID "${OPENAPI_SPEC_ID}" not found`);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('FR-602-02 scans only the DDL source when the type is ddl', async () => {
    await checkCommand('ddl', { verbose: true });

    expect(output()).toContain(`Spec ID "${OPENAPI_SPEC_ID}" not found in any configured source`);
    expect(output()).not.toContain(`Spec ID "${DDL_SPEC_ID}" not found`);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('FR-602-01 scans every source when the type is all', async () => {
    await checkCommand('all', { verbose: true });

    expect(output()).not.toContain('not found in any configured source');
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
