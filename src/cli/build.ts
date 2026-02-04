/**
 * Build Command
 * 
 * Generate documents and schemas using model class exporters
 */

import chalk from 'chalk';
import { join } from 'node:path';
import { loadConfig } from '../utils/config-loader.js';
import { batchWriteFiles, ensureDir } from '../utils/file-writer.js';
import { getAllModels } from '../core/model.js';

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
  console.log(chalk.blue('spects build'));
  console.log('');
  
  const cwd = process.cwd();
  
  // Load config
  const config = await loadConfig(options.config);
  // Output paths available via getOutputPaths(config, cwd) if needed
  
  console.log(chalk.gray(`  Design:  ${config.designDir || 'design'}/`));
  console.log(chalk.gray(`  Docs:    ${config.docsDir}/`));
  console.log(chalk.gray(`  Specs:   ${config.specsDir}/`));
  console.log('');
  
  try {
    // Ensure base output directories exist
    ensureDir(join(cwd, config.docsDir));
    ensureDir(join(cwd, config.specsDir));
    
    const files: Array<{ path: string; content: string }> = [];
    const models = getAllModels();
    
    if (models.length === 0) {
      console.log(chalk.yellow('  No models registered. Run model registration first.'));
      return;
    }
    
    console.log(chalk.blue(`  Processing ${models.length} model types...`));
    
    // Process each model type
    for (const model of models) {
      const exporters = model.getExporters();
      
      if (exporters.length === 0) {
        if (options.verbose) {
          console.log(chalk.gray(`    ${model.name}: no exporters defined`));
        }
        continue;
      }
      
      // TODO: Load specs for this model from design/ directory
      // For now, this is a placeholder - actual implementation needs
      // to load specs from the appropriate design/*.ts files
      const specs: unknown[] = [];
      
      if (specs.length === 0) {
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
        
        // Generate individual files
        if (exporter.single) {
          for (const spec of specs) {
            const content = exporter.single(spec);
            const filename = model.getFilename(spec, exporter.format) || (spec as { id: string }).id;
            files.push({
              path: join(outputDir, `${filename}.md`),
              content,
            });
          }
        }
        
        // Generate index file
        if (exporter.index) {
          const indexContent = exporter.index(specs);
          files.push({
            path: join(outputDir, 'index.md'),
            content: indexContent,
          });
        }
      }
      
      console.log(chalk.green(`    ✓ ${model.name}`));
    }
    
    // Write all files
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
