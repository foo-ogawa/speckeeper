/**
 * spects init command
 * 
 * Generate starter templates for a new spects project
 */
import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface InitOptions {
  force?: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runInit(options: InitOptions = {}): Promise<void> {
  const cwd = process.cwd();
  
  console.log(chalk.cyan('spects init'));
  console.log('');
  
  // Check if already initialized
  const designDir = join(cwd, 'design');
  const configFile = join(cwd, 'spects.config.ts');
  
  if (!options.force && (existsSync(designDir) || existsSync(configFile))) {
    console.log(chalk.yellow('  Project already initialized.'));
    console.log(chalk.gray('  Use --force to overwrite existing files.'));
    return;
  }
  
  // Get project name from directory
  const projectName = cwd.split('/').pop() || 'my-project';
  
  // Find templates directory
  const templatesDir = join(__dirname, 'templates', 'init');
  
  if (!existsSync(templatesDir)) {
    console.log(chalk.red(`  Error: Templates directory not found at ${templatesDir}`));
    console.log(chalk.gray('  Please ensure the package is properly installed.'));
    return;
  }
  
  // Copy template files
  let packageJsonCreated = false;
  copyTemplateDir(templatesDir, cwd, projectName, options.force || false, (relativePath, created) => {
    if (created) {
      console.log(chalk.green(`  Created: ${relativePath}`));
      if (relativePath === 'package.json') {
        packageJsonCreated = true;
      }
    } else {
      console.log(chalk.yellow(`  Skipped: ${relativePath} (already exists)`));
    }
  });
  
  console.log('');
  console.log(chalk.cyan('  Project initialized successfully!'));
  console.log('');
  console.log('  Next steps:');
  if (packageJsonCreated) {
    console.log(chalk.gray('    1. Run `npm install` to install dependencies'));
    console.log(chalk.gray('    2. Edit design/_models/ to customize your models'));
    console.log(chalk.gray('    3. Add specifications in design/'));
    console.log(chalk.gray('    4. Run `npx spects lint` to validate'));
  } else {
    console.log(chalk.gray('    1. Add spects and zod to your package.json dependencies'));
    console.log(chalk.gray('    2. Ensure "type": "module" is set in package.json'));
    console.log(chalk.gray('    3. Edit design/_models/ to customize your models'));
    console.log(chalk.gray('    4. Add specifications in design/'));
    console.log(chalk.gray('    5. Run `npx spects lint` to validate'));
  }
}

/**
 * Recursively copy template directory
 */
function copyTemplateDir(
  srcDir: string,
  destDir: string,
  projectName: string,
  force: boolean,
  onFile: (relativePath: string, created: boolean) => void,
  relativePath: string = ''
): void {
  const entries = readdirSync(srcDir);
  
  for (const entry of entries) {
    const srcPath = join(srcDir, entry);
    const stat = statSync(srcPath);
    
    // Handle .template extension
    const destEntry = entry.endsWith('.template') ? entry.slice(0, -9) : entry;
    const destPath = join(destDir, destEntry);
    const relPath = relativePath ? join(relativePath, destEntry) : destEntry;
    
    if (stat.isDirectory()) {
      // Create directory if it doesn't exist
      if (!existsSync(destPath)) {
        mkdirSync(destPath, { recursive: true });
        onFile(relPath + '/', true);
      }
      // Recurse into directory
      copyTemplateDir(srcPath, destPath, projectName, force, onFile, relPath);
    } else {
      // Skip if file exists and not force
      if (!force && existsSync(destPath)) {
        onFile(relPath, false);
        continue;
      }
      
      // Read and process template
      let content = readFileSync(srcPath, 'utf-8');
      
      // Replace template variables
      content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      
      // Write file
      const dir = dirname(destPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(destPath, content);
      onFile(relPath, true);
    }
  }
}
