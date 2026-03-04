import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkCommand } from '../../src/cli/check.js';

vi.mock('../../src/utils/config-loader.js');
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

const { loadConfig } = await import('../../src/utils/config-loader.js');
const { existsSync, readFileSync } = await import('node:fs');
const mockedLoadConfig = vi.mocked(loadConfig);
const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);

function createMockModel(overrides: {
  id?: string;
  name?: string;
  externalSourcePath?: string | null;
  checkResult?: { success: boolean; errors: Array<{ message: string; specId?: string; field?: string }>; warnings: Array<{ message: string; specId?: string; field?: string }> };
  hasCoverageChecker?: boolean;
  coverageResult?: { total: number; covered: number; uncovered: number; coveragePercent: number; coveredItems: unknown[]; uncoveredItems: unknown[] };
} = {}) {
  const id = overrides.id ?? 'test-model';
  return {
    id,
    name: overrides.name ?? 'TestModel',
    getExternalSourcePath: vi.fn().mockReturnValue(overrides.externalSourcePath ?? null),
    check: vi.fn().mockReturnValue(overrides.checkResult ?? { success: true, errors: [], warnings: [] }),
    lintAll: vi.fn().mockReturnValue([]),
    getExporters: vi.fn().mockReturnValue([]),
    register: vi.fn(),
    getCoverageChecker: vi.fn().mockReturnValue(
      overrides.hasCoverageChecker
        ? { description: 'Test coverage', targetModel: 'requirement' }
        : null
    ),
    checkCoverage: vi.fn().mockReturnValue(overrides.coverageResult ?? null),
  };
}

function createMockConfig(models: ReturnType<typeof createMockModel>[]) {
  return {
    designDir: 'design',
    docsDir: 'docs',
    specsDir: 'specs',
    models,
    specs: models.map(m => ({
      model: { id: m.id, register: m.register },
      data: [{ id: 'SPEC-001' }],
    })),
  };
}

describe('checkCommand', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('FR-602-01 check runs for all models with external SSOT', () => {
    it('FR-602-01 check runs external SSOT consistency check for all models', async () => {
      const model = createMockModel({
        externalSourcePath: 'test/fixtures/data.yaml',
        checkResult: { success: true, errors: [], warnings: [] },
      });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('key: value' as never);

      await checkCommand('all', {});

      expect(model.getExternalSourcePath).toHaveBeenCalled();
      expect(model.check).toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('FR-602-04 only models with externalChecker are targeted', () => {
    it('FR-602-04 skips models without external source path', async () => {
      const model = createMockModel({ externalSourcePath: null });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);

      await checkCommand('all', {});

      expect(model.check).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('FR-603-03 orchestration: check errors and warnings are output and trigger exit', () => {
    it('FR-603-03 exits with code 1 and outputs error/warning messages from check results', async () => {
      const model = createMockModel({
        externalSourcePath: 'test/fixtures/data.json',
        checkResult: {
          success: false,
          errors: [{ message: 'Missing field', specId: 'SPEC-001', field: 'name' }],
          warnings: [{ message: 'Deprecated field', specId: 'SPEC-001', field: 'old_name' }],
        },
      });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('{"key": "value"}' as never);

      await checkCommand('all', {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('Missing field');
      expect(output).toContain('Deprecated field');
    });
  });

  describe('missing external file', () => {
    it('reports error when external source file does not exist', async () => {
      const model = createMockModel({ externalSourcePath: 'nonexistent.yaml' });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);
      mockedExistsSync.mockReturnValue(false);

      await checkCommand('external-ssot', {});

      expect(exitSpy).toHaveBeenCalledWith(1);
      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('External source not found');
    });
  });

  describe('coverage check', () => {
    it('runs coverage checks when --coverage option is specified', async () => {
      const model = createMockModel({
        hasCoverageChecker: true,
        coverageResult: {
          total: 10,
          covered: 10,
          uncovered: 0,
          coveragePercent: 100,
          coveredItems: [],
          uncoveredItems: [],
        },
      });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);

      await checkCommand('test', { coverage: true });

      expect(model.getCoverageChecker).toHaveBeenCalled();
      expect(model.checkCoverage).toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('no models', () => {
    it('completes successfully with no models', async () => {
      mockedLoadConfig.mockResolvedValue(createMockConfig([]) as never);

      await checkCommand('all', {});

      expect(exitSpy).not.toHaveBeenCalled();
    });
  });
});
