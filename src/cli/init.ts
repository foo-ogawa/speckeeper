/**
 * speckeeper init command
 * 
 * Generate starter templates for a new speckeeper project
 */
import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface InitOptions {
  force?: boolean;
  format?: 'ts' | 'yaml';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runInit(options: InitOptions = {}): Promise<void> {
  const cwd = process.cwd();
  
  console.log(chalk.cyan('speckeeper init'));
  console.log('');
  
  // Check if already initialized
  const designDir = join(cwd, 'design');
  const configFile = join(cwd, 'speckeeper.config.ts');
  
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
  
  const isYaml = options.format === 'yaml';

  // Copy template files (skip TS data files when yaml format is requested)
  const skipForYaml = new Set(['design/requirements.ts']);
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
  }, '', isYaml ? skipForYaml : undefined);

  if (isYaml) {
    writeYamlInitFiles(cwd, options.force || false);
  }
  
  console.log('');
  console.log(chalk.cyan('  Project initialized successfully!'));
  console.log('');
  const dataFormat = isYaml ? 'design/*.yaml' : 'design/*.ts using defineSpecs()';
  console.log('  Next steps:');
  if (packageJsonCreated) {
    console.log(chalk.gray('    1. Run `npm install` to install dependencies'));
    console.log(chalk.gray(`    2. Add spec data in ${dataFormat}`));
    console.log(chalk.gray('    3. Import new spec files in design/index.ts'));
    console.log(chalk.gray('    4. Run `npx speckeeper lint` to validate'));
  } else {
    console.log(chalk.gray('    1. Add speckeeper and zod to your package.json dependencies'));
    console.log(chalk.gray('    2. Ensure "type": "module" is set in package.json'));
    console.log(chalk.gray(`    3. Add spec data in ${dataFormat}`));
    console.log(chalk.gray('    4. Import new spec files in design/index.ts'));
    console.log(chalk.gray('    5. Run `npx speckeeper lint` to validate'));
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
  relativePath: string = '',
  skipRelPaths?: Set<string>,
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
      copyTemplateDir(srcPath, destPath, projectName, force, onFile, relPath, skipRelPaths);
    } else {
      if (skipRelPaths?.has(relPath)) continue;

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

function writeYamlInitFiles(cwd: string, force: boolean): void {
  const designDir = join(cwd, 'design');
  if (!existsSync(designDir)) {
    mkdirSync(designDir, { recursive: true });
  }

  // YAML requirements data
  const reqYaml = join(designDir, 'requirements.yaml');
  if (force || !existsSync(reqYaml)) {
    writeFileSync(reqYaml, `# Requirements
model: requirement
specs:
  - id: REQ-001
    name: User Authentication
    type: functional
    priority: must
    description: Users can authenticate using email and password
    acceptanceCriteria:
      - id: REQ-001-01
        description: Valid credentials grant access
        verificationMethod: test
      - id: REQ-001-02
        description: Invalid credentials show error message
        verificationMethod: test
`);
    console.log(chalk.green('  Created: design/requirements.yaml'));
  }

  // Overwrite design/index.ts to use loadYamlDir
  const indexTs = join(designDir, 'index.ts');
  if (force || !existsSync(indexTs)) {
    writeFileSync(indexTs, `/**
 * Design entry point
 */
import { mergeSpecs, loadYamlDir } from 'speckeeper';
import { allModels } from './_models/index.ts';

const yamlSpecs = loadYamlDir(import.meta.dirname, allModels);

export default mergeSpecs(...yamlSpecs);
`);
    console.log(chalk.green('  Created: design/index.ts (yaml mode)'));
  }
}
