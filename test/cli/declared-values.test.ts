/**
 * NFR-014: values outside what cli-contract.yaml declares
 *
 * The contract declares the values an option or an argument takes (an enum, an
 * integer and its minimum). An invocation that gives another value is rejected
 * before the command runs, and ends with the exit the contract declares for
 * invalid input.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { createCheckedProgram } from '../../src/cli/declared-values.js';
import type { CommandHandlers } from '../../src/generated/program.js';

const repoRoot = join(import.meta.dirname, '..', '..');

interface ValueSchema {
  type?: string;
  enum?: string[];
  minimum?: number;
  items?: ValueSchema;
}

interface Declared {
  name: string;
  required?: boolean;
  variadic?: boolean;
  schema?: ValueSchema;
}

interface DeclaredCommand {
  arguments?: Declared[];
  options?: Declared[];
  exits: Record<string, unknown>;
}

const contractCommands = Object.entries(
  Object.values(
    (parseYaml(readFileSync(join(repoRoot, 'cli-contract.yaml'), 'utf-8')) as {
      command_sets: Record<string, { commands: Record<string, DeclaredCommand> }>;
    }).command_sets,
  )[0].commands,
);

/** One option or argument whose values the contract restricts, with a value it declares and ones it does not */
interface Case {
  title: string;
  argv: (value: string) => string[];
  declared: string[];
  undeclared: string[];
  exit: number;
}

function cases(): Case[] {
  const all: Case[] = [];
  for (const [id, command] of contractCommands) {
    const path = id.split('.');
    const args = command.arguments ?? [];
    // A declared value for every other required argument, so the invocation differs only in the value under test
    const fill = (index: number, value: string): string[] =>
      args.flatMap((a, i) => (i === index ? [value] : a.required ? [a.schema?.enum?.[0] ?? 'x'] : []));
    const exit = command.exits['2'] !== undefined ? 2 : 1;

    const restricted = (schema: ValueSchema | undefined): ValueSchema | undefined => {
      const values = schema?.items ?? schema;
      return values?.enum || values?.type === 'integer' ? values : undefined;
    };
    const values = (schema: ValueSchema): Pick<Case, 'declared' | 'undeclared'> =>
      schema.enum
        ? { declared: schema.enum, undeclared: ['__undeclared__'] }
        : {
            declared: [String(schema.minimum ?? 1)],
            undeclared: ['abc', '1.5', ...(schema.minimum !== undefined ? [String(schema.minimum - 1)] : [])],
          };

    args.forEach((argument, index) => {
      const schema = restricted(argument.schema);
      if (!schema) return;
      all.push({
        title: `${id} <${argument.name}>`,
        argv: value => [...path, ...fill(index, value)],
        ...values(schema),
        exit,
      });
    });
    for (const option of command.options ?? []) {
      const schema = restricted(option.schema);
      if (!schema) continue;
      all.push({
        title: `${id} --${option.name}`,
        argv: value => [...path, ...fill(-1, ''), `--${option.name}`, value],
        ...values(schema),
        exit,
      });
    }
  }
  return all;
}

class Exited extends Error {
  constructor(readonly code: number | undefined) {
    super(`exit ${code}`);
  }
}

/** Parses an invocation with handlers that only record that they ran */
async function invoke(argv: string[]): Promise<{ ran: string[]; exit?: number; stderr: string }> {
  const ran: string[] = [];
  const handlers = new Proxy({}, {
    get: (_target, name) => async () => { ran.push(String(name)); },
  }) as CommandHandlers;
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
    throw new Exited(code === null || code === undefined ? undefined : Number(code));
  });
  try {
    await createCheckedProgram(handlers, '0.0.0').parseAsync(argv, { from: 'user' });
    return { ran, stderr: stderr.mock.calls.map(c => String(c[0])).join('') };
  } catch (error) {
    if (!(error instanceof Exited)) throw error;
    return { ran, exit: error.code, stderr: stderr.mock.calls.map(c => String(c[0])).join('') };
  } finally {
    vi.restoreAllMocks();
  }
}

describe('options the contract does not declare', () => {
  it.each([
    [['build', '--watch']],
    [['build', '--format', 'json']],
    [['new', 'requirement', '--kind', 'functional']],
    [['new', 'requirement', '--template', 'template.ts']],
  ])('%j is rejected as an unknown option before the command runs', async (argv) => {
    const result = await invoke(argv);
    expect(result.ran).toEqual([]);
    expect(result.exit).toBe(1);
    expect(result.stderr).toContain('unknown option');
  });
});

