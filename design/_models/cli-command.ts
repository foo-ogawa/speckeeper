/**
 * CLI Command Model Definition
 * 
 * Models the CLI command interface specification for speckeeper itself.
 */
import { z } from 'zod';
import { Model, RelationSchema } from '../../src/core/model.ts';
import type { LintRule, Exporter, ExternalChecker, CheckResult, ModelLevel, Renderer, RenderContext } from '../../src/core/model.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

// ============================================================================
// Schema Definition
// ============================================================================

export const CommandParameterSchema = z.object({
  name: z.string(),
  kind: z.enum(['option', 'argument']),
  alias: z.string().optional(),
  type: z.enum(['string', 'number', 'boolean', 'path', 'enum', 'array']),
  description: z.string(),
  required: z.boolean().default(false),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  choices: z.array(z.string()).optional(),
  example: z.string().optional(),
});

export const SubCommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.array(CommandParameterSchema).default([]),
  examples: z.array(z.string()).default([]),
});

export const ExitCodeSchema = z.object({
  code: z.number(),
  description: z.string(),
});

export const CIStepSchema = z.object({
  enabled: z.boolean().default(false),
  order: z.number().optional(),
  description: z.string().optional(),
  subCommand: z.string().optional(),
});

/**
 * Test reference field - Test information corresponding to CLI commands
 */
export const CommandTestRefSchema = z.object({
  /** Test file path (glob pattern allowed) */
  path: z.string(),
  /** Test suite name pattern (regex) */
  testSuitePattern: z.string().optional(),
});

export const CLICommandSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  componentId: z.string().optional(),
  globalParameters: z.array(CommandParameterSchema).default([]),
  parameters: z.array(CommandParameterSchema).default([]),
  subCommands: z.array(SubCommandSchema).default([]),
  relatedRequirements: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([]),
  exitCodes: z.array(ExitCodeSchema).default([]),
  ciStep: CIStepSchema.optional(),
  /** Test reference information */
  testRef: CommandTestRefSchema.optional(),
  /** Inter-model relation */
  relations: z.array(RelationSchema).optional(),
});

// ============================================================================
// Type Export (for specification authors)
// ============================================================================

export type CommandParameter = z.infer<typeof CommandParameterSchema>;
export type SubCommand = z.infer<typeof SubCommandSchema>;
export type ExitCode = z.infer<typeof ExitCodeSchema>;
export type CIStep = z.infer<typeof CIStepSchema>;
export type CommandTestRef = z.infer<typeof CommandTestRefSchema>;
export type CLICommand = z.infer<typeof CLICommandSchema>;

// ============================================================================
// Helper Functions for CLI Implementation Check
// ============================================================================

interface CLICommandImpl {
  name: string;
  description: string;
  options: Array<{ flags: string; description: string }>;
  subCommands: Array<{ name: string; description: string }>;
}

