/**
 * FR-201-01: external SSOT file paths are defined in speckeeper.config.ts via
 * ExternalSsotPaths.
 *
 * Uses real source files on disk, so the paths declared in the config are the
 * ones the scan actually resolves.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkCommand } from '../../src/cli/check.js';
import type { ExternalSsotPaths, SourceConfig } from '../../src/core/config-api.js';

vi.mock('../../src/utils/config-loader.js');

const { loadConfig } = await import('../../src/utils/config-loader.js');
const mockedLoadConfig = vi.mocked(loadConfig);

const SPEC_ID = 'API-001';

const OPENAPI_DOC = `openapi: 3.0.0
info:
  title: Orders
  version: 1.0.0
paths:
  /orders:
    get:
      operationId: ${SPEC_ID}
      responses:
        '200':
          description: ok
`;

describe('FR-201-01: external SSOT paths come from the config', () => {
  let tempDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  /** Declare the config with the paths typed as the named config surface */
  function configWithPaths(paths: ExternalSsotPaths) {
    const source: SourceConfig = { type: 'openapi', paths, relation: 'implements' };
    return {
      designDir: 'design',
      docsDir: 'docs',
      specsDir: 'specs',
      models: [{ id: 'api-ref', name: 'APIRef', register: vi.fn() }],
      specs: [{ model: { id: 'api-ref', register: vi.fn() }, data: [{ id: SPEC_ID }] }],
      sources: [source],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = mkdtempSync(join(tmpdir(), 'speckeeper-ssot-paths-'));
    mkdirSync(join(tempDir, 'contracts'));
    writeFileSync(join(tempDir, 'contracts', 'orders.yaml'), OPENAPI_DOC);

    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  function output(): string {
    return logSpy.mock.calls.map(c => String(c[0])).join('\n');
  }

  it('FR-201-01 resolves the external SSOT from the paths declared in the config', async () => {
    mockedLoadConfig.mockResolvedValue(configWithPaths(['contracts/*.yaml']) as never);

    await checkCommand('openapi', { verbose: true });

    expect(output()).not.toContain(`Spec ID "${SPEC_ID}" not found in any configured source`);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('FR-201-01 finds nothing when the config points at a path the SSOT is not on', async () => {
    mockedLoadConfig.mockResolvedValue(configWithPaths(['api/*.yaml']) as never);

    await checkCommand('openapi', { verbose: true });

    expect(output()).toContain(`Spec ID "${SPEC_ID}" not found in any configured source`);
  });

  it('FR-201-01 finds nothing when the config declares no external SSOT path', async () => {
    mockedLoadConfig.mockResolvedValue(configWithPaths([]) as never);

    await checkCommand('openapi', { verbose: true });

    expect(output()).toContain(`Spec ID "${SPEC_ID}" not found in any configured source`);
  });

  it('FR-201-01 accepts several paths for one external SSOT type', async () => {
    writeFileSync(join(tempDir, 'contracts', 'shipping.json'), '{"openapi":"3.0.0","paths":{}}');
    mockedLoadConfig.mockResolvedValue(
      configWithPaths(['contracts/*.yaml', 'contracts/*.json']) as never,
    );

    await checkCommand('openapi', { verbose: true });

    expect(output()).not.toContain(`Spec ID "${SPEC_ID}" not found in any configured source`);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
