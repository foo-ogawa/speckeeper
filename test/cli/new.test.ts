import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { newCommand } from '../../src/cli/new.js';

vi.mock('../../src/utils/config-loader.js');

const { loadConfig } = await import('../../src/utils/config-loader.js');
const mockedLoadConfig = vi.mocked(loadConfig);

function createMockModel(overrides: {
  id?: string;
  name?: string;
  idPrefix?: string;
} = {}) {
  const id = overrides.id ?? 'requirement';
  return {
    id,
    name: overrides.name ?? 'Requirement',
    idPrefix: overrides.idPrefix ?? 'FR',
    getExporters: vi.fn().mockReturnValue([]),
    lintAll: vi.fn().mockReturnValue([]),
    register: vi.fn(),
    schema: { parse: vi.fn().mockImplementation((v: unknown) => v) },
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
      data: [],
    })),
  };
}

describe('newCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.exitCode = undefined;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  describe('FR-104-01 orchestration: outputs model types header when no type given', () => {
    it('FR-104-01 outputs available model types header when type is omitted', async () => {
      const model = createMockModel();
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);

      await newCommand({ type: undefined } as never);

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('Available model types');
    });
  });

  describe('unknown model type', () => {
    it('exits with error when unknown type specified', async () => {
      const model = createMockModel();
      mockedLoadConfig.mockResolvedValue(createMockConfig([model]) as never);

      await newCommand({ type: 'nonexistent-type' } as never);
      expect(process.exitCode).toBe(1);
    });
  });

  describe('error handling', () => {
    it('propagates error when loadConfig throws', async () => {
      mockedLoadConfig.mockRejectedValue(new Error('Config not found'));

      await expect(newCommand({} as never)).rejects.toThrow('Config not found');
    });
  });
});