function parseCommanderCLI(filePath: string): Map<string, CLICommandImpl> {
  const commands = new Map<string, CLICommandImpl>();
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    
    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'command') {
          const args = node.arguments;
          if (args.length > 0 && ts.isStringLiteral(args[0])) {
            const cmdName = args[0].text.split(' ')[0];
            commands.set(cmdName, {
              name: cmdName,
              description: '',
              options: [],
              subCommands: [],
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    
    visit(sourceFile);
  } catch {
    // Ignore file read errors
  }
  
  return commands;
}

function checkCLICommand(spec: CLICommand, implPath: string): CheckResult {
  const errors: CheckResult['errors'] = [];
  const warnings: CheckResult['warnings'] = [];
  
  const implementations = parseCommanderCLI(implPath);
  const impl = implementations.get(spec.name);
  
  if (!impl) {
    errors.push({
      message: `Command '${spec.name}' not found in implementation`,
      specId: spec.id,
      field: 'name',
    });
  }
  
  return { success: errors.length === 0, errors, warnings };
}

// ============================================================================
// Model Class (for CLI internal use)
// ============================================================================

class CLICommandModel extends Model<typeof CLICommandSchema> {
  readonly id = 'cli-command';
  readonly name = 'CLICommand';
  readonly idPrefix = 'CMD';
  readonly schema = CLICommandSchema;
  readonly description = 'Defines CLI command specifications';
  protected modelLevel: ModelLevel = 'L3';

  protected lintRules: LintRule<CLICommand>[] = [
    {
      id: 'cmd-has-description',
      severity: 'error',
      message: 'Command must have a description',
      check: (spec) => !spec.description || spec.description.length < 5,
    },
    {
      id: 'cmd-has-examples',
      severity: 'warning',
      message: 'Command should have usage examples',
      check: (spec) => spec.examples.length === 0,
    },
    {
      id: 'cmd-has-exit-codes',
      severity: 'info',
      message: 'Command should define exit codes',
      check: (spec) => spec.exitCodes.length === 0,
    },
  ];

  protected exporters: Exporter<CLICommand>[] = [
    {
      format: 'markdown',
      single: (spec) => {
        const lines: string[] = [];
        lines.push(`# ${spec.name}`);
        lines.push('');
        lines.push(`**ID**: ${spec.id}`);
        lines.push('');
        lines.push('## Overview');
        lines.push('');
        lines.push(spec.description);
        lines.push('');

        // Usage
        lines.push('## Usage');
        lines.push('');
        lines.push('```bash');
        if (spec.subCommands.length > 0) {
          lines.push(`speckeeper ${spec.name} <subcommand> [options]`);
        } else {
          lines.push(`speckeeper ${spec.name} [options]`);
        }
        lines.push('```');
        lines.push('');

        // Parameters
        if (spec.parameters.length > 0) {
          lines.push('## Parameters');
          lines.push('');
          lines.push('| Name | Kind | Type | Required | Default | Description |');
          lines.push('|------|------|------|----------|---------|-------------|');
          for (const p of spec.parameters) {
            const alias = p.alias ? `-${p.alias}, ` : '';
            const flag = p.kind === 'option' ? `${alias}--${p.name}` : `<${p.name}>`;
            const req = p.required ? '✓' : '';
            const def = p.default !== undefined ? String(p.default) : '-';
            lines.push(`| ${flag} | ${p.kind} | ${p.type} | ${req} | ${def} | ${p.description} |`);
          }
          lines.push('');
        }

        // Subcommands
        if (spec.subCommands.length > 0) {
          lines.push('## Subcommands');
          lines.push('');
          for (const sub of spec.subCommands) {
            lines.push(`### ${sub.name}`);
            lines.push('');
            lines.push(sub.description);
            lines.push('');
          }
        }

        // Examples
        if (spec.examples.length > 0) {
          lines.push('## Examples');
          lines.push('');
          lines.push('```bash');
          lines.push(spec.examples.join('\n'));
          lines.push('```');
          lines.push('');
        }

        // Exit codes
        if (spec.exitCodes.length > 0) {
          lines.push('## Exit Codes');
          lines.push('');
          lines.push('| Code | Description |');
          lines.push('|------|-------------|');
          for (const ec of spec.exitCodes) {
            lines.push(`| ${ec.code} | ${ec.description} |`);
          }
          lines.push('');
        }

        return lines.join('\n');
      },
      index: (specs) => {
        const lines: string[] = [];
        lines.push('# CLI Commands');
        lines.push('');
        lines.push('| Command | Description |');
        lines.push('|---------|-------------|');
        for (const spec of specs) {
          lines.push(`| [${spec.name}](./${spec.id}.md) | ${spec.description} |`);
        }
        return lines.join('\n');
      },
      outputDir: 'cli',
      filename: (spec) => spec.id,
    },
  ];

  protected externalChecker: ExternalChecker<CLICommand> = {
    targetType: 'typescript',
    sourcePath: () => 'src/cli/index.ts',
    check: (spec): CheckResult => {
      const cliIndexPath = join(process.cwd(), 'src/cli/index.ts');
      return checkCLICommand(spec, cliIndexPath);
    },
  };

  override lintAll(specs: CLICommand[]): import('../../src/core/model.ts').LintResult[] {
    const results = super.lintAll(specs);
    const cliIndexPath = join(process.cwd(), 'src/cli/index.ts');
    const implementations = parseCommanderCLI(cliIndexPath);
    for (const [cmdName] of implementations) {
      const hasSpec = specs.some(s => s.name === cmdName);
      if (!hasSpec) {
        results.push({
          ruleId: 'cmd-impl-without-spec',
          severity: 'error',
          message: `Command '${cmdName}' exists in implementation but has no spec definition`,
        });
      }
    }
    return results;
  }

  protected renderers: Renderer<CLICommand>[] = [
    {
      format: 'table',
      render: (specs, ctx) => renderCommandTable(specs, ctx),
    },
    {
      format: 'list',
      render: (specs, _ctx) => renderCommandList(specs),
    },
    {
      format: 'ci-list',
      render: (specs, _ctx) => renderCIList(specs),
    },
    {
      format: 'ci-table',
      render: (specs, ctx) => renderCITable(specs, ctx),
    },
  ];
}

// Singleton instance
export { CLICommandModel };

// ============================================================================
// Rendering Helper Functions
// ============================================================================

/**
 * Command table format
 */
function renderCommandTable(commands: CLICommand[], ctx: RenderContext): string {
  const headers = ['Command', 'Description'];
  const rows = commands.map(cmd => [
    `\`${cmd.name}\``,
    cmd.description,
  ]);
  return ctx.markdown.table(headers, rows);
}

/**
 * Command list format
 */
function renderCommandList(commands: CLICommand[]): string {
  const lines = commands.map(cmd => `- \`${cmd.name}\`: ${cmd.description}`);
  return lines.join('\n');
}

/**
 * CI step list format
 */
function renderCIList(commands: CLICommand[]): string {
  const ciCommands = commands
    .filter(cmd => cmd.ciStep?.enabled)
    .sort((a, b) => (a.ciStep?.order ?? 99) - (b.ciStep?.order ?? 99));
  
  const lines = [
    '- Execute the following in GitHub Actions (or equivalent)',
  ];
  
  for (const cmd of ciCommands) {
    const stepName = cmd.ciStep?.subCommand 
      ? `${cmd.name} ${cmd.ciStep.subCommand}`
      : cmd.name;
    lines.push(`  - \`${stepName}\` (${cmd.ciStep?.description || cmd.description})`);
  }
  
  // Add contract-check
  lines.push(`  - \`check contract\` (Contract consistency, can be omitted when using external SSOT)`);
  
  return lines.join('\n');
}

/**
 * CI step table format
 */
function renderCITable(commands: CLICommand[], ctx: RenderContext): string {
  const ciCommands = commands
    .filter(cmd => cmd.ciStep?.enabled)
    .sort((a, b) => (a.ciStep?.order ?? 99) - (b.ciStep?.order ?? 99));
  
  const headers = ['Order', 'Command', 'Description'];
  const rows = ciCommands.map(cmd => {
    const stepName = cmd.ciStep?.subCommand 
      ? `${cmd.name} ${cmd.ciStep.subCommand}`
      : cmd.name;
    return [
      String(cmd.ciStep?.order || '-'),
      `\`${stepName}\``,
      cmd.ciStep?.description || cmd.description,
    ];
  });
  
  // Add contract-check
  rows.push([
    '5',
    '`check contract`',
    'Contract consistency, can be omitted when using external SSOT',
  ]);
  
  return ctx.markdown.table(headers, rows);
}
