/**
 * Lint Command
 * 
 * Execute design consistency checks using model class lintRules
 */

import chalk from 'chalk';
import { relative } from 'node:path';
import { loadConfig } from '../utils/config-loader.js';
import { loadAllModels, type ModelRegistry } from '../utils/model-loader.js';
import { getAllModels } from '../core/model.js';

// ============================================================================
// Types
// ============================================================================

export interface LintCommandOptions {
  config?: string;
  phase?: 'REQ' | 'HLD' | 'LLD' | 'OPS';
  strict?: boolean;
  fix?: boolean;
  format?: 'text' | 'json' | 'github';
}

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintIssue {
  rule: string;
  severity: LintSeverity;
  message: string;
  specId?: string;
  modelType?: string;
}

export interface LintResult {
  issues: LintIssue[];
  errors: number;
  warnings: number;
  infos: number;
}

// ============================================================================
// Lint Command
// ============================================================================

export async function lintCommand(options: LintCommandOptions): Promise<void> {
  console.log(chalk.blue('spects lint'));
  console.log('');
  
  const cwd = process.cwd();
  const config = await loadConfig(options.config);
  
  console.log(chalk.gray(`  Design: ${config.designDir || 'design'}/`));
  if (options.phase) {
    console.log(chalk.gray(`  Phase:  ${options.phase}`));
  }
  console.log('');
  
  try {
    // Load all models from design/
    console.log(chalk.blue('  Loading models...'));
    const { registry, loadedFiles, errors: loadErrors } = await loadAllModels(config, cwd);
    
    if (loadErrors.length > 0) {
      console.log(chalk.yellow(`  ⚠ ${loadErrors.length} file(s) failed to load`));
      for (const { file, error } of loadErrors) {
        console.log(chalk.yellow(`    - ${relative(cwd, file)}: ${error}`));
      }
    }
    
    console.log(chalk.gray(`  Loaded: ${loadedFiles.length} files`));
    console.log('');
    
    // Run lint using model classes
    console.log(chalk.blue('  Running lint checks...'));
    const result = runModelLint(registry, options);
    
    // Output results
    console.log('');
    outputLintResults(result, options);
    
    // Exit with error code if there are errors
    if (result.errors > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red('Lint failed:'), error);
    process.exit(1);
  }
}

// ============================================================================
// Lint Runner
// ============================================================================

function runModelLint(registry: ModelRegistry, options: LintCommandOptions): LintResult {
  const issues: LintIssue[] = [];
  const models = getAllModels();
  
  for (const model of models) {
    // Get specs from registry for this model type
    const specs = getSpecsFromRegistry(registry, model.id);
    
    if (specs.length === 0) continue;
    
    // Run lint rules
    const lintResults = model.lintAll(specs);
    
    for (const result of lintResults) {
      issues.push({
        rule: result.ruleId,
        severity: result.severity,
        message: result.message,
        specId: result.specId,
        modelType: model.name,
      });
    }
  }
  
  // Count by severity
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const infos = issues.filter(i => i.severity === 'info').length;
  
  // Filter by strict mode
  if (!options.strict) {
    return {
      issues: issues.filter(i => i.severity !== 'info'),
      errors,
      warnings,
      infos,
    };
  }
  
  return { issues, errors, warnings, infos };
}

function getSpecsFromRegistry(registry: ModelRegistry, modelId: string): unknown[] {
  // Map model IDs to registry keys
  const registryMap: Record<string, keyof ModelRegistry> = {
    'requirement': 'requirements',
    'usecase': 'useCases',
    'actor': 'actors',
    'term': 'glossaryTerms',
    'entity': 'entities',
    'screen': 'screens',
    'process-flow': 'processFlows',
    'component': 'components',
    'boundary': 'boundaries',
    'layer': 'layers',
    'relation': 'relations',
  };
  
  const key = registryMap[modelId];
  if (!key || !registry[key]) return [];
  
  return Array.from((registry[key] as Map<string, unknown>).values());
}

// ============================================================================
// Output
// ============================================================================

function outputLintResults(result: LintResult, options: LintCommandOptions): void {
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  if (options.format === 'github') {
    for (const issue of result.issues) {
      const level = issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'notice';
      console.log(`::${level}::${issue.message} [${issue.rule}]${issue.specId ? ` (${issue.specId})` : ''}`);
    }
    return;
  }
  
  // Default text format
  if (result.issues.length === 0) {
    console.log(chalk.green('  ✓ No issues found'));
    return;
  }
  
  for (const issue of result.issues) {
    const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
    const color = issue.severity === 'error' ? chalk.red : issue.severity === 'warning' ? chalk.yellow : chalk.blue;
    
    const prefix = issue.specId ? `[${issue.specId}] ` : '';
    console.log(color(`  ${icon} ${prefix}${issue.message}`));
    console.log(chalk.gray(`    Rule: ${issue.rule}`));
  }
  
  console.log('');
  console.log(chalk.gray(`  Summary: ${result.errors} errors, ${result.warnings} warnings, ${result.infos} infos`));
}
