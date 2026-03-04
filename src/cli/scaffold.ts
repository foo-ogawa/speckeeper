/**
 * Scaffold Command
 *
 * Generate _models/ from a mermaid flowchart definition.
 * Checker logic is integrated into model definitions via core DSL factories.
 */
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { parseMarkdownFlowchart } from '../scaffold/mermaid-parser.js';
import { resolveEdges } from '../scaffold/edge-vocabulary.js';
import { generateAllModelFiles } from '../scaffold/model-generator.js';
import { generateModelsIndex } from '../scaffold/index-generator.js';
import type { GeneratedFile, MermaidNode, ScaffoldDiagnostic } from '../scaffold/types.js';

const SPECKEEPER_CLASS = 'speckeeper';

export interface ScaffoldCommandOptions {
  source: string;
  output?: string;
  force?: boolean;
  dryRun?: boolean;
}

export async function scaffoldCommand(options: ScaffoldCommandOptions): Promise<void> {
  console.log(chalk.blue('speckeeper scaffold'));
  console.log('');

  const sourcePath = resolve(options.source);
  if (!existsSync(sourcePath)) {
    console.error(chalk.red(`  Error: Source file not found: ${sourcePath}`));
    process.exit(1);
  }

  const markdown = readFileSync(sourcePath, 'utf-8');

  const flowchart = parseMarkdownFlowchart(markdown);
  if (!flowchart) {
    console.error(chalk.red('  Error: No mermaid flowchart found in the source file'));
    process.exit(1);
  }

  console.log(chalk.gray(`  Parsed: ${flowchart.nodes.size} nodes, ${flowchart.edges.length} edges`));

  const speckeeperNodes: MermaidNode[] = [];
  for (const node of flowchart.nodes.values()) {
    if (node.classes.includes(SPECKEEPER_CLASS)) {
      speckeeperNodes.push(node);
    }
  }

  if (speckeeperNodes.length === 0) {
    console.error(chalk.red(`  Error: No nodes with class "${SPECKEEPER_CLASS}" found`));
    console.log(chalk.gray('  Add `classDef speckeeper ...` and `class NODE1,NODE2 speckeeper` to your flowchart'));
    process.exit(1);
  }

  console.log(chalk.gray(`  speckeeper-managed nodes: ${speckeeperNodes.map(n => n.id).join(', ')}`));

  const { resolved, diagnostics } = resolveEdges(
    flowchart.edges,
    flowchart.nodes,
    SPECKEEPER_CLASS,
  );

  printDiagnostics(diagnostics);

  const outputDir = options.output
    ? resolve(options.output)
    : join(process.cwd(), 'design');

  const modelFiles = generateAllModelFiles(speckeeperNodes, resolved, flowchart.nodes);
  const indexFile = generateModelsIndex(modelFiles);

  const allFiles: GeneratedFile[] = [...modelFiles, indexFile];

  console.log('');
  console.log(chalk.cyan(`  Files to generate (${allFiles.length}):`));
  for (const file of allFiles) {
    console.log(chalk.gray(`    ${file.relativePath}`));
  }

  if (options.dryRun) {
    console.log('');
    console.log(chalk.yellow('  Dry run — no files written'));
    console.log('');
    for (const file of allFiles) {
      console.log(chalk.cyan(`  === ${file.relativePath} ===`));
      console.log(file.content);
    }
    return;
  }

  console.log('');
  let created = 0;
  let skipped = 0;

  for (const file of allFiles) {
    const fullPath = join(outputDir, file.relativePath);
    const dir = dirname(fullPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (existsSync(fullPath) && !options.force) {
      console.log(chalk.yellow(`  Skipped: ${file.relativePath} (already exists, use --force to overwrite)`));
      skipped++;
      continue;
    }

    writeFileSync(fullPath, file.content);
    console.log(chalk.green(`  Created: ${file.relativePath}`));
    created++;
  }

  console.log('');
  console.log(chalk.cyan(`  Done: ${created} created, ${skipped} skipped`));
}

function printDiagnostics(diagnostics: ScaffoldDiagnostic[]): void {
  if (diagnostics.length === 0) return;

  console.log('');
  console.log(chalk.cyan('  Diagnostics:'));

  for (const diag of diagnostics) {
    const prefix = diag.severity === 'error'
      ? chalk.red('  ERROR')
      : diag.severity === 'warning'
        ? chalk.yellow('  WARN ')
        : chalk.gray('  INFO ');
    const ctx = diag.context ? chalk.gray(` [${diag.context}]`) : '';
    console.log(`${prefix} ${diag.message}${ctx}`);
  }
}
