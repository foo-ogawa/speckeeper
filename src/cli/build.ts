/**
 * Build Command
 * 
 * Generate documents and schemas using model class exporters
 */

import chalk from 'chalk';
import { join } from 'node:path';
import { loadConfig } from '../utils/config-loader.js';
import { batchWriteFiles } from '../utils/file-writer.js';
import {
  planBuildOutputs,
  type BuildableModel,
  type ExporterOutputRoots,
} from '../core/model.js';

// ============================================================================
// Build Command Options
// ============================================================================

export interface BuildCommandOptions {
  config?: string;
  output?: string;
  format?: 'markdown' | 'json' | 'both';
  verbose?: boolean;
  clean?: boolean;
}

// ============================================================================
// Build Command
// ============================================================================

export async function buildCommand(options: BuildCommandOptions): Promise<void> {
  console.log(chalk.blue('speckeeper build'));
  console.log('');
  
  const cwd = process.cwd();
  const config = await loadConfig(options.config);
  
  console.log(chalk.gray(`  Design:  ${config.designDir || 'design'}/`));
  console.log(chalk.gray(`  Docs:    ${config.docsDir}/`));
  console.log(chalk.gray(`  Specs:   ${config.specsDir}/`));
  console.log('');
  
  try {
    const models = (config.models ?? []) as BuildableModel[];
    const specs = config.specs;

    const roots: ExporterOutputRoots = {
      docs: join(cwd, config.docsDir),
      specs: join(cwd, config.specsDir),
    };

    if (models.length === 0) {
      console.log(chalk.yellow('  No models registered. Add models to speckeeper.config.ts.'));
      return;
    }

    console.log(chalk.blue(`  Processing ${models.length} model types...`));

    const { files, models: modelOutputs } = planBuildOutputs(models, specs, roots);

    for (const modelOutput of modelOutputs) {
      if (modelOutput.skipped === null) {
        console.log(chalk.green(`    ✓ ${modelOutput.name}`));
      } else if (options.verbose) {
        const reason = modelOutput.skipped === 'no-exporters' ? 'no exporters defined' : 'no specs found';
        console.log(chalk.gray(`    ${modelOutput.name}: ${reason}`));
      }
    }

    if (files.length > 0) {
      console.log('');
      console.log(chalk.blue(`  Writing ${files.length} files...`));
      
      const result = await batchWriteFiles(files);
      
      console.log('');
      console.log(chalk.green(`  ✓ Build complete`));
      console.log(chalk.gray(`    Created: ${result.created}`));
      console.log(chalk.gray(`    Updated: ${result.updated}`));
      console.log(chalk.gray(`    Unchanged: ${result.unchanged}`));
    } else {
      console.log(chalk.yellow('  No files to generate.'));
    }
    
  } catch (error) {
    console.error(chalk.red('Build failed:'), error);
    process.exit(1);
  }
}
