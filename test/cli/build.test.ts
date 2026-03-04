import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCommand } from '../../src/cli/build.js';

vi.mock('../../src/utils/config-loader.js');
vi.mock('../../src/utils/file-writer.js', () => ({
  ensureDir: vi.fn(),
  batchWriteFiles: vi.fn().mockResolvedValue({ created: 1, updated: 0, unchanged: 0 }),
}));

const { loadConfig } = await import('../../src/utils/config-loader.js');
const mockedLoadConfig = vi.mocked(loadConfig);

function createMockExporter(overrides: { outputDir?: string; hasSingle?: boolean; hasIndex?: boolean } = {}) {
  return {
    format: 'markdown',
    single: overrides.hasSingle !== false ? vi.fn().mockReturnValue('# Doc') : undefined,
    index: overrides.hasIndex ? vi.fn().mockReturnValue('# Index') : undefined,
    outputDir: overrides.outputDir ?? 'output',
    filename: vi.fn().mockReturnValue('test-file'),
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
    getExporters: vi.fn().mockReturnValue(overrides.exporters ?? [createMockExporter()]),
    getFilename: vi.fn().mockReturnValue('test-file'),
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

describe('buildCommand', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('FR-300-01 orchestration: exporters are invoked and files are written', () => {
    it('FR-300-01 calls exporter.single for each spec and passes results to batchWriteFiles', async () => {
      const exporter = createMockExporter();
      const model = createMockModel({ exporters: [exporter] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);

      const { batchWriteFiles } = await import('../../src/utils/file-writer.js');
      const mockedBatchWrite = vi.mocked(batchWriteFiles);

      await buildCommand({});

      expect(model.getExporters).toHaveBeenCalled();
      expect(exporter.single).toHaveBeenCalledWith({ id: 'SPEC-001' });
      expect(mockedBatchWrite).toHaveBeenCalled();
      const writtenFiles = mockedBatchWrite.mock.calls[0][0] as Array<{ path: string; content: string }>;
      expect(writtenFiles.length).toBeGreaterThan(0);
      expect(writtenFiles[0].content).toBe('# Doc');
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  describe('FR-301-05 orchestration: exporter.single receives same spec data on repeated builds', () => {
    it('FR-301-05 calls exporter.single with identical arguments on each build invocation', async () => {
      const exporter = createMockExporter();
      const model = createMockModel({ exporters: [exporter] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);

      await buildCommand({});
      await buildCommand({});

      expect(exporter.single).toHaveBeenCalledTimes(2);
      const firstArg = (exporter.single as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const secondArg = (exporter.single as ReturnType<typeof vi.fn>).mock.calls[1][0];
      expect(firstArg).toEqual(secondArg);
    });
  });

  describe('model without exporters', () => {
    it('skips models without exporters and logs no files to generate', async () => {
      const model = createMockModel({ exporters: [] });
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);

      const { batchWriteFiles } = await import('../../src/utils/file-writer.js');
      const mockedBatchWrite = vi.mocked(batchWriteFiles);
      const logSpy = vi.mocked(console.log);

      await buildCommand({});

      expect(exitSpy).not.toHaveBeenCalled();
      expect(mockedBatchWrite).not.toHaveBeenCalled();
      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('No files to generate');
    });
  });

  describe('error handling', () => {
    it('propagates error when loadConfig throws', async () => {
      mockedLoadConfig.mockRejectedValue(new Error('Config not found'));

      await expect(buildCommand({})).rejects.toThrow('Config not found');
    });
  });
});
