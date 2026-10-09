/**
 * Drift Command
 * 
 * Detect drift between generated artifacts and SSOT
 */

import chalk from 'chalk';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { loadConfig } from '../utils/config-loader.js';
import { batchWriteFiles } from '../utils/file-writer.js';
import {
  planBuildOutputs,
  type BuildableModel,
  type ExporterOutputRoots,
} from '../core/model.js';

// ============================================================================
// Types
// ============================================================================

export interface DriftCommandOptions {
  config?: string;
  /** Rewrite drifted and missing files with their generated content */
  update?: boolean;
  format?: 'text' | 'json' | 'diff';
  failOnDrift?: boolean;
}

export interface DriftResult {
  file: string;
  status: 'ok' | 'drifted' | 'missing';
}

/** A checked file together with the two contents it was compared on */
interface DriftComparison extends DriftResult {
  expected: string;
  /** Content on disk; null when the file is missing */
  actual: string | null;
}

// ============================================================================
// Drift Command
// ============================================================================

export async function driftCommand(options: DriftCommandOptions): Promise<void> {
  console.error(chalk.blue('speckeeper drift'));
  console.error('');
  
  const cwd = process.cwd();
  const config = await loadConfig(options.config);
  
  console.error(chalk.gray(`  Design: ${config.designDir || 'design'}/`));
  console.error(chalk.gray(`  Docs:   ${config.docsDir}/`));
  console.error('');
  
  try {
    const models = (config.models ?? []) as BuildableModel[];
    const specs = config.specs;

    const roots: ExporterOutputRoots = {
      docs: join(cwd, config.docsDir),
      specs: join(cwd, config.specsDir),
    };

    const results: DriftComparison[] = [];

    for (const file of planBuildOutputs(models, specs, roots).files) {
      if (!existsSync(file.path)) {
        results.push({ file: file.path, status: 'missing', expected: file.content, actual: null });
        continue;
      }

      const actual = readFileSync(file.path, 'utf-8');
      const drifted = normalizeContent(file.content) !== normalizeContent(actual);
      results.push({ file: file.path, status: drifted ? 'drifted' : 'ok', expected: file.content, actual });
    }

    const stale = results.filter(r => r.status !== 'ok');
    if (options.update && stale.length > 0) {
      batchWriteFiles(stale.map(r => ({ path: r.file, content: r.expected })));
    }

    outputDriftResults(results, options);
    
    const hasDrift = stale.length > 0;
    if (hasDrift && options.failOnDrift) {
      process.exitCode = 1;
    }
    
  } catch (error) {
    console.error(chalk.red('Drift check failed:'), error);
    process.exitCode = 1;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeContent(content: string): string {
  return content.trim().replace(/\r\n/g, '\n');
}

function outputDriftResults(results: DriftComparison[], options: DriftCommandOptions): void {
  if (options.format === 'json') {
    const summary = {
      ok: results.filter(r => r.status === 'ok').length,
      drifted: results.filter(r => r.status === 'drifted').length,
      missing: results.filter(r => r.status === 'missing').length,
      updated: options.update ? results.filter(r => r.status !== 'ok').length : 0,
    };
    console.log(JSON.stringify({ results: results.map(({ file, status }) => ({ file, status })), summary }, null, 2));
    return;
  }

  if (options.format === 'diff') {
    for (const result of results) {
      if (result.status === 'ok') continue;
      console.log(`--- ${result.file} (on disk)`);
      console.log(`+++ ${result.file} (generated)`);
      for (const line of diffLines(result.actual ?? '', result.expected)) {
        console.log(line);
      }
    }
    return;
  }

  console.log('');
  
  const ok = results.filter(r => r.status === 'ok');
  const drifted = results.filter(r => r.status === 'drifted');
  const missing = results.filter(r => r.status === 'missing');
  
  if (drifted.length === 0 && missing.length === 0) {
    console.log(chalk.green('  ✓ No drift detected'));
    console.log(chalk.gray(`    Checked: ${results.length} files`));
    return;
  }
  
  if (drifted.length > 0) {
    console.log(chalk.yellow(`  ⚠ ${drifted.length} file(s) have drifted:`));
    for (const result of drifted) {
      console.log(chalk.yellow(`    - ${result.file}`));
    }
  }
  
  if (missing.length > 0) {
    console.log(chalk.red(`  ✗ ${missing.length} file(s) are missing:`));
    for (const result of missing) {
      console.log(chalk.red(`    - ${result.file}`));
    }
  }
  
  console.log('');
  console.log(chalk.gray(`  Summary: ${ok.length} ok, ${drifted.length} drifted, ${missing.length} missing`));
  if (options.update) {
    console.log(chalk.cyan(`  → Rewrote ${drifted.length + missing.length} file(s) with their generated content; commit the result.`));
  } else {
    console.log(chalk.cyan('  → Regenerate the artifacts with "speckeeper build" and commit the result.'));
  }
}

/**
 * Line diff from `before` to `after` over their longest common subsequence:
 * each line is prefixed with ' ' (kept), '-' (only in before) or '+' (only in after).
 */
function diffLines(before: string, after: string): string[] {
  const a = before === '' ? [] : normalizeContent(before).split('\n');
  const b = normalizeContent(after).split('\n');

  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..]
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const lines: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push(` ${a[i]}`);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push(`-${a[i++]}`);
    } else {
      lines.push(`+${b[j++]}`);
    }
  }
  while (i < a.length) lines.push(`-${a[i++]}`);
  while (j < b.length) lines.push(`+${b[j++]}`);
  return lines;
}
