/**
 * Drift Command
 * 
 * Detect drift between generated artifacts and SSOT
 */

import chalk from 'chalk';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { loadConfig } from '../utils/config-loader.js';
import { loadAllModels, getSpecsFromRegistry } from '../utils/model-loader.js';
import { getAllModels } from '../core/model.js';

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
  // Output paths available via getOutputPaths if needed
  
  console.log(chalk.gray(`  Design: ${config.designDir || 'design'}/`));
  console.log(chalk.gray(`  Docs:   ${config.docsDir}/`));
  console.log('');
  
  try {
    // Load all models
    console.log(chalk.blue('  Loading models...'));
    const { registry } = await loadAllModels(config, cwd);
    
    const results: DriftResult[] = [];
    const models = getAllModels();
    
    // Check each model's generated files
    for (const model of models) {
      const specs = getSpecsFromRegistry(registry, model.id);
      if (specs.length === 0) continue;
      
      for (const exporter of model.getExporters()) {
        if (exporter.format !== 'markdown') continue;
        
        const outputDir = exporter.outputDir 
          ? join(cwd, config.docsDir, exporter.outputDir)
          : join(cwd, config.docsDir);
        
        // Check individual files
        if (exporter.single) {
          for (const spec of specs) {
            const filename = model.getFilename(spec, 'markdown') || (spec as { id: string }).id;
            const filePath = join(outputDir, `${filename}.md`);
            
            if (!existsSync(filePath)) {
              results.push({ file: filePath, status: 'missing' });
              continue;
            }
            
            const expected = exporter.single(spec);
            const actual = readFileSync(filePath, 'utf-8');
            
            if (normalizeContent(expected) !== normalizeContent(actual)) {
              results.push({ file: filePath, status: 'drifted' });
            } else {
              results.push({ file: filePath, status: 'ok' });
            }
          }
        }
        
        // Check index file
        if (exporter.index) {
          const indexPath = join(outputDir, 'index.md');
          
          if (!existsSync(indexPath)) {
            results.push({ file: indexPath, status: 'missing' });
          } else {
            const expected = exporter.index(specs);
            const actual = readFileSync(indexPath, 'utf-8');
            
            if (normalizeContent(expected) !== normalizeContent(actual)) {
              results.push({ file: indexPath, status: 'drifted' });
            } else {
              results.push({ file: indexPath, status: 'ok' });
            }
          }
        }
      }
    }
    
    // Output results
    outputDriftResults(results, options);
    
    // Exit with error code if drift detected and failOnDrift is set
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
}
