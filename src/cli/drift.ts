/**
 * Drift Command
 * 
 * Detect drift between generated artifacts and SSOT
 */

import chalk from 'chalk';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { loadConfig } from '../utils/config-loader.js';
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
  verbose?: boolean;
  failOnDrift?: boolean;
}

export interface DriftResult {
  file: string;
  status: 'ok' | 'drifted' | 'missing';
  details?: string;
}

// ============================================================================
// Drift Command
// ============================================================================

export async function driftCommand(options: DriftCommandOptions): Promise<void> {
  console.log(chalk.blue('speckeeper drift'));
  console.log('');
  
  const cwd = process.cwd();
  const config = await loadConfig(options.config);
  
  console.log(chalk.gray(`  Design: ${config.designDir || 'design'}/`));
  console.log(chalk.gray(`  Docs:   ${config.docsDir}/`));
  console.log('');
  
  try {
    const models = (config.models ?? []) as BuildableModel[];
    const specs = config.specs;

    const roots: ExporterOutputRoots = {
      docs: join(cwd, config.docsDir),
      specs: join(cwd, config.specsDir),
    };

    const results: DriftResult[] = [];

    for (const file of planBuildOutputs(models, specs, roots).files) {
      if (!existsSync(file.path)) {
        results.push({ file: file.path, status: 'missing' });
        continue;
      }

      const actual = readFileSync(file.path, 'utf-8');
      const drifted = normalizeContent(file.content) !== normalizeContent(actual);
      results.push({ file: file.path, status: drifted ? 'drifted' : 'ok' });
    }

    outputDriftResults(results, options);
    
    const hasDrift = results.some(r => r.status === 'drifted' || r.status === 'missing');
    if (hasDrift && options.failOnDrift) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red('Drift check failed:'), error);
    process.exit(1);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeContent(content: string): string {
  return content.trim().replace(/\r\n/g, '\n');
}

function outputDriftResults(results: DriftResult[], _options: DriftCommandOptions): void {
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
  console.log(chalk.cyan('  → Regenerate the artifacts with "speckeeper build" and commit the result.'));
}
