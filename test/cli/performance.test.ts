/**
 * Command performance at the declared scale
 *
 * The scales and the time budgets are read out of the acceptance criteria, so a
 * change to the requirement changes what is measured. The project under
 * measurement is produced by `speckeeper init` and then filled with generated
 * specs, so the commands do real work: the assertions below would pass over an
 * empty project, and the spec and file counts are asserted first to rule that
 * out.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { acceptanceCriterion, repoRoot } from '../design/design-data.ts';

const bundlePath = join(repoRoot, 'dist', 'speckeeper.bundle.mjs');

/** `within 60 seconds` -> 60 */
function budgetSeconds(acId: string): number {
  const text = acceptanceCriterion(acId).description;
  const match = /within (\d+) seconds?/.exec(text);
  if (!match) throw new Error(`${acId} declares no time budget: ${text}`);
  return Number(match[1]);
}

/** `500 requirements`, `100 entities`, `1000 files` -> the count for that noun */
function scale(acId: string, noun: string): number {
  const text = acceptanceCriterion(acId).description;
  const match = new RegExp(`(\\d+) ${noun}`).exec(text);
  if (!match) throw new Error(`${acId} declares no ${noun} scale: ${text}`);
  return Number(match[1]);
}

function requirementSource(count: number): string {
  const items = Array.from({ length: count }, (_, i) => {
    const id = `REQ-${String(i + 1).padStart(4, '0')}`;
    return `  { id: '${id}', name: 'Requirement ${i + 1}', type: 'functional', priority: 'must', description: 'Generated requirement ${i + 1}', acceptanceCriteria: [{ id: '${id}-01', description: 'holds', verificationMethod: 'test' }] },`;
  }).join('\n');
  return [
    "import { defineSpecs } from 'speckeeper';",
    "import type { Requirement } from './_models/requirement.ts';",
    "import { RequirementModel } from './_models/requirement.ts';",
    'const requirements: Requirement[] = [',
    items,
    '];',
    'export default defineSpecs([RequirementModel.instance, requirements]);',
    '',
  ].join('\n');
}

function entitySource(count: number): string {
  const items = Array.from({ length: count }, (_, i) =>
    `  { id: 'E-${String(i + 1).padStart(3, '0')}', name: 'Entity${i + 1}', description: 'Generated entity ${i + 1}', attributes: [{ name: 'id', logicalType: 'string', description: 'identifier', required: true }] },`,
  ).join('\n');
  return [
    "import { defineSpecs } from 'speckeeper';",
    "import type { Entity } from './_models/entity.ts';",
    "import { EntityModel } from './_models/entity.ts';",
    'const entities: Entity[] = [',
    items,
    '];',
    'export default defineSpecs([EntityModel.instance, entities]);',
    '',
  ].join('\n');
}

function screenSource(count: number): string {
  const items = Array.from({ length: count }, (_, i) =>
    `  { id: 'UC-${String(i + 1).padStart(3, '0')}', name: 'Screen${i + 1}', description: 'Generated screen ${i + 1}', actor: 'user', mainFlow: [{ stepNumber: 1, type: 'user_action', description: 'opens the screen' }] },`,
  ).join('\n');
  return [
    "import { defineSpecs } from 'speckeeper';",
    "import type { UseCase } from './_models/usecase.ts';",
    "import { UseCaseModel } from './_models/usecase.ts';",
    'const screens: UseCase[] = [',
    items,
    '];',
    'export default defineSpecs([UseCaseModel.instance, screens]);',
    '',
  ].join('\n');
}

/** Runs the published bin in the generated project and returns the elapsed seconds. */
function timeCommand(projectDir: string, args: string[]): { seconds: number; stdout: string } {
  const started = process.hrtime.bigint();
  const stdout = execFileSync(process.execPath, [bundlePath, ...args], {
    cwd: projectDir,
    encoding: 'utf8',
    timeout: 300_000,
  });
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  return { seconds, stdout };
}