describe('NFR-014: every value the contract restricts is checked before the command runs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const all = cases();

  it('NFR-014-02 the contract restricts values the check covers', () => {
    // Guards against a table that silently shrinks to nothing
    expect(all.length).toBeGreaterThanOrEqual(20);
  });

  it.each(all.map(c => [c.title, c] as const))(
    'NFR-014-02 %s rejects a value it does not declare with the input-error exit',
    async (_title, c) => {
      for (const value of c.undeclared) {
        const result = await invoke(c.argv(value));
        expect(result.ran, `${c.argv(value).join(' ')}`).toEqual([]);
        expect(result.exit, `${c.argv(value).join(' ')}`).toBe(c.exit);
        expect(result.stderr).toContain(`'${value}'`);
      }
    },
  );

  it.each(all.map(c => [c.title, c] as const))(
    'NFR-014-02 %s passes every value it declares to the command',
    async (_title, c) => {
      for (const value of c.declared) {
        const result = await invoke(c.argv(value));
        expect(result.exit, `${c.argv(value).join(' ')}: ${result.stderr}`).toBeUndefined();
        expect(result.ran).toHaveLength(1);
      }
    },
  );
});

/** Runs the CLI from the current sources */
function speckeeper(args: string[], options: { cwd?: string; input?: string } = {}): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    [join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(repoRoot, 'src', 'cli', 'index.ts'), ...args],
    { cwd: options.cwd ?? repoRoot, encoding: 'utf-8', timeout: 120_000, input: options.input ?? '' },
  );
}

const impactJson = JSON.stringify({ target: 'FR-100', targetType: 'functional-requirement', impactedNodes: [] });

describe('NFR-014: the CLI rejects a value outside what the contract declares', () => {
  it('NFR-014-02 impact --depth abc ends with exit 1 and names --depth', () => {
    const result = speckeeper(['impact', 'FR-100', '--depth', 'abc']);
    expect(result.stderr).toContain('--depth');
    expect(result.stdout).not.toContain('No impacted elements found');
    expect(result.status).toBe(1);
  }, 150_000);

  it('NFR-014-02 impact --depth below the declared minimum ends with exit 1', () => {
    const result = speckeeper(['impact', 'FR-100', '--depth', '0']);
    expect(result.stderr).toContain('--depth');
    expect(result.status).toBe(1);
  }, 150_000);

  it('NFR-014-02 impact --direction outside the enum ends with exit 1 and lists the declared values', () => {
    const result = speckeeper(['impact', 'FR-100', '--direction', 'sideways']);
    expect(result.stderr).toContain('upstream, downstream, both');
    expect(result.stderr).not.toContain('Direction: sideways');
    expect(result.status).toBe(1);
  }, 150_000);

  it('NFR-014-02 lint --format outside the enum ends with exit 1', () => {
    const result = speckeeper(['lint', '--format', 'xml']);
    expect(result.stderr).toContain('text, json, github');
    expect(result.status).toBe(1);
  }, 150_000);

  it('NFR-014-02 init --format outside the enum ends with exit 1 and writes nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'speckeeper-init-'));
    try {
      const result = speckeeper(['init', '--format', 'xml'], { cwd: dir });
      expect(result.stderr).toContain('ts, yaml');
      expect(result.status).toBe(1);
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 150_000);

  it('NFR-014-02 audit-requirements --report-format outside the enum ends with the input-error exit 2', () => {
    const result = speckeeper(['audit-requirements', '--show-prompt', '--report-format', 'bogus']);
    expect(result.stderr).toContain('json, text, yaml');
    expect(result.stdout).toBe('');
    expect(result.status).toBe(2);
  }, 150_000);

  it('NFR-014-02 explain-impact --fail-on outside the enum ends with the input-error exit 2', () => {
    const result = speckeeper(['explain-impact', '--show-prompt', '--fail-on', 'bogus'], { input: impactJson });
    expect(result.stderr).toContain('warning, error, critical');
    expect(result.stdout).toBe('');
    expect(result.status).toBe(2);
  }, 150_000);

  it('NFR-014-02 review --concurrency that is not an integer ends with exit 1 before reading the config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'speckeeper-review-'));
    try {
      const result = speckeeper(['review', '--concurrency', '1.5'], { cwd: dir });
      expect(result.stderr).toContain('--concurrency');
      expect(result.stderr).not.toContain('No review checks are declared');
      expect(result.status).toBe(1);
      expect(existsSync(join(dir, 'review'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 150_000);
});
