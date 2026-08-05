/**
 * CLI config loading
 *
 * Runs the published bin against a project whose package.json carries no "type"
 * field, the layout in which Node classifies a TypeScript config as CommonJS.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const bundlePath = join(repoRoot, 'dist', 'speckeeper.bundle.mjs');

describe('FR-104, NFR-004, NFR-005, NFR-009: speckeeper CLI config loading', () => {
  let projectDir: string;

  const runLint = (env: Record<string, string> = {}): SpawnSyncReturns<string> =>
    spawnSync(process.execPath, [bundlePath, 'lint'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, ...env },
    });

  const writeConfig = (filename: string, content: string): void => {
    for (const entry of readdirSync(projectDir)) {
      if (entry.startsWith('speckeeper.config.')) unlinkSync(join(projectDir, entry));
    }
    writeFileSync(join(projectDir, filename), content);
  };

  beforeAll(() => {
    // The package entry has to exist for a config to import defineConfig from
    // it. tsup cleans dist/, so it runs before the bundle.
    if (!existsSync(join(repoRoot, 'dist', 'index.js'))) {
      execSync('npm run build', { cwd: repoRoot, stdio: 'pipe' });
    }
    // Rebuilt from the current sources so these assertions cannot pass against
    // a stale bundle.
    execSync('node esbuild.bundle.mjs', { cwd: repoRoot, stdio: 'pipe' });

    projectDir = mkdtempSync(join(tmpdir(), 'speckeeper-config-'));
    writeFileSync(
      join(projectDir, 'package.json'),
      JSON.stringify({ name: 'config-load-test', version: '1.0.0', private: true }),
    );
    mkdirSync(join(projectDir, 'node_modules'), { recursive: true });
    symlinkSync(repoRoot, join(projectDir, 'node_modules', 'speckeeper'), 'dir');
    // The scaffolded design modules declare their schemas with zod, which init
    // tells the user to install alongside speckeeper.
    symlinkSync(
      join(repoRoot, 'node_modules', 'zod'),
      join(projectDir, 'node_modules', 'zod'),
      'dir',
    );
  }, 300_000);

  afterAll(() => {
    if (projectDir) rmSync(projectDir, { recursive: true, force: true });
  });

  it('succeeds when no config file exists', () => {
    for (const entry of readdirSync(projectDir)) {
      if (entry.startsWith('speckeeper.config.')) unlinkSync(join(projectDir, entry));
    }

    const result = runLint();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No issues found');
  }, 90_000);

  it('fails without a success line when the config has a syntax error', () => {
    writeConfig('speckeeper.config.ts', 'export default { designDir:\n');

    const result = runLint();

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('No issues found');
    expect(result.stdout).not.toContain('✓');
    expect(result.stderr).toContain('Failed to load config');
  }, 90_000);

  it('fails on a broken config regardless of the unhandled-rejection mode', () => {
    writeConfig('speckeeper.config.ts', 'export default { designDir:\n');

    const result = runLint({ NODE_OPTIONS: '--unhandled-rejections=warn' });

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('No issues found');
  }, 90_000);

  it('fails when the config imports a module that does not resolve', () => {
    writeConfig(
      'speckeeper.config.ts',
      "import { missing } from './nope.js';\nexport default { designDir: missing };\n",
    );

    const result = runLint();

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('No issues found');
    expect(result.stderr).toContain('Failed to load config');
  }, 90_000);

  it('fails when the config yields no object', () => {
    writeConfig('speckeeper.config.yaml', '# nothing here\n');

    const result = runLint();

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('No issues found');
    expect(result.stderr).toContain('must export an object');
  }, 90_000);

  it('applies a config written with defineConfig imported from the package entry', () => {
    writeConfig(
      'speckeeper.config.ts',
      "import { defineConfig } from 'speckeeper';\n" +
        "export default defineConfig({ projectName: 'config-load-test', designDir: 'custom-design' });\n",
    );

    const result = runLint();

    expect(result.stderr).not.toContain('Failed to load config');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('custom-design/');
  }, 90_000);

  it('loads the project scaffolded by init, whose config imports the design modules', () => {
    for (const entry of readdirSync(projectDir)) {
      if (entry.startsWith('speckeeper.config.')) unlinkSync(join(projectDir, entry));
    }

    const init = spawnSync(process.execPath, [bundlePath, 'init'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(init.status).toBe(0);

    const result = runLint();

    expect(result.stderr).not.toContain('Failed to load config');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Loaded:');
  }, 120_000);
});
