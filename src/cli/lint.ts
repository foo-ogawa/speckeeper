/**
 * Lint Command
 * 
 * Execute design consistency checks using model class lintRules
 */

import chalk from 'chalk';
import { loadConfig } from '../utils/config-loader.js';
import { getSpecsFromConfig, type SpecEntry } from '../core/model.js';
import { parsePhase, runDesignLint } from '../core/design-lint.js';
import type { Phase } from '../types/common.js';

// ============================================================================
// Types
// ============================================================================

export interface LintCommandOptions {
  config?: string;
  /** Phase the phase gate runs against; rejected when it is not a known phase */
  phase?: string;
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
  console.log(chalk.blue('speckeeper lint'));
  console.log('');
  
  const config = await loadConfig(options.config);

  console.log(chalk.gray(`  Design: ${config.designDir || 'design'}/`));

  let gatePhase: Phase | undefined;
  try {
    gatePhase = resolveGatePhase(options.phase, config.lint?.phaseGate?.currentPhase);
  } catch (error) {
    console.error(chalk.red('Lint failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }

  if (gatePhase) {
    console.log(chalk.gray(`  Phase:  ${gatePhase}`));
  }
  console.log('');

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const models = (config.models || []) as any[];
    const specs = config.specs;

    console.log(chalk.gray(`  Loaded: ${models.length} models`));
    console.log('');

    console.log(chalk.blue('  Running lint checks...'));
    const result = runModelLint(models, specs, { ...options, gatePhase });

    console.log('');
    outputLintResults(result, options);
    
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

/**
 * Phase the gate runs against: the command option wins over the project's
 * configured phase. An unknown name throws rather than running a gate that can
 * never match.
 */
function resolveGatePhase(optionPhase: string | undefined, configPhase: Phase | undefined): Phase | undefined {
  if (optionPhase !== undefined) return parsePhase(optionPhase, '--phase');
  if (configPhase !== undefined) return parsePhase(configPhase, 'lint.phaseGate.currentPhase');
  return undefined;
}

/** Options a lint run needs on top of the resolved gate phase */
type LintRunOptions = LintCommandOptions & { gatePhase?: Phase };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runModelLint(models: any[], specs: SpecEntry[] | undefined, options: LintRunOptions): LintResult {
  const issues: LintIssue[] = [];

  for (const model of models) {
    const modelSpecs = getSpecsFromConfig(specs, model.id);

    if (modelSpecs.length === 0) continue;

    const lintResults = model.lintAll(modelSpecs);

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

  for (const result of runDesignLint(specs, { phase: options.gatePhase })) {
    issues.push({
      rule: result.ruleId,
      severity: result.severity,
      message: result.message,
      specId: result.specId,
    });
  }

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const infos = issues.filter(i => i.severity === 'info').length;
  
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
