/**
 * Build Command
 * 
 * Generate documents and schemas using model class exporters
 */

import chalk from 'chalk';
import { join } from 'node:path';
import { loadConfig } from '../utils/config-loader.js';
import { batchWriteFiles, ensureDir } from '../utils/file-writer.js';
import { getSpecsFromConfig } from '../core/model.js';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const models = (config.models || []) as any[];
    const specs = config.specs;
    
    ensureDir(join(cwd, config.docsDir));
    ensureDir(join(cwd, config.specsDir));
    
    const files: Array<{ path: string; content: string }> = [];
    
    if (models.length === 0) {
      console.log(chalk.yellow('  No models registered. Add models to speckeeper.config.ts.'));
      return;
    }
    
    console.log(chalk.blue(`  Processing ${models.length} model types...`));
    
    for (const model of models) {
      const exporters = model.getExporters();
      
      if (exporters.length === 0) {
        if (options.verbose) {
          console.log(chalk.gray(`    ${model.name}: no exporters defined`));
        }
        continue;
      }
      
      const modelSpecs = getSpecsFromConfig(specs, model.id);
      
      if (modelSpecs.length === 0) {
        if (options.verbose) {
          console.log(chalk.gray(`    ${model.name}: no specs found`));
        }
        continue;
      }
      
      for (const exporter of exporters) {
        const outputDir = exporter.outputDir 
          ? join(cwd, config.docsDir, exporter.outputDir)
          : join(cwd, config.docsDir);
        
        ensureDir(outputDir);
        
        if (exporter.single) {
          for (const spec of modelSpecs) {
            const content = exporter.single(spec);
            const filename = model.getFilename(spec, exporter.format) || (spec as { id: string }).id;
            files.push({
              path: join(outputDir, `${filename}.md`),
              content,
            });
          }
        }
        
        if (exporter.index) {
          const indexContent = exporter.index(modelSpecs);
          files.push({
            path: join(outputDir, 'index.md'),
            content: indexContent,
          });
        }
      }
      
      console.log(chalk.green(`    ✓ ${model.name}`));
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
