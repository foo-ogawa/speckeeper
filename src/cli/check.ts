/**
 * Check Command
 * 
 * Check consistency with external SSOT using model class externalChecker
 */

import chalk from 'chalk';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { loadConfig } from '../utils/config-loader.js';
import { loadAllModels, type ModelRegistry } from '../utils/model-loader.js';
import { getAllModels, type CoverageResult } from '../core/model.js';
import { parse as parseYaml } from 'yaml';

// ============================================================================
// Types
// ============================================================================

export interface CheckCommandOptions {
  config?: string;
  type?: 'openapi' | 'ddl' | 'iac' | 'all';
  verbose?: boolean;
  coverage?: boolean;
}

export interface CheckIssue {
  severity: 'error' | 'warning';
  message: string;
  specId?: string;
  field?: string;
}

export interface CheckResult {
  type: string;
  success: boolean;
  issues: CheckIssue[];
}

// ============================================================================
// Check Command
// ============================================================================

export async function checkCommand(
  type: string | undefined,
  options: CheckCommandOptions
): Promise<void> {
  console.log(chalk.blue('speckeeper check'));
  console.log('');
  
  const cwd = process.cwd();
  const config = await loadConfig(options.config);
  const checkType = type || options.type || 'all';
  
  console.log(chalk.gray(`  Design: ${config.designDir || 'design'}/`));
  console.log(chalk.gray(`  Type:   ${checkType}`));
  console.log('');
  
  try {
    // Load all models
    console.log(chalk.blue('  Loading models...'));
    const { registry } = await loadAllModels(config, cwd);
    
    const results: CheckResult[] = [];
    const models = getAllModels();
    
    if (options.verbose) {
      console.log(chalk.gray(`  Registered models: ${models.map(m => m.id).join(', ')}`));
    }
    
    // Run checks for each model that has an external checker
    for (const model of models) {
      const specs = getSpecsFromRegistry(registry, model.id);
      if (specs.length === 0) continue;
      
      for (const spec of specs) {
        const sourcePath = model.getExternalSourcePath(spec);
        if (!sourcePath) continue;
        
        const fullPath = join(cwd, sourcePath);
        if (!existsSync(fullPath)) {
          results.push({
            type: model.id,
            success: false,
            issues: [{
              severity: 'error',
              message: `External source not found: ${sourcePath}`,
              specId: (spec as { id: string }).id,
            }],
          });
          continue;
        }
        
        // Load external data
        const externalData = loadExternalData(fullPath);
        
        // Run check
        const checkResult = model.check(spec, externalData);
        
        if (!checkResult.success || checkResult.errors.length > 0 || checkResult.warnings.length > 0) {
          results.push({
            type: model.id,
            success: checkResult.success,
            issues: [
              ...checkResult.errors.map(e => ({ severity: 'error' as const, message: e.message, specId: e.specId, field: e.field })),
              ...checkResult.warnings.map(w => ({ severity: 'warning' as const, message: w.message, specId: w.specId, field: w.field })),
            ],
          });
        }
      }
    }
    
    // Output results
    outputCheckResults(results);
    
    // Coverage check (if --coverage flag is set)
    if (options.coverage) {
      console.log('');
      console.log(chalk.blue('  Coverage checks...'));
      const coverageResults = runAllCoverageChecks(registry);
      
      if (coverageResults.length > 0) {
        outputAllCoverageResults(coverageResults);
        
        // Add uncovered items as warnings
        for (const check of coverageResults) {
          if (check.result.uncoveredItems.length > 0) {
            results.push({
              type: `coverage-${check.modelId}`,
              success: check.result.coveragePercent >= 80, // fail if below 80%
              issues: check.result.uncoveredItems.slice(0, 10).map(item => ({
                severity: 'warning' as const,
                message: `[${check.modelName}→${check.targetModel}] '${item.id}'${item.sourceId ? ` (${item.sourceId})` : ''} not covered`,
                specId: item.id,
              })),
            });
          }
        }
        
        // Summary
        console.log('');
        console.log(chalk.gray('  ─────────────────────────────────────'));
        const allPassed = coverageResults.every(c => c.result.coveragePercent >= 80);
        if (allPassed) {
          console.log(chalk.green('  ✓ All coverage checks passed (≥80%)'));
        } else {
          const failed = coverageResults.filter(c => c.result.coveragePercent < 80);
          console.log(chalk.yellow(`  ⚠ ${failed.length} coverage check(s) below 80%`));
        }
      } else {
        console.log(chalk.gray('  No coverage checker found'));
      }
    }
    
    // Exit with error code if there are errors
    const hasErrors = results.some(r => !r.success);
    if (hasErrors) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red('Check failed:'), error);
    process.exit(1);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getSpecsFromRegistry(registry: ModelRegistry, modelId: string): unknown[] {
  const registryMap: Record<string, keyof ModelRegistry> = {
    'requirement': 'requirements',
    'usecase': 'useCases',
    'actor': 'actors',
    'term': 'glossaryTerms',
    'entity': 'entities',
    'screen': 'screens',
    'process-flow': 'processFlows',
    'component': 'components',
    'api-ref': 'apiRefs',
    'table-ref': 'tableRefs',
    'test-ref': 'testRefs',
    'artifact': 'artifacts',
  };
  
  const key = registryMap[modelId];
  if (!key || !registry[key]) return [];
  
  return Array.from((registry[key] as Map<string, unknown>).values());
}

function loadExternalData(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf-8');
  
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    return parseYaml(content);
  }
  
  if (filePath.endsWith('.json')) {
    return JSON.parse(content);
  }
  
  return content;
}

