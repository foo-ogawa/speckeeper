/**
 * Check Command
 *
 * Global scan across configured sources, then optional deep validation per model.
 */

import chalk from 'chalk';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { loadConfig } from '../utils/config-loader.js';
import { getSpecsFromConfig, buildRegistryFromConfig, type SpecEntry, type CoverageResult } from '../core/model.js';
import { runGlobalScan, runDeepValidation, type LookupKeyMap } from '../core/global-scanner.js';
import type { SourceConfig } from '../core/config-api.js';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const models = (config.models || []) as any[];
    const specs = config.specs;
    const sources: SourceConfig[] = config.sources ?? [];

    if (options.verbose) {
      console.log(chalk.gray(`  Registered models: ${models.map((m: { id: string }) => m.id).join(', ')}`));
      console.log(chalk.gray(`  Sources: ${sources.length} configured`));
    }

    const results: CheckResult[] = [];
    const transitiveRelations = config.coverage?.transitiveRelations ?? [];
    let transitiveCoverageData: TransitiveCoverageResult | undefined;

    // Collect all spec IDs and build lookup key map
    const allSpecIds: string[] = [];
    const specIdToModel = new Map<string, { modelId: string; spec: unknown }>();
    const lookupKeyMap: LookupKeyMap = new Map();
    for (const model of models) {
      const modelSpecs = getSpecsFromConfig(specs, model.id);
      const modelLookupKeys = model.getLookupKeys?.();
      for (const spec of modelSpecs) {
        const specId = (spec as { id: string }).id;
        allSpecIds.push(specId);
        specIdToModel.set(specId, { modelId: model.id, spec });

        if (modelLookupKeys) {
          const overrides: Record<string, string> = {};
          for (const [sourceType, mapper] of Object.entries(modelLookupKeys)) {
            if (typeof mapper === 'function') {
              overrides[sourceType] = mapper(spec);
            }
          }
          if (Object.keys(overrides).length > 0) {
            lookupKeyMap.set(specId, overrides);
          }
        }
      }
    }

    if (sources.length > 0 && allSpecIds.length > 0) {
      // Filter sources by checkType
      const filteredSources = checkType === 'all'
        ? sources
        : sources.filter(s => s.type === checkType);

      // Run global scan (with lookup key overrides)
      const { matches, warnings: scanWarnings } = runGlobalScan(
        filteredSources, allSpecIds, cwd,
        lookupKeyMap.size > 0 ? lookupKeyMap : undefined,
      );

      for (const sw of scanWarnings) {
        results.push({
          type: sw.sourceType,
          success: true,
          issues: [{
            severity: 'warning',
            message: sw.message,
          }],
        });
      }

      // For each spec, check matches + deep validation
      for (const [specId, entry] of specIdToModel) {
        const specMatches = matches.get(specId);

        // Run deep validation if model has rules and there are matches
        if (specMatches && specMatches.length > 0) {
          const model = models.find((m: { id: string }) => m.id === entry.modelId);
          const deepValidation = model?.getDeepValidation?.();
          if (deepValidation) {
            const deepResult = runDeepValidation(specId, specMatches, deepValidation, entry.spec);
            if (deepResult.errors.length > 0 || deepResult.warnings.length > 0) {
              results.push({
                type: entry.modelId,
                success: deepResult.success,
                issues: [
                  ...deepResult.errors.map((e: { message: string; specId?: string; field?: string }) => ({
                    severity: 'error' as const, message: e.message, specId: e.specId, field: e.field,
                  })),
                  ...deepResult.warnings.map((w: { message: string; specId?: string; field?: string }) => ({
                    severity: 'warning' as const, message: w.message, specId: w.specId, field: w.field,
                  })),
                ],
              });
            }
          }
        }
      }

      // Compute transitive coverage if configured
      const directlyCovered = new Set(matches.keys());
      let coveredSet = directlyCovered;

      if (transitiveRelations.length > 0) {
        const allSpecsWithRelations = allSpecIds.map(id => {
          const entry = specIdToModel.get(id);
          const spec = entry?.spec as { id: string; relations?: Array<{ type: string; target: string }> } | undefined;
          return { id, relations: spec?.relations };
        });
        transitiveCoverageData = computeTransitiveCoverage(directlyCovered, allSpecsWithRelations, transitiveRelations);
        coveredSet = transitiveCoverageData.coveredSet;
      }

      // Report unmatched specs (excluding transitively covered)
      if (options.verbose) {
        for (const specId of allSpecIds) {
          if (!coveredSet.has(specId)) {
            const entry = specIdToModel.get(specId);
            results.push({
              type: entry?.modelId ?? 'unknown',
              success: true,
              issues: [{
                severity: 'warning',
                message: `Spec ID "${specId}" not found in any configured source`,
                specId,
              }],
            });
          }
        }
      }
    }

    // Run per-model externalChecker for models that still define one (legacy support)
    runLegacyChecks(models, specs, cwd, results);

    outputCheckResults(results);

    if (options.coverage) {
      console.log('');
      console.log(chalk.blue('  Coverage checks...'));
      const coverageResults = runAllCoverageChecks(models, specs);

      if (coverageResults.length > 0) {
        outputAllCoverageResults(coverageResults);

        for (const check of coverageResults) {
          if (check.result.uncoveredItems.length > 0) {
            results.push({
              type: `coverage-${check.modelId}`,
              success: check.result.coveragePercent >= 80,
              issues: check.result.uncoveredItems.slice(0, 10).map(item => ({
                severity: 'warning' as const,
                message: `[${check.modelName}→${check.targetModel}] '${item.id}'${item.sourceId ? ` (${item.sourceId})` : ''} not covered`,
                specId: item.id,
              })),
            });
          }
        }
      }

      // Transitive coverage report
      if (transitiveCoverageData && transitiveRelations.length > 0) {
        const total = allSpecIds.length;
        const directCount = transitiveCoverageData.directCount;
        const transitiveCount = transitiveCoverageData.transitiveCount;
        const covered = directCount + transitiveCount;
        const uncovered = total - covered;
        const coveragePercent = total > 0 ? Math.round((covered / total) * 100) : 100;

        console.log('');
        console.log(chalk.blue(`  Transitive coverage (via ${transitiveRelations.join(', ')})`));
        console.log(chalk.gray(`  ─────────────────────────────────────`));
        console.log(chalk.gray(`  Total:     ${total}`));
        console.log(chalk.green(`  Covered:   ${covered}  (${directCount} direct + ${transitiveCount} transitive)`));
        console.log(chalk.yellow(`  Uncovered: ${uncovered}`));
        const color = coveragePercent >= 80 ? chalk.green :
                      coveragePercent >= 50 ? chalk.yellow : chalk.red;
        console.log(color(`  Coverage:  ${coveragePercent}%`));

        if (uncovered > 0) {
          const uncoveredIds = allSpecIds.filter(id => !transitiveCoverageData!.coveredSet.has(id));
          const display = uncoveredIds.slice(0, 10);
          console.log('');
          console.log(chalk.yellow('  Uncovered items:'));
          for (const id of display) {
            const entry = specIdToModel.get(id);
            console.log(chalk.yellow(`    - ${id} (${entry?.modelId ?? 'unknown'})`));
          }
          if (uncoveredIds.length > 10) {
            console.log(chalk.yellow(`    ... and ${uncoveredIds.length - 10} more`));
          }
        }
      }

      console.log('');
      console.log(chalk.gray('  ─────────────────────────────────────'));
      const allCoverageResults = [...coverageResults];
      const allPassed = allCoverageResults.every(c => c.result.coveragePercent >= 80);
      if (coverageResults.length === 0 && !transitiveCoverageData) {
        console.log(chalk.gray('  No coverage checker found'));
      } else if (allPassed) {
        console.log(chalk.green('  ✓ All coverage checks passed (≥80%)'));
      } else {
        const failed = allCoverageResults.filter(c => c.result.coveragePercent < 80);
        console.log(chalk.yellow(`  ⚠ ${failed.length} coverage check(s) below 80%`));
      }
    }

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
// Transitive Coverage
// ============================================================================

