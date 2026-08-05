import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
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

/** Content the reference graph of createMockConfig() produces in specs/index.json */
const REFERENCE_GRAPH_JSON = JSON.stringify(
  { nodes: [{ id: 'SPEC-001', model: 'test-model' }], edges: [] },
  null,
  2,
) + '\n';

/**
 * Serve on-disk content per file: the aggregated reference graph for
 * specs/index.json, `exporterOutput` for every exporter file.
 */
function mockDisk(exporterOutput: string): void {
  mockedExistsSync.mockReturnValue(true);
  mockedReadFileSync.mockImplementation(((path: unknown) =>
    String(path).endsWith('index.json') ? REFERENCE_GRAPH_JSON : exporterOutput) as never);
}

describe('driftCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
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
      mockDisk('# Expected Content');

      await driftCommand({});

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('No drift detected');
      expect(output).toContain('Checked: 2 files');
    });
  });

  describe('FR-500-01 orchestration: drift detected when content differs', () => {
    it('FR-500-01 reports drifted files when generated and actual content differ', async () => {
      const exporter = createMockExporter({
        single: () => '# Expected Content',
      });
      const model = createMockModel({ exporters: [exporter] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);
      mockDisk('# Modified Content');

      await driftCommand({});

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('drifted');
      expect(output).toContain(join('docs', 'output', 'test-file.md'));
    });
  });

  describe('FR-500-02 orchestration: failOnDrift triggers exit(1) when drift exists', () => {
    it('FR-500-02 exits with code 1 when drift detected and failOnDrift is set', async () => {
      const exporter = createMockExporter({
        single: () => '# Expected Content',
      });
      const model = createMockModel({ exporters: [exporter] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);
      mockDisk('# Manually Edited');

      await expect(driftCommand({ failOnDrift: true })).rejects.toThrow('process.exit(1)');
    });
  });

  describe('FR-500-03 orchestration: drift output prompts to regenerate and commit', () => {
    it('FR-500-03 outputs a message prompting to regenerate and commit when drift is detected', async () => {
      const exporter = createMockExporter({
        single: () => '# Expected Content',
      });
      const model = createMockModel({ exporters: [exporter] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);
      mockDisk('# Manually Edited');

      await driftCommand({});

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('Regenerate the artifacts with "speckeeper build" and commit the result.');
    });

    it('FR-500-03 does not prompt to regenerate when no drift is detected', async () => {
      const exporter = createMockExporter({
        single: () => '# Expected Content',
      });
      const model = createMockModel({ exporters: [exporter] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);
      mockDisk('# Expected Content');

      await driftCommand({});

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).not.toContain('Regenerate');
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

  describe('orchestration: a model without exporters still contributes the aggregated graph', () => {
    it('checks only specs/index.json when the model has no exporters', async () => {
      const model = createMockModel({ exporters: [] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);
      mockDisk('# unused');

      await driftCommand({});

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('No drift detected');
      expect(output).toContain('Checked: 1 files');
      expect(mockedReadFileSync).toHaveBeenCalledWith(join(process.cwd(), 'specs', 'index.json'), 'utf-8');
    });
  });

  describe('error handling', () => {
    it('propagates error when loadConfig throws', async () => {
      mockedLoadConfig.mockRejectedValue(new Error('Config not found'));

      await expect(driftCommand({})).rejects.toThrow('Config not found');
    });
  });
});