function outputCheckResults(results: CheckResult[]): void {
  console.log('');
  
  if (results.length === 0) {
    console.log(chalk.green('  ✓ All checks passed'));
    return;
  }
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  for (const result of results) {
    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? '✗' : '⚠';
      const color = issue.severity === 'error' ? chalk.red : chalk.yellow;
      
      if (issue.severity === 'error') totalErrors++;
      else totalWarnings++;
      
      const prefix = issue.specId ? `[${issue.specId}] ` : '';
      console.log(color(`  ${icon} ${prefix}${issue.message}`));
    }
  }
  
  console.log('');
  console.log(chalk.gray(`  Summary: ${totalErrors} errors, ${totalWarnings} warnings`));
}

// ============================================================================
// Coverage Check
// ============================================================================

interface CoverageCheckResult {
  modelId: string;
  modelName: string;
  description: string;
  targetModel: string;
  result: CoverageResult;
}

/**
 * Execute all coverage checks
 * 
 * Detect all models with coverageChecker and run coverage checks.
 * Logic is defined in each model (design/_models/).
 */
function runAllCoverageChecks(registry: ModelRegistry): CoverageCheckResult[] {
  const models = getAllModels();
  const results: CoverageCheckResult[] = [];
  
  // Convert registry to Record format
  const registryRecord: Record<string, Map<string, unknown>> = {};
  for (const [key, value] of Object.entries(registry)) {
    if (value instanceof Map) {
      registryRecord[key] = value;
    }
  }
  
  // Search for models with coverageChecker and execute
  for (const model of models) {
    const checker = model.getCoverageChecker();
    if (checker) {
      const specs = getSpecsFromRegistry(registry, model.id);
      const result = model.checkCoverage(specs, registryRecord);
      
      if (result) {
        results.push({
          modelId: model.id,
          modelName: model.name,
          description: checker.description,
          targetModel: checker.targetModel,
          result,
        });
      }
    }
  }
  
  return results;
}

function outputAllCoverageResults(checks: CoverageCheckResult[]): void {
  for (const check of checks) {
    console.log('');
    console.log(chalk.blue(`  Coverage: ${check.modelName} → ${check.targetModel}`));
    console.log(chalk.gray(`  ${check.description}`));
    console.log(chalk.gray(`  ─────────────────────────────────────`));
    console.log(chalk.gray(`  Total:     ${check.result.total}`));
    console.log(chalk.green(`  Covered:   ${check.result.covered}`));
    console.log(chalk.yellow(`  Uncovered: ${check.result.uncovered}`));
    
    const color = check.result.coveragePercent >= 80 ? chalk.green : 
                  check.result.coveragePercent >= 50 ? chalk.yellow : chalk.red;
    console.log(color(`  Coverage:  ${check.result.coveragePercent}%`));
    
    if (check.result.uncoveredItems.length > 0 && check.result.uncoveredItems.length <= 10) {
      console.log('');
      console.log(chalk.yellow('  Uncovered items:'));
      for (const item of check.result.uncoveredItems) {
        const desc = item.description ? `: ${item.description.substring(0, 40)}` : '';
        const source = item.sourceId ? ` (${item.sourceId})` : '';
        console.log(chalk.yellow(`    - ${item.id}${source}${desc}`));
      }
    } else if (check.result.uncoveredItems.length > 10) {
      console.log('');
      console.log(chalk.yellow(`  (${check.result.uncoveredItems.length} uncovered items - showing first 5)`));
      for (const item of check.result.uncoveredItems.slice(0, 5)) {
        const desc = item.description ? `: ${item.description.substring(0, 40)}` : '';
        console.log(chalk.yellow(`    - ${item.id}${desc}`));
      }
    }
  }
}
