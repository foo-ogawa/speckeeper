/**
 * NFR-012, NFR-013, NFR-014: traceability between the CLI contract, the design
 * specs and the tests under test/cli/.
 *
 * Command names, module paths, test paths and the coverage threshold are all read
 * from the declared sources — design/requirements.yaml and design/cli-commands.yaml
 * (through design/index.ts), design/test-refs.yaml and cli-contract.yaml — so a
 * change on one side cannot leave this file asserting a stale expectation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { glob } from 'glob';
import { toPosixPaths } from '../../src/core/paths.js';
import { CLICommandModel } from '../../design/_models/cli-command.ts';
import { TestRefModel } from '../../design/_models/test-ref.ts';
import {
  acceptanceCriterion,
  cliCommandSpecs,
  contractCommandNames,
  parenthesisedLists,
  repoRoot,
  requirement,
  specRegistry,
  testRefSpecs,
} from './design-data.ts';

const CLI_TEST_DIR = 'test/cli';

/** Command names the requirement scopes, cross-checked against the CLI contract. */
function scopedCommandNames(text: string): string[] {
  const [names] = parenthesisedLists(text);
  const known = contractCommandNames();
  expect(names.length).toBeGreaterThan(0);
  for (const name of names) {
    expect(known, `${name} is not a command in cli-contract.yaml`).toContain(name);
  }
  return names;
}

