import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { driftCommand } from '../../src/cli/drift.js';

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

function createMockExporter(overrides: { single?: (spec: unknown) => string } = {}) {
  return {
    format: 'markdown',
    single: overrides.single ?? vi.fn().mockReturnValue('# Expected'),
    outputDir: 'output',
  };
}

function createMockModel(overrides: {
  id?: string;
  name?: string;
  exporters?: ReturnType<typeof createMockExporter>[];
} = {}) {
  const id = overrides.id ?? 'test-model';
  return {
    id,
    name: overrides.name ?? 'TestModel',
    getExporters: vi.fn().mockReturnValue(overrides.exporters ?? []),
    getFilename: vi.fn().mockReturnValue('test-file'),
    lintAll: vi.fn().mockReturnValue([]),
    register: vi.fn(),
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

describe('driftCommand', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('FR-500-01 orchestration: no drift when generated content matches file', () => {
    it('FR-500-01 outputs "No drift detected" when generated and actual content match', async () => {
      const exporter = createMockExporter({
        single: () => '# Expected Content',
      });
      const model = createMockModel({ exporters: [exporter] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('# Expected Content' as never);

      await driftCommand({});

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('No drift detected');
    });
  });

  describe('FR-500-01 orchestration: drift detected when content differs', () => {
    it('FR-500-01 reports drifted files when generated and actual content differ', async () => {
      const exporter = createMockExporter({
        single: () => '# Expected Content',
      });
      const model = createMockModel({ exporters: [exporter] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('# Modified Content' as never);

      await driftCommand({});

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('drifted');
    });
  });

  describe('FR-500-02 orchestration: failOnDrift triggers exit(1) when drift exists', () => {
    it('FR-500-02 exits with code 1 when drift detected and failOnDrift is set', async () => {
      const exporter = createMockExporter({
        single: () => '# Expected Content',
      });
      const model = createMockModel({ exporters: [exporter] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('# Manually Edited' as never);

      await expect(driftCommand({ failOnDrift: true })).rejects.toThrow('process.exit(1)');
    });
  });

  describe('orchestration: missing files are reported', () => {
    it('reports missing files when generated file does not exist on disk', async () => {
      const exporter = createMockExporter({
        single: () => '# Content',
      });
      const model = createMockModel({ exporters: [exporter] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);
      mockedExistsSync.mockReturnValue(false);

      await driftCommand({});

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('missing');
    });
  });

  describe('orchestration: no exporters means no files to check', () => {
    it('completes without drift when model has no exporters', async () => {
      const model = createMockModel({ exporters: [] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);

      await driftCommand({});

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).not.toContain('drifted');
    });
  });

  describe('error handling', () => {
    it('propagates error when loadConfig throws', async () => {
      mockedLoadConfig.mockRejectedValue(new Error('Config not found'));

      await expect(driftCommand({})).rejects.toThrow('Config not found');
    });
  });
});
