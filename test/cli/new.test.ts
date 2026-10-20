import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';
import { newCommand } from '../../src/cli/new.js';

vi.mock('../../src/utils/config-loader.js');

const { loadConfig } = await import('../../src/utils/config-loader.js');
const mockedLoadConfig = vi.mocked(loadConfig);

function createMockModel(overrides: {
  id?: string;
  name?: string;
  idPrefix?: string;
} = {}) {
  return {
    id: overrides.id ?? 'requirement',
    name: overrides.name ?? 'Requirement',
    idPrefix: overrides.idPrefix ?? 'REQ',
  };
}

/** A config registering the models, each with the elements of the given IDs */
function useConfig(models: Array<ReturnType<typeof createMockModel> & { ids?: string[] }>) {
  mockedLoadConfig.mockResolvedValue({
    srcDir: 'src',
    designDir: 'design',
    docsDir: 'docs',
    specsDir: 'specs',
    models,
    specs: models.map(m => ({
      model: { id: m.id, register: vi.fn() },
      data: (m.ids ?? []).map(id => ({ id })),
    })),
  } as never);
}

describe('newCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  const printed = (): string => logSpy.mock.calls.map(c => String(c[0])).join('\n');

  beforeEach(() => {
    process.exitCode = undefined;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  describe('FR-104-01 the element types are the models the config registers', () => {
    it('FR-104-01 creates an element of a model the config registers', async () => {
      useConfig([createMockModel(), createMockModel({ id: 'term', name: 'Term', idPrefix: 'TERM' })]);

      await newCommand('term', { dryRun: true });

      expect(process.exitCode).toBeUndefined();
      expect(printed()).toContain("id: \"TERM-001\"");
    });

    it('FR-104-01 lists the model types the config registers when the type is not one of them', async () => {
      useConfig([createMockModel(), createMockModel({ id: 'term', name: 'Term', idPrefix: 'TERM' })]);

      await newCommand('nonexistent-type', { dryRun: true });

      expect(process.exitCode).toBe(1);
      const errors = errorSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(errors).toContain("Unknown model type 'nonexistent-type'");
      expect(errors).toContain('requirement, term');
    });
  });

  describe('the ID follows the model prefix and the existing elements', () => {
    it.each([
      ['the first element of a model', [], 'REQ-001'],
      ['after the highest existing number', ['REQ-001', 'REQ-007', 'REQ-003'], 'REQ-008'],
      ['with as many digits as the highest existing ID', ['REQ-99', 'REQ-100'], 'REQ-101'],
      ['ignoring IDs of another shape', ['REQ-002', 'REQ-002-01', 'OTHER-500'], 'REQ-003'],
    ])('numbers %s', async (_case, ids, expected) => {
      useConfig([{ ...createMockModel(), ids }]);

      await newCommand('requirement', { dryRun: true });

      expect(printed()).toContain(`id: "${expected}"`);
    });
  });

  describe('the generated element', () => {
    it('--name sets the name of the element', async () => {
      useConfig([createMockModel()]);

      await newCommand('requirement', { dryRun: true, name: 'User "Login"' });

      expect(printed()).toContain('name: "User \\"Login\\"",');
    });

    it('is TypeScript that compiles wherever it is placed, also for a model whose name is not an identifier', async () => {
      useConfig([createMockModel({ id: 'functional-requirement', name: 'Functional Requirement', idPrefix: 'FR' })]);

      await newCommand('functional-requirement', { dryRun: true, name: 'User Login' });

      const source = printed().slice(printed().indexOf('/**'));
      expect(source).not.toContain('import');
      const { diagnostics } = ts.transpileModule(source, { reportDiagnostics: true });
      expect(diagnostics?.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    });

    it('writes the element into the output directory and refuses to overwrite it', async () => {
      useConfig([{ ...createMockModel(), ids: ['REQ-001'] }]);
      const dir = mkdtempSync(join(tmpdir(), 'speckeeper-new-'));
      try {
        await newCommand('requirement', { output: dir });
        const file = join(dir, 'requirement-REQ-002.ts');
        expect(existsSync(file)).toBe(true);
        expect(readFileSync(file, 'utf-8')).toContain('id: "REQ-002"');
        expect(process.exitCode).toBeUndefined();

        await newCommand('requirement', { output: dir });
        expect(process.exitCode).toBe(1);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('error handling', () => {
    it('propagates error when loadConfig throws', async () => {
      mockedLoadConfig.mockRejectedValue(new Error('Config not found'));

      await expect(newCommand('requirement', {})).rejects.toThrow('Config not found');
    });
  });
});
