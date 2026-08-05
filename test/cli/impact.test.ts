import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { impactCommand } from '../../src/cli/impact.js';

vi.mock('../../src/utils/config-loader.js');

const { loadConfig } = await import('../../src/utils/config-loader.js');
const mockedLoadConfig = vi.mocked(loadConfig);

function createMockModel(overrides: { id?: string; name?: string } = {}) {
  const id = overrides.id ?? 'test-model';
  return {
    id,
    name: overrides.name ?? 'TestModel',
    lintAll: vi.fn().mockReturnValue([]),
    getExporters: vi.fn().mockReturnValue([]),
    register: vi.fn(),
  };
}

function createMockConfig(models: ReturnType<typeof createMockModel>[], specData: unknown[] = []) {
  return {
    designDir: 'design',
    docsDir: 'docs',
    specsDir: 'specs',
    models,
    specs: models.map(m => ({
      model: { id: m.id, register: m.register },
      data: specData,
    })),
  };
}

describe('impactCommand', () => {
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

  describe('FR-700-01 orchestration: impact command completes for a known target', () => {
    it('FR-700-01 outputs target info and reaches analysis phase for a valid ID in registry', async () => {
      const model = createMockModel();
      const specData = [
        { id: 'FR-001', relations: [{ type: 'satisfies', target: 'UC-001' }] },
        { id: 'UC-001', relations: [] },
      ];
      mockedLoadConfig.mockResolvedValue(createMockConfig([model], specData) as never);

      await impactCommand('FR-001', {});

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('FR-001');
      expect(output).toContain('Analyzing impact');
    });
  });

  describe('FR-700-04 orchestration: the impacted elements are listed in the output', () => {
    it('FR-700-04 displays impacted specs, components, and documents with their model type and depth', async () => {
      const requirement = createMockModel({ id: 'requirement' });
      const component = createMockModel({ id: 'component' });
      const document = createMockModel({ id: 'document' });
      mockedLoadConfig.mockResolvedValue({
        designDir: 'design',
        docsDir: 'docs',
        specsDir: 'specs',
        models: [requirement, component, document],
        specs: [
          {
            model: { id: 'requirement', register: requirement.register },
            data: [{ id: 'FR-001' }],
          },
          {
            model: { id: 'component', register: component.register },
            data: [{ id: 'CMP-001', relations: [{ type: 'implements', target: 'FR-001' }] }],
          },
          {
            model: { id: 'document', register: document.register },
            data: [{ id: 'DOC-001', relations: [{ type: 'describes', target: 'CMP-001' }] }],
          },
        ],
      } as never);

      await impactCommand('FR-001', {});

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('Direct impact (1)');
      expect(output).toContain('CMP-001 (component)');
      expect(output).toContain('Indirect impact (1)');
      expect(output).toContain('DOC-001 (document, depth: 2)');
      expect(output).toContain('Total: 2 impacted elements');
    });
  });

  describe('FR-700-03 orchestration: depth option is parsed and passed', () => {
    it('FR-700-03 outputs depth value from --depth option', async () => {
      const model = createMockModel();
      mockedLoadConfig.mockResolvedValue(createMockConfig([model], [{ id: 'FR-001' }]) as never);

      await impactCommand('FR-001', { depth: '5' } as never);

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('Depth');
      expect(output).toContain('5');
    });
  });

  describe('orchestration: non-existent ID triggers exit(1)', () => {
    it('exits with code 1 when target ID is not found in registry', async () => {
      mockedLoadConfig.mockResolvedValue(createMockConfig([], []) as never);

      await expect(impactCommand('NONEXIST-999', {})).rejects.toThrow('process.exit(1)');
    });
  });
});
