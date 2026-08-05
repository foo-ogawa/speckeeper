/**
 * FR-605, NFR-008, NFR-015: repository-level facts the requirements state —
 * the retired checker locations, the TypeScript compilation settings, and the
 * wiring that keeps the existing test suites running.
 *
 * The paths, versions and thresholds come from the requirement text, the artifact
 * contracts and the tool configuration, never from a copy kept in this file.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { glob } from 'glob';
import {
  acceptanceCriterion,
  artifactFiles,
  parenthesisedLists,
  repoRoot,
  requirement,
} from './design-data.ts';

/** Directory name the retired checker architecture used. */
const RETIRED_CHECKER_DIR = '_checkers';

/** Test files follow the `*.test.ts` naming convention vitest collects. */
const TEST_FILE_SUFFIX = '.test.ts';

interface VitestSuiteConfig {
  test: { include: string[]; exclude?: string[] };
}

function packageJson(): { scripts: Record<string, string> } {
  return JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8'));
}

function collected(config: VitestSuiteConfig): string[] {
  return glob.sync(config.test.include, {
    cwd: repoRoot,
    ignore: config.test.exclude ?? [],
    nodir: true,
  });
}

describe('FR-605: the separate checker locations are gone', () => {
  it('FR-605-04 no speckeeper source file references the retired checker directory', () => {
    // The source file set is the one artifact-contracts.yaml declares as source code.
    const files = artifactFiles('speckeeper-source-code');
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.filter((file) =>
      readFileSync(join(repoRoot, file), 'utf-8').includes(RETIRED_CHECKER_DIR),
    );

    expect(offenders).toEqual([]);
  });

  it('FR-605-05 the checker template directory is removed and the core DSL holds the logic', () => {
    // The requirement names both paths: the removed one and where the logic moved.
    const [[removed], [moved]] = parenthesisedLists(acceptanceCriterion('FR-605-05').description);

    expect(existsSync(join(repoRoot, removed)), removed).toBe(false);
    expect(existsSync(join(repoRoot, moved)), moved).toBe(true);
  });
});

describe('NFR-008: TypeScript compatibility', () => {
  it('NFR-008-01 the project compiles on the required TypeScript version', { timeout: 300_000 }, () => {
    const versionMatch = requirement('NFR-008').description.match(/TypeScript (\d+)(?:\.(\d+))?/);
    if (!versionMatch) {
      throw new Error(`No TypeScript version in: ${requirement('NFR-008').description}`);
    }
    const [requiredMajor, requiredMinor] = [Number(versionMatch[1]), Number(versionMatch[2] ?? 0)];

    const compilerPackage = join(repoRoot, 'node_modules', 'typescript');
    const installed: string = JSON.parse(
      readFileSync(join(compilerPackage, 'package.json'), 'utf-8'),
    ).version;
    const [major, minor] = installed.split('.').map(Number);

    expect(
      major > requiredMajor || (major === requiredMajor && minor >= requiredMinor),
      `installed TypeScript ${installed} is older than ${requiredMajor}.${requiredMinor}`,
    ).toBe(true);

    const run = spawnSync(
      process.execPath,
      [join(compilerPackage, 'bin', 'tsc'), '--noEmit', '--project', join(repoRoot, 'tsconfig.json')],
      { cwd: repoRoot, encoding: 'utf-8' },
    );

    expect(run.status, `${run.stdout ?? ''}\n${run.stderr ?? ''}`).toBe(0);
  });

  it('NFR-008-02 the compilation the check runs is a strict-mode compilation', () => {
    const compilerOptions: Record<string, unknown> = JSON.parse(
      readFileSync(join(repoRoot, 'tsconfig.json'), 'utf-8'),
    ).compilerOptions;

    expect(compilerOptions.strict).toBe(true);

    // No member of the strict family may be switched back off.
    const relaxed = Object.entries(compilerOptions).filter(
      ([option, value]) =>
        (option.startsWith('strict') || option.startsWith('noImplicit')) && value === false,
    );
    expect(relaxed).toEqual([]);
  });
});

describe('NFR-015: the existing tests keep running', () => {
  it('NFR-015-01 every test file on disk is collected by exactly one configured suite', async () => {
    const unitSuite = (await import('../../vitest.config.ts')).default as VitestSuiteConfig;
    const bundleSuite = (await import('../../vitest.bundle.config.ts')).default as VitestSuiteConfig;

    // The candidate set is the declared test-suite artifact, not a pattern of our own.
    const onDisk = artifactFiles('test-suite').filter((file) => file.endsWith(TEST_FILE_SUFFIX));
    expect(onDisk.length).toBeGreaterThan(0);

    const suites = [collected(unitSuite), collected(bundleSuite)];
    for (const file of onDisk) {
      const claiming = suites.filter((files) => files.includes(file)).length;
      expect(claiming, `${file} is collected by ${claiming} suite(s)`).toBe(1);
    }
  });

  it('NFR-015-01 CI runs both configured suites', () => {
    const workflow = parseYaml(
      readFileSync(join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf-8'),
    ) as { jobs: Record<string, { steps: Array<{ run?: string }> }> };

    const commands = Object.values(workflow.jobs)
      .flatMap((job) => job.steps)
      .map((step) => step.run ?? '')
      .join('\n');

    const scripts = packageJson().scripts;
    for (const script of ['test:ci', 'test:bundle']) {
      expect(scripts[script], script).toContain('vitest');
      expect(commands, script).toContain(`npm run ${script}`);
    }
  });
});
