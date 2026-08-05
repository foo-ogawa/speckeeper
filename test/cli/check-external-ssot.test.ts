/**
 * FR-605, FR-1017: `check external-ssot` runs the verification logic declared in design/_models/
 *
 * Everything the assertions compare against is derived from the design data and
 * the model classes themselves — no expected path, message or model list is
 * spelled out here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkCommand } from '../../src/cli/check.js';
import { getSpecsFromConfig, type Model } from '../../src/core/model.js';
import design from '../../design/index.ts';
import { allModels } from '../../design/_models/index.ts';
import { CLICommandModel, CLICommandSchema } from '../../design/_models/cli-command.ts';
import { TestRefModel } from '../../design/_models/test-ref.ts';
import type { CLICommand } from '../../design/_models/cli-command.ts';
import type { TestRef } from '../../design/_models/test-ref.ts';

const repoRoot = join(import.meta.dirname, '..', '..');

type AnyModel = Model<any>;

function specsOf(modelId: string): unknown[] {
  return getSpecsFromConfig(design.specs, modelId);
}

/**
 * Models that declare verification logic, discovered by asking each registered
 * model to resolve the external source path of its own specs.
 * `getExternalSourcePath` returns null exactly when no externalChecker is declared.
 */
function modelsDeclaringVerification(): AnyModel[] {
  return allModels.filter((model) => {
    const specs = specsOf(model.id);
    return specs.length > 0 && model.getExternalSourcePath(specs[0]) !== null;
  });
}

/** One reported issue, in the `[specId] message` shape the check command prints. */
function issuesFromDeclaredChecker(model: AnyModel): string[] {
  const issues: string[] = [];
  for (const spec of specsOf(model.id)) {
    const sourcePath = model.getExternalSourcePath(spec);
    if (sourcePath === null) continue;
    const fullPath = join(repoRoot, sourcePath);
    // The oracle is only valid while every declared source exists: the check
    // command reports its own "not found" error otherwise.
    expect(existsSync(fullPath), sourcePath).toBe(true);
    const result = model.check(spec, readFileSync(fullPath, 'utf-8'));
    for (const issue of [...result.errors, ...result.warnings]) {
      issues.push(`[${issue.specId}] ${issue.message}`);
    }
  }
  return issues;
}

describe('FR-605: verification logic lives in the _models/ definitions', () => {
  beforeEach(() => {
    // The declared checkers resolve their sources against the working directory.
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('FR-605-02 the registered models declare the verification logic themselves', () => {
    const declaring = modelsDeclaringVerification();

    expect(declaring.length).toBeGreaterThan(0);
    // Every declared checker resolves a source that exists and runs clean today.
    for (const model of declaring) {
      for (const spec of specsOf(model.id)) {
        const sourcePath = model.getExternalSourcePath(spec)!;
        expect(existsSync(join(repoRoot, sourcePath)), `${model.id}: ${sourcePath}`).toBe(true);
        const result = model.check(spec, readFileSync(join(repoRoot, sourcePath), 'utf-8'));
        expect(result.errors, `${model.id}: ${(spec as { id: string }).id}`).toEqual([]);
      }
    }
  });

  it('FR-605-02 the logic declared on the TestRef model decides the outcome', () => {
    const model = TestRefModel.instance;
    const [first] = specsOf('test-ref') as TestRef[];

    const broken = { ...first, source: { ...first.source, path: 'test/does-not-exist.test.ts' } };
    const result = model.check(broken, '');

    expect(result.success).toBe(false);
    expect(result.errors.map((e) => e.field)).toContain('source.path');
  });

  it('FR-605-02 the logic declared on the CLICommand model decides the outcome', () => {
    const model = CLICommandModel.instance;
    const [first] = specsOf('cli-command') as CLICommand[];

    const broken = { ...first, name: 'no-such-command' };
    const result = model.check(broken, '');

    expect(result.success).toBe(false);
    expect(result.errors.map((e) => e.message).join('\n')).toContain('no-such-command');
  });

  it('FR-605-03 check external-ssot reports exactly what the declared checkers report', async () => {
    const expected = modelsDeclaringVerification().flatMap(issuesFromDeclaredChecker).sort();
    expect(expected.length).toBeGreaterThan(0);

    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    await checkCommand('external-ssot', { config: join(repoRoot, 'speckeeper.config.ts') });

    const reported = logs
      .map((line) => line.trim())
      .filter((line) => line.startsWith('⚠') || line.startsWith('✗'))
      .map((line) => line.slice(1).trim())
      .sort();

    // Exact equality: nothing is reported that a model-declared checker did not produce.
    expect(reported).toEqual(expected);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe('FR-1017: source path comes from the checker config, else a hardcoded default', () => {
  beforeEach(() => {
    vi.spyOn(process, 'cwd').mockReturnValue(repoRoot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('FR-1017-01 uses the path each spec configures', () => {
    const model = TestRefModel.instance;
    const specs = specsOf('test-ref') as TestRef[];
    expect(specs.length).toBeGreaterThan(0);

    for (const spec of specs) {
      expect(model.getExternalSourcePath(spec)).toBe(spec.source.path);
    }
    // Different configs must yield different paths — a constant would pass the loop above.
    const resolved = new Set(specs.map((spec) => model.getExternalSourcePath(spec)));
    expect(resolved.size).toBe(new Set(specs.map((spec) => spec.source.path)).size);
    expect(resolved.size).toBeGreaterThan(1);
  });

  it('FR-1017-02 falls back to a hardcoded default when the spec configures no path', () => {
    const model = CLICommandModel.instance;
    const specs = specsOf('cli-command') as CLICommand[];
    expect(specs.length).toBeGreaterThan(0);

    // Premise: a CLICommand spec carries no source path to configure.
    const topLevelFields = Object.keys(CLICommandSchema.shape);
    expect(topLevelFields).not.toContain('source');
    expect(topLevelFields).not.toContain('sourcePath');

    const resolved = new Set(specs.map((spec) => model.getExternalSourcePath(spec)));
    expect(resolved.size).toBe(1);

    const [defaultPath] = [...resolved];
    expect(defaultPath).not.toBeNull();
    expect(existsSync(join(repoRoot, defaultPath!))).toBe(true);

    // The default is the source the check actually reads: a spec naming a command
    // the default source does not implement fails.
    expect(model.check({ ...specs[0], name: 'no-such-command' }, '').success).toBe(false);
  });
});