describe('NFR-001: command performance at the declared scale', () => {
  let projectDir: string;
  let requirementCount: number;
  let fileCount: number;

  beforeAll(() => {
    if (!existsSync(join(repoRoot, 'dist', 'index.js'))) {
      execSync('npm run build', { cwd: repoRoot, stdio: 'pipe' });
    }
    execSync('node esbuild.bundle.mjs', { cwd: repoRoot, stdio: 'pipe' });

    projectDir = mkdtempSync(join(tmpdir(), 'speckeeper-perf-'));
    writeFileSync(
      join(projectDir, 'package.json'),
      JSON.stringify({ name: 'perf-fixture', version: '1.0.0', private: true }),
    );
    mkdirSync(join(projectDir, 'node_modules'), { recursive: true });
    symlinkSync(repoRoot, join(projectDir, 'node_modules', 'speckeeper'), 'dir');
    symlinkSync(join(repoRoot, 'node_modules', 'zod'), join(projectDir, 'node_modules', 'zod'), 'dir');

    execFileSync(process.execPath, [bundlePath, 'init'], { cwd: projectDir, stdio: 'pipe' });

    // The largest declared scale covers every case below.
    requirementCount = Math.max(scale('NFR-001-01', 'requirements'), scale('NFR-001-03', 'requirements'));
    const entityCount = scale('NFR-001-03', 'entities');
    const screenCount = scale('NFR-001-03', 'screens');
    fileCount = scale('NFR-001-02', 'files');

    const design = join(projectDir, 'design');
    writeFileSync(join(design, 'requirements.ts'), requirementSource(requirementCount));
    writeFileSync(join(design, 'entities.ts'), entitySource(entityCount));
    writeFileSync(join(design, 'screens.ts'), screenSource(screenCount));
    writeFileSync(
      join(design, 'index.ts'),
      [
        "import { mergeSpecs } from 'speckeeper';",
        "import requirements from './requirements.ts';",
        "import entities from './entities.ts';",
        "import screens from './screens.ts';",
        'export default mergeSpecs(requirements, entities, screens);',
        '',
      ].join('\n'),
    );

    // The scanned files carry annotations so check has real matching work to do.
    mkdirSync(join(projectDir, 'src'), { recursive: true });
    for (let i = 0; i < fileCount; i += 1) {
      writeFileSync(
        join(projectDir, 'src', `mod${i}.ts`),
        `/** @spec REQ-${String((i % requirementCount) + 1).padStart(4, '0')} */\nexport const v${i} = ${i};\n`,
      );
    }
    const configPath = join(projectDir, 'speckeeper.config.ts');
    writeFileSync(
      configPath,
      readFileSync(configPath, 'utf8').replace(
        '  specs: design.specs,',
        "  specs: design.specs,\n  sources: [{ type: 'annotation', paths: ['src/**/*.ts'] }],",
      ),
    );
  }, 600_000);

  it('processes the generated project rather than an empty one', () => {
    const { stdout } = timeCommand(projectDir, ['build']);
    const created = /Created:\s+(\d+)/.exec(stdout);
    const updated = /Updated:\s+(\d+)/.exec(stdout);
    const unchanged = /Unchanged:\s+(\d+)/.exec(stdout);
    const written =
      Number(created?.[1] ?? 0) + Number(updated?.[1] ?? 0) + Number(unchanged?.[1] ?? 0);

    // One document per spec, plus the aggregate index.
    expect(written).toBeGreaterThan(requirementCount);
  }, 300_000);

  it('NFR-001-01 runs lint, build and drift within the budget at the declared requirement scale', () => {
    const budget = budgetSeconds('NFR-001-01');

    for (const command of ['lint', 'build', 'drift']) {
      const { seconds } = timeCommand(projectDir, [command]);
      expect(seconds, `${command} took ${seconds.toFixed(2)}s`).toBeLessThan(budget);
    }
  }, 300_000);

  it('NFR-001-02 runs check within the budget at the declared file scale', () => {
    const budget = budgetSeconds('NFR-001-02');
    const { seconds } = timeCommand(projectDir, ['check', 'all']);

    expect(seconds, `check took ${seconds.toFixed(2)}s over ${fileCount} files`).toBeLessThan(budget);
  }, 300_000);

  it('NFR-001-03 builds within the budget from an empty output directory', () => {
    const budget = budgetSeconds('NFR-001-03');
    rmSync(join(projectDir, 'docs'), { recursive: true, force: true });
    rmSync(join(projectDir, 'specs'), { recursive: true, force: true });

    const { seconds } = timeCommand(projectDir, ['build']);

    expect(seconds, `a cold build took ${seconds.toFixed(2)}s`).toBeLessThan(budget);
  }, 300_000);
});