describe('NFR-012: every CLI command is covered by a test in test/cli/', () => {
  beforeEach(() => {
    // The TestRef checker globs test files relative to the working directory.
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('NFR-012-01 each CLI command the requirement names has a test file in test/cli/', () => {
    for (const name of scopedCommandNames(acceptanceCriterion('NFR-012-01').description)) {
      const testFile = `${CLI_TEST_DIR}/${name}.test.ts`;
      expect(existsSync(join(repoRoot, testFile)), testFile).toBe(true);
    }
  });

  it('NFR-012-02 describe/it names in test/cli/ mention the requirements the TestRef declares', () => {
    const model = TestRefModel.instance;
    const cliRefs = testRefSpecs().filter((ref) => ref.source.path.startsWith(`${CLI_TEST_DIR}/`));
    expect(cliRefs.length).toBeGreaterThan(0);

    for (const ref of cliRefs) {
      // The declared checker reports an unmentioned requirement as a warning on
      // the verifiesRequirements field.
      const unmentioned = model
        .check(ref, '')
        .warnings.filter(
          (warning) =>
            warning.field === 'verifiesRequirements' && warning.message.includes('not mentioned'),
        )
        .map((warning) => warning.message);

      expect(unmentioned, ref.id).toEqual([]);
    }
  });

  it(
    'NFR-012-03 statement coverage of the CLI command modules reaches the required percentage',
    { timeout: 300_000 },
    () => {
      const criterion = acceptanceCriterion('NFR-012-03');
      const thresholdMatch = criterion.description.match(/(\d+)%\s+or above/);
      if (!thresholdMatch) {
        throw new Error(`No coverage threshold in: ${criterion.description}`);
      }
      const threshold = Number(thresholdMatch[1]);

      // The commands in scope come from the parent requirement, which names them.
      const names = scopedCommandNames(requirement('NFR-012').description);
      const testFiles = names.map((name) => `${CLI_TEST_DIR}/${name}.test.ts`);
      const modules = names.map((name) => `src/cli/${name}.ts`);
      for (const path of [...testFiles, ...modules]) {
        expect(existsSync(join(repoRoot, path)), path).toBe(true);
      }

      const reportDir = mkdtempSync(join(tmpdir(), 'speckeeper-cli-coverage-'));
      try {
        // A nested runner keeps the measurement independent of how the outer run
        // was invoked. Only the CLI command tests run, so the figure never
        // overstates what the CLI tests themselves cover.
        const env = { ...process.env };
        for (const key of Object.keys(env)) {
          if (key.startsWith('VITEST')) delete env[key];
        }

        const run = spawnSync(
          process.execPath,
          [
            join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs'),
            'run',
            ...testFiles,
            '--coverage',
            ...modules.map((module) => `--coverage.include=${module}`),
            '--coverage.reporter=json-summary',
            `--coverage.reportsDirectory=${reportDir}`,
          ],
          { cwd: repoRoot, env, encoding: 'utf-8' },
        );

        expect(run.status, `${run.stdout ?? ''}\n${run.stderr ?? ''}`).toBe(0);

        const summary = JSON.parse(
          readFileSync(join(reportDir, 'coverage-summary.json'), 'utf-8'),
        ) as { total: { statements: { pct: number; covered: number; total: number } } };

        expect(Object.keys(summary).length).toBeGreaterThan(1);
        expect(
          summary.total.statements.pct,
          `${summary.total.statements.covered}/${summary.total.statements.total} statements`,
        ).toBeGreaterThanOrEqual(threshold);
      } finally {
        rmSync(reportDir, { recursive: true, force: true });
      }
    },
  );
});

describe('NFR-013: tests and specifications trace to each other', () => {
  beforeEach(() => {
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('NFR-013-01 every test file in test/cli/ is declared by a TestRef', () => {
    const onDisk = toPosixPaths(glob.sync(`${CLI_TEST_DIR}/*.test.ts`, { cwd: repoRoot })).sort();
    expect(onDisk.length).toBeGreaterThan(0);

    const declared = new Set(testRefSpecs().map((ref) => ref.source.path));
    for (const file of onDisk) {
      expect(declared, file).toContain(file);
    }
  });

  it('NFR-013-02 TestRefs link to command IDs via implementsCommand', () => {
    const commands = cliCommandSpecs();
    const commandIds = new Set(commands.map((command) => command.id));
    const refs = testRefSpecs();

    // Every declared link resolves to a command that exists.
    const linked = refs.filter((ref) => ref.implementsCommand !== undefined);
    expect(linked.length).toBeGreaterThan(0);
    for (const ref of linked) {
      expect(commandIds, `${ref.id} → ${ref.implementsCommand}`).toContain(ref.implementsCommand);
    }

    // Every command whose test file exists in test/cli/ is linked from that file.
    for (const command of commands) {
      const testFile = `${CLI_TEST_DIR}/${command.name}.test.ts`;
      if (!existsSync(join(repoRoot, testFile))) continue;

      const owning = refs.filter((ref) => ref.source.path === testFile);
      expect(owning.map((ref) => ref.implementsCommand), testFile).toContain(command.id);
    }
  });

  it('NFR-013-04 every acceptance criterion the coverage checker targets is covered', () => {
    const result = TestRefModel.instance.checkCoverage(testRefSpecs() as never[], specRegistry());

    expect(result, 'the TestRef model declares no coverage checker').not.toBeNull();
    expect(result!.total, 'the checker targets no criteria').toBeGreaterThan(0);
    expect(result!.uncoveredItems.map((item) => item.id)).toEqual([]);
    expect(result!.coveragePercent).toBe(100);
  });

  it('NFR-013-03 the declared TestRef check succeeds for every TestRef', () => {
    const model = TestRefModel.instance;
    const refs = testRefSpecs();
    expect(refs.length).toBeGreaterThan(0);

    for (const ref of refs) {
      const result = model.check(ref, '');
      expect(result.errors.map((error) => error.message), ref.id).toEqual([]);
      expect(result.success, ref.id).toBe(true);
    }
  });
});

describe('NFR-014: CLI definitions match the contract and the generated program', () => {
  beforeEach(() => {
    // checkCLICommand parses the generated program relative to the working directory.
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const MISMATCH_RULES = ['cmd-spec-impl-mismatch', 'cmd-impl-without-spec'];

  it('NFR-014-01 every command definition matches the contract and the generated program', () => {
    const specs = cliCommandSpecs();
    expect(specs.length).toBeGreaterThan(0);

    // Definition ↔ generated program: parameters, arguments and command set.
    const mismatches = CLICommandModel.instance
      .lintAll(specs)
      .filter((result) => MISMATCH_RULES.includes(result.ruleId));
    expect(mismatches.map((result) => result.message)).toEqual([]);

    // Definition ↔ cli-contract.yaml: every contracted command is specified.
    const specNames = specs.map((spec) => spec.name);
    for (const name of contractCommandNames()) {
      expect(specNames, name).toContain(name);
    }
  });

  it('NFR-014-01 a definition that drifts from the generated program is reported', () => {
    const [first, ...rest] = cliCommandSpecs();
    const drifted = {
      ...first,
      parameters: [
        ...first.parameters,
        {
          kind: 'option' as const,
          name: 'not-in-the-implementation',
          type: 'boolean' as const,
          description: 'Option the generated program does not declare',
          required: false,
        },
      ],
    };

    const mismatches = CLICommandModel.instance
      .lintAll([drifted, ...rest])
      .filter((result) => result.ruleId === 'cmd-spec-impl-mismatch');

    expect(mismatches.map((result) => result.message).join('\n')).toContain(
      'not-in-the-implementation',
    );
  });
});
