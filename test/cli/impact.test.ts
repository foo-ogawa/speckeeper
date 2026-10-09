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
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.exitCode = undefined;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
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

      const progress = errorSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(progress).toContain('FR-001');
      expect(progress).toContain('Analyzing impact');
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

      const progress = errorSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(progress).toContain('Depth');
      expect(progress).toContain('5');
    });
  });

  describe('FR-701-03 relations are the input of impact analysis', () => {
    const specs = [
      { id: 'FR-001', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      { id: 'CMP-001', relations: [{ type: 'implements', target: 'FR-001' }] },
      { id: 'FR-003', note: 'FR-001' },
      { id: 'UC-001' },
    ];

    async function impactedIds(options: Record<string, unknown>): Promise<string[]> {
      mockedLoadConfig.mockResolvedValue(createMockConfig([createMockModel()], specs) as never);
      await impactCommand('FR-001', { format: 'json', ...options } as never);
      const stdout = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      return (JSON.parse(stdout) as { impactedNodes: { id: string }[] }).impactedNodes.map(n => n.id);
    }

    it('FR-701-03 follows relations in both directions by default and ignores IDs written in other fields', async () => {
      expect(await impactedIds({})).toEqual(['CMP-001', 'UC-001']);
    });

    it('FR-701-03 --direction upstream follows only the relations the target declares', async () => {
      expect(await impactedIds({ direction: 'upstream' })).toEqual(['UC-001']);
    });

    it('FR-701-03 --direction downstream follows only the relations declared to the target', async () => {
      expect(await impactedIds({ direction: 'downstream' })).toEqual(['CMP-001']);
    });

    it('FR-701-03 reports each element at its shortest depth', async () => {
      mockedLoadConfig.mockResolvedValue(createMockConfig([createMockModel()], [
        { id: 'FR-001', relations: [{ type: 'refines', target: 'FR-002' }, { type: 'refines', target: 'FR-003' }] },
        { id: 'FR-002', relations: [{ type: 'refines', target: 'FR-003' }] },
        { id: 'FR-003' },
      ]) as never);
      await impactCommand('FR-001', { format: 'json' } as never);
      const result = JSON.parse(logSpy.mock.calls.map(c => String(c[0])).join('\n')) as {
        impactedNodes: { id: string; depth: number }[];
      };
      expect(result.impactedNodes.map(n => [n.id, n.depth])).toEqual([['FR-002', 1], ['FR-003', 1]]);
    });
  });

  describe('orchestration: non-existent ID triggers exit(1)', () => {
    it('exits with code 1 when target ID is not found in registry', async () => {
      mockedLoadConfig.mockResolvedValue(createMockConfig([], []) as never);

      await impactCommand('NONEXIST-999', {});
      expect(process.exitCode).toBe(1);
    });
  });
});
