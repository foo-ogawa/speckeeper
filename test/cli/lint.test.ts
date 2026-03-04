import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lintCommand } from '../../src/cli/lint.js';
import type { LintCommandOptions } from '../../src/cli/lint.js';

vi.mock('../../src/utils/config-loader.js');

const { loadConfig } = await import('../../src/utils/config-loader.js');
const mockedLoadConfig = vi.mocked(loadConfig);

function createMockModel(overrides: {
  id?: string;
  name?: string;
  lintResults?: Array<{ ruleId: string; severity: string; message: string; specId?: string }>;
} = {}) {
  const id = overrides.id ?? 'test-model';
  return {
    id,
    name: overrides.name ?? 'TestModel',
    lintAll: vi.fn().mockReturnValue(overrides.lintResults ?? []),
    getExporters: vi.fn().mockReturnValue([]),
    register: vi.fn(),
  };
}

function createMockConfig(overrides: {
  models?: ReturnType<typeof createMockModel>[];
  specData?: unknown[];
} = {}) {
  const models = overrides.models ?? [createMockModel()];
  const specData = overrides.specData ?? [{ id: 'SPEC-001' }];
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

describe('lintCommand', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('FR-401-01 orchestration: error-severity lint results trigger exit(1)', () => {
    it('FR-401-01 calls lintAll and exits with code 1 when error-severity results exist', async () => {
      const model = createMockModel({
        lintResults: [
          { ruleId: 'id-unique', severity: 'error', message: 'Duplicate ID: SPEC-001', specId: 'SPEC-001' },
        ],
      });
      mockedLoadConfig.mockResolvedValue(createMockConfig({ models: [model] }) as never);

      await lintCommand({});

      expect(model.lintAll).toHaveBeenCalledWith([{ id: 'SPEC-001' }]);
      expect(exitSpy).toHaveBeenCalledWith(1);
      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('Duplicate ID: SPEC-001');
    });
  });

  describe('FR-401-03 orchestration: error results from ref-check are reported', () => {
    it('FR-401-03 exits with code 1 and outputs error message when lintAll returns ref-exists error', async () => {
      const model = createMockModel({
        lintResults: [
          { ruleId: 'ref-exists', severity: 'error', message: 'Referenced target not found: MISSING-001', specId: 'SPEC-002' },
        ],
      });
      mockedLoadConfig.mockResolvedValue(createMockConfig({ models: [model] }) as never);

      await lintCommand({});

      expect(exitSpy).toHaveBeenCalledWith(1);
      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('Referenced target not found');
    });
  });

  describe('FR-402-01 orchestration: warning-severity results do not trigger exit', () => {
    it('FR-402-01 calls lintAll, outputs warning, and completes without exit when only warnings exist', async () => {
      const model = createMockModel({
        lintResults: [
          { ruleId: 'custom-rule', severity: 'warning', message: 'Custom rule warning' },
        ],
      });
      mockedLoadConfig.mockResolvedValue(createMockConfig({ models: [model] }) as never);

      await lintCommand({});

      expect(model.lintAll).toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('Custom rule warning');
    });
  });

  describe('no issues', () => {
    it('returns success when no lint issues found', async () => {
      const model = createMockModel({ lintResults: [] });
      mockedLoadConfig.mockResolvedValue(createMockConfig({ models: [model] }) as never);

      await lintCommand({});

      expect(exitSpy).not.toHaveBeenCalled();
      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('No issues found');
    });
  });

  describe('--format json', () => {
    it('outputs JSON format when --format json specified', async () => {
      const model = createMockModel({
        lintResults: [
          { ruleId: 'test-rule', severity: 'warning', message: 'Test warning' },
        ],
      });
      mockedLoadConfig.mockResolvedValue(createMockConfig({ models: [model] }) as never);

      const options: LintCommandOptions = { format: 'json' };
      await lintCommand(options);

      const jsonCalls = logSpy.mock.calls.filter(c =>
        typeof c[0] === 'string' && c[0].startsWith('{'),
      );
      expect(jsonCalls.length).toBeGreaterThan(0);
      const parsed = JSON.parse(jsonCalls[0][0]);
      expect(parsed).toHaveProperty('issues');
      expect(parsed).toHaveProperty('errors');
      expect(parsed).toHaveProperty('warnings');
    });
  });

  describe('--strict mode', () => {
    it('includes info-severity issues in output when strict is set', async () => {
      const model = createMockModel({
        lintResults: [
          { ruleId: 'info-rule', severity: 'info', message: 'Info-level notice' },
        ],
      });
      mockedLoadConfig.mockResolvedValue(createMockConfig({ models: [model] }) as never);

      await lintCommand({ strict: true });

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).toContain('Info-level notice');
    });

    it('filters out info-severity issues when strict is NOT set', async () => {
      const model = createMockModel({
        lintResults: [
          { ruleId: 'info-rule', severity: 'info', message: 'Info-level notice' },
        ],
      });
      mockedLoadConfig.mockResolvedValue(createMockConfig({ models: [model] }) as never);

      await lintCommand({});

      const output = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(output).not.toContain('Info-level notice');
    });
  });

  describe('error handling', () => {
    it('propagates error when loadConfig throws', async () => {
      mockedLoadConfig.mockRejectedValue(new Error('Config not found'));

      await expect(lintCommand({})).rejects.toThrow('Config not found');
    });
  });

  describe('empty design', () => {
    it('completes successfully with no models', async () => {
      mockedLoadConfig.mockResolvedValue(createMockConfig({
        models: [],
        specData: [],
      }) as never);

      await lintCommand({});

      expect(exitSpy).not.toHaveBeenCalled();
    });
  });
});
