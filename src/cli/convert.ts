/**
 * speckeeper convert command
 *
 * Convert TS spec data files to YAML format.
 */
import chalk from 'chalk';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve, basename, dirname, join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { SpecModule } from '../core/model.js';

export interface ConvertOptions {
  output?: string;
  dryRun?: boolean;
}

export async function runConvert(file: string, options: ConvertOptions = {}): Promise<void> {
  const filePath = resolve(file);

  if (!existsSync(filePath)) {
    console.error(chalk.red(`  Error: File not found: ${filePath}`));
    process.exit(1);
  }

  if (!filePath.endsWith('.ts') && !filePath.endsWith('.js') && !filePath.endsWith('.mjs')) {
    console.error(chalk.red('  Error: Source file must be a .ts, .js, or .mjs file'));
    process.exit(1);
  }

  console.log(chalk.cyan('speckeeper convert'));
  console.log(chalk.gray(`  Source: ${filePath}`));
  console.log('');

  let specModule: SpecModule;
  try {
    const imported = await import(filePath);
    specModule = imported.default ?? imported;
  } catch (err) {
    console.error(chalk.red(`  Error: Failed to import ${filePath}`));
    console.error(chalk.gray(`  ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }

  if (!specModule?.entries || !Array.isArray(specModule.entries)) {
    console.error(chalk.red('  Error: File does not export a valid SpecModule (missing entries array)'));
    console.error(chalk.gray('  The file must export a SpecModule via defineSpecs()'));
    process.exit(1);
  }

  const yamlData = specModule.entries.length === 1
    ? { model: specModule.entries[0].model.id, specs: specModule.entries[0].data }
    : { entries: specModule.entries.map(e => ({ model: e.model.id, specs: e.data })) };

  const yamlString = stringifyYaml(yamlData, {
    lineWidth: 120,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  });

  if (options.dryRun) {
    console.log(chalk.yellow('  Dry run — showing conversion result:'));
    console.log('');
    console.log(yamlString);
    return;
  }

  const outputPath = options.output
    ? resolve(options.output)
    : join(dirname(filePath), basename(filePath).replace(/\.(ts|js|mjs)$/, '.yaml'));

  writeFileSync(outputPath, yamlString);
  console.log(chalk.green(`  Created: ${outputPath}`));
  console.log('');
  console.log(chalk.gray('  Remember to update design/index.ts to use loadYamlDir() for YAML files.'));
}