export interface TransitiveCoverageResult {
  coveredSet: Set<string>;
  directCount: number;
  transitiveCount: number;
}

/**
 * Compute transitive coverage via fixed-point iteration.
 * A spec is transitively covered if ALL specs that relate to it
 * (via a transitive relation type) are themselves covered.
 */
export function computeTransitiveCoverage(
  directlyCovered: Set<string>,
  allSpecs: Array<{ id: string; relations?: Array<{ type: string; target: string }> }>,
  transitiveRelations: string[],
): TransitiveCoverageResult {
  if (transitiveRelations.length === 0) {
    return { coveredSet: new Set(directlyCovered), directCount: directlyCovered.size, transitiveCount: 0 };
  }

  // Build reverse relation map: targetId -> sourceIds[]
  const reverseRelations = new Map<string, string[]>();
  for (const spec of allSpecs) {
    if (!spec.relations) continue;
    for (const rel of spec.relations) {
      if (!transitiveRelations.includes(rel.type)) continue;
      const existing = reverseRelations.get(rel.target) ?? [];
      existing.push(spec.id);
      reverseRelations.set(rel.target, existing);
    }
  }

  const coveredSet = new Set(directlyCovered);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [targetId, sourceIds] of reverseRelations) {
      if (coveredSet.has(targetId)) continue;
      if (sourceIds.length > 0 && sourceIds.every(id => coveredSet.has(id))) {
        coveredSet.add(targetId);
        changed = true;
      }
    }
  }

  return {
    coveredSet,
    directCount: directlyCovered.size,
    transitiveCount: coveredSet.size - directlyCovered.size,
  };
}

// ============================================================================
// Legacy per-model checker (used when sources not configured)
// ============================================================================

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runLegacyChecks(models: any[], specs: SpecEntry[] | undefined, cwd: string, results: CheckResult[]): void {
  for (const model of models) {
    const modelSpecs = getSpecsFromConfig(specs, model.id);
    if (modelSpecs.length === 0) continue;

    for (const spec of modelSpecs) {
      const sourcePath = model.getExternalSourcePath?.(spec);
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

      const externalData = loadExternalData(fullPath);
      const checkResult = model.check(spec, externalData);

      if (!checkResult.success || checkResult.errors.length > 0 || checkResult.warnings.length > 0) {
        results.push({
          type: model.id,
          success: checkResult.success,
          issues: [
            ...checkResult.errors.map((e: { message: string; specId?: string; field?: string }) => ({ severity: 'error' as const, message: e.message, specId: e.specId, field: e.field })),
            ...checkResult.warnings.map((w: { message: string; specId?: string; field?: string }) => ({ severity: 'warning' as const, message: w.message, specId: w.specId, field: w.field })),
          ],
        });
      }
    }
  }
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runAllCoverageChecks(models: any[], specs: SpecEntry[] | undefined): CoverageCheckResult[] {
  const results: CoverageCheckResult[] = [];
  const registry = buildRegistryFromConfig(specs);
  
  for (const model of models) {
    const checker = model.getCoverageChecker();
    if (checker) {
      const modelSpecs = getSpecsFromConfig(specs, model.id);
      const result = model.checkCoverage(modelSpecs, registry);
      
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
