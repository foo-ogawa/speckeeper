/**
 * FR-105: Project Initialization tests
 * 
 * Tests for the speckeeper init command that generates starter templates
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const testDir = join(process.cwd(), '.test-init');
const speckeeperCmd = join(process.cwd(), 'bin/speckeeper.js');

describe('FR-105: Project Initialization', () => {
  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('FR-105-01: speckeeper init creates design/ directory structure', () => {
    it('creates design/ directory', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      expect(existsSync(join(testDir, 'design'))).toBe(true);
    });

    it('creates design/_models/ directory', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      expect(existsSync(join(testDir, 'design/_models'))).toBe(true);
    });
  });

  describe('FR-105-02: speckeeper init generates speckeeper.config.ts', () => {
    it('creates speckeeper.config.ts file', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      expect(existsSync(join(testDir, 'speckeeper.config.ts'))).toBe(true);
    });

    it('speckeeper.config.ts imports from speckeeper', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      const content = readFileSync(join(testDir, 'speckeeper.config.ts'), 'utf-8');
      expect(content).toContain("import { defineConfig } from 'speckeeper'");
    });

    it('speckeeper.config.ts exports default config', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      const content = readFileSync(join(testDir, 'speckeeper.config.ts'), 'utf-8');
      expect(content).toContain('export default defineConfig');
    });
  });

  describe('FR-105-03: speckeeper init generates package.json', () => {
    it('creates package.json with type: module', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      const packageJson = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
      expect(packageJson.type).toBe('module');
    });

    it('package.json includes speckeeper dependency', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      const packageJson = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
      expect(packageJson.dependencies.speckeeper).toBeDefined();
    });

    it('package.json includes zod dependency', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      const packageJson = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
      expect(packageJson.dependencies.zod).toBeDefined();
    });

    it('package.json includes typescript devDependency', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      const packageJson = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf-8'));
      expect(packageJson.devDependencies.typescript).toBeDefined();
    });
  });

  describe('FR-105-04: speckeeper init generates tsconfig.json', () => {
    it('creates tsconfig.json file', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      expect(existsSync(join(testDir, 'tsconfig.json'))).toBe(true);
    });

    it('tsconfig.json has proper module settings', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      const tsconfig = JSON.parse(readFileSync(join(testDir, 'tsconfig.json'), 'utf-8'));
      expect(tsconfig.compilerOptions.module).toBe('ESNext');
      expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler');
    });

    it('tsconfig.json includes design/ in compilation', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      const tsconfig = JSON.parse(readFileSync(join(testDir, 'tsconfig.json'), 'utf-8'));
      expect(tsconfig.include).toContain('design/**/*');
    });
  });

  describe('FR-105-05: speckeeper init generates basic model definitions', () => {
    it('creates requirement.ts model', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      expect(existsSync(join(testDir, 'design/_models/requirement.ts'))).toBe(true);
    });

    it('creates usecase.ts model', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      expect(existsSync(join(testDir, 'design/_models/usecase.ts'))).toBe(true);
    });

    it('creates entity.ts model', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      expect(existsSync(join(testDir, 'design/_models/entity.ts'))).toBe(true);
    });

    it('creates component.ts model', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      expect(existsSync(join(testDir, 'design/_models/component.ts'))).toBe(true);
    });

    it('creates term.ts model', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      expect(existsSync(join(testDir, 'design/_models/term.ts'))).toBe(true);
    });

    it('creates index.ts that exports all models', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      const indexPath = join(testDir, 'design/_models/index.ts');
      expect(existsSync(indexPath)).toBe(true);
      
      const content = readFileSync(indexPath, 'utf-8');
      expect(content).toContain('RequirementModel');
      expect(content).toContain('allModels');
    });
  });

  describe('FR-105-06: speckeeper init generates sample specification files', () => {
    it('creates design/index.ts', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      expect(existsSync(join(testDir, 'design/index.ts'))).toBe(true);
    });

    it('creates design/requirements.ts with sample requirements', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      const reqPath = join(testDir, 'design/requirements.ts');
      expect(existsSync(reqPath)).toBe(true);
      
      const content = readFileSync(reqPath, 'utf-8');
      expect(content).toContain('Requirement');
    });
  });

  describe('FR-105-07: Generated project passes speckeeper lint', () => {
    it('speckeeper lint succeeds on generated project', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      // Install dependencies (using local speckeeper package)
      execSync(`npm install ${process.cwd()} --save`, { cwd: testDir });
      
      // Run speckeeper lint
      const result = execSync(`node ${speckeeperCmd} lint`, { 
        cwd: testDir,
        encoding: 'utf-8',
      });
      
      expect(result).toContain('No issues found');
    });
  });

  describe('FR-105-08: Generated project passes typecheck', () => {
    it('tsc --noEmit succeeds on generated project', () => {
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      // Install dependencies
      execSync(`npm install ${process.cwd()} --save`, { cwd: testDir });
      
      // Run typecheck
      expect(() => {
        execSync('npx tsc --noEmit', { cwd: testDir });
      }).not.toThrow();
    });
  });

  describe('FR-105-09: speckeeper init --force overwrites existing files', () => {
    it('overwrites speckeeper.config.ts with --force', () => {
      // First init
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      // Modify config
      const configPath = join(testDir, 'speckeeper.config.ts');
      writeFileSync(configPath, '// modified\n');
      
      // Second init with force
      execSync(`node ${speckeeperCmd} init --force`, { cwd: testDir });
      
      const content = readFileSync(configPath, 'utf-8');
      expect(content).not.toContain('// modified');
      expect(content).toContain('defineConfig');
    });

    it('overwrites design/_models/ files with --force', () => {
      // First init
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      // Modify a model file
      const modelPath = join(testDir, 'design/_models/requirement.ts');
      writeFileSync(modelPath, '// modified\n');
      
      // Second init with force
      execSync(`node ${speckeeperCmd} init --force`, { cwd: testDir });
      
      const content = readFileSync(modelPath, 'utf-8');
      expect(content).not.toContain('// modified');
      expect(content).toContain('RequirementModel');
    });
  });

  describe('FR-105-10: speckeeper init skips package.json if exists (without --force)', () => {
    it('does not overwrite existing package.json without --force', () => {
      // Create existing package.json
      const packagePath = join(testDir, 'package.json');
      writeFileSync(packagePath, JSON.stringify({ name: 'existing-project', version: '2.0.0' }));
      
      // Run init
      execSync(`node ${speckeeperCmd} init`, { cwd: testDir });
      
      // Check package.json is unchanged
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      expect(packageJson.version).toBe('2.0.0');
      expect(packageJson.name).toBe('existing-project');
    });

    it('overwrites existing package.json with --force', () => {
      // Create existing package.json
      const packagePath = join(testDir, 'package.json');
      writeFileSync(packagePath, JSON.stringify({ name: 'existing-project', version: '2.0.0' }));
      
      // Run init with force
      execSync(`node ${speckeeperCmd} init --force`, { cwd: testDir });
      
      // Check package.json is overwritten
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      expect(packageJson.type).toBe('module');
      expect(packageJson.dependencies).toBeDefined();
    });
  });
});
