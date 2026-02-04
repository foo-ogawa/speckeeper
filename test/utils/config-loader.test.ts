/**
 * Config Loader Tests
 * 
 * FR-103: Input format diversity - Config file loading verification
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import {
  loadConfig,
  validateConfig,
  getOutputPaths,
  getExpectedOutputDirs,
  validateOutputPaths,
  findConfigFile,
  type SpeckeeperConfig,
} from '../../src/utils/config-loader.js';

describe('FR-103, CR-002: config-loader', () => {
  const testDir = join(process.cwd(), '.test-config');
  
  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });
  
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });
  
  describe('loadConfig', () => {
    it('should return default config when no config file exists', async () => {
      const config = await loadConfig(undefined, testDir);
      
      expect(config.srcDir).toBe('src');
      expect(config.docsDir).toBe('docs');
      expect(config.specsDir).toBe('specs');
    });
    
    it('should load YAML config', async () => {
      const configPath = join(testDir, 'speckeeper.config.yaml');
      writeFileSync(configPath, `
srcDir: custom-src
docsDir: custom-docs
specsDir: custom-specs
`);
      
      const config = await loadConfig(configPath);
      
      expect(config.srcDir).toBe('custom-src');
      expect(config.docsDir).toBe('custom-docs');
      expect(config.specsDir).toBe('custom-specs');
    });
    
    it('should load JSON config', async () => {
      const configPath = join(testDir, 'speckeeper.config.json');
      writeFileSync(configPath, JSON.stringify({
        srcDir: 'json-src',
        docsDir: 'json-docs',
        specsDir: 'json-specs',
      }));
      
      const config = await loadConfig(configPath);
      
      expect(config.srcDir).toBe('json-src');
      expect(config.docsDir).toBe('json-docs');
      expect(config.specsDir).toBe('json-specs');
    });
    
    it('should merge with defaults', async () => {
      const configPath = join(testDir, 'speckeeper.config.yaml');
      writeFileSync(configPath, `
docsDir: custom-docs
`);
      
      const config = await loadConfig(configPath);
      
      expect(config.srcDir).toBe('src'); // default
      expect(config.docsDir).toBe('custom-docs'); // custom
      expect(config.specsDir).toBe('specs'); // default
    });
  });
  
  describe('validateConfig', () => {
    it('should return no errors for valid config', () => {
      const config: SpeckeeperConfig = {
        srcDir: 'src',
        docsDir: 'docs',
        specsDir: 'specs',
      };
      
      const errors = validateConfig(config);
      
      expect(errors).toHaveLength(0);
    });
    
    it('should return errors for missing required fields', () => {
      const config = {} as SpeckeeperConfig;
      
      const errors = validateConfig(config);
      
      expect(errors).toContain('srcDir is required');
      expect(errors).toContain('docsDir is required');
      expect(errors).toContain('specsDir is required');
    });
  });
  
  describe('getOutputPaths', () => {
    it('should return correct output paths', () => {
      const config: SpeckeeperConfig = {
        srcDir: 'src',
        docsDir: 'docs',
        specsDir: 'specs',
      };
      
      const paths = getOutputPaths(config, testDir);
      
      expect(paths.requirements).toBe(join(testDir, 'docs', 'requirements'));
      expect(paths.usecases).toBe(join(testDir, 'docs', 'usecases'));
      expect(paths.architecture).toBe(join(testDir, 'docs', 'architecture'));
      expect(paths.dataModel).toBe(join(testDir, 'docs', 'data-model'));
      expect(paths.screens).toBe(join(testDir, 'docs', 'screens'));
      expect(paths.flows).toBe(join(testDir, 'docs', 'flows'));
      expect(paths.glossary).toBe(join(testDir, 'docs', 'glossary'));
      expect(paths.schemasEntities).toBe(join(testDir, 'specs', 'schemas', 'entities'));
    });
  });
  
  describe('getExpectedOutputDirs', () => {
    it('should return all expected directories', () => {
      const config: SpeckeeperConfig = {
        srcDir: 'src',
        docsDir: 'docs',
        specsDir: 'specs',
      };
      
      const dirs = getExpectedOutputDirs(config, testDir);
      
      expect(dirs).toContain(join(testDir, 'docs', 'requirements'));
      expect(dirs).toContain(join(testDir, 'docs', 'architecture'));
      expect(dirs).toContain(join(testDir, 'docs', 'data-model'));
      expect(dirs).toContain(join(testDir, 'specs', 'schemas', 'entities'));
    });
  });
  
  describe('validateOutputPaths', () => {
    it('should validate correct path', () => {
      const config: SpeckeeperConfig = {
        srcDir: 'src',
        docsDir: 'docs',
        specsDir: 'specs',
      };
      
      const result = validateOutputPaths(
        join(testDir, 'docs', 'requirements', 'FR-001.md'),
        config,
        testDir
      );
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject path outside docs/specs', () => {
      const config: SpeckeeperConfig = {
        srcDir: 'src',
        docsDir: 'docs',
        specsDir: 'specs',
      };
      
      const result = validateOutputPaths(
        join(testDir, 'other', 'file.md'),
        config,
        testDir
      );
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('not under docs/ or specs/');
    });
    
    it('should reject non-compliant path under docs/', () => {
      const config: SpeckeeperConfig = {
        srcDir: 'src',
        docsDir: 'docs',
        specsDir: 'specs',
      };
      
      const result = validateOutputPaths(
        join(testDir, 'docs', 'generated', 'file.md'),
        config,
        testDir
      );
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('does not match spec-compliant paths');
    });
  });
  
  describe('findConfigFile', () => {
    it('should find YAML config', () => {
      writeFileSync(join(testDir, 'speckeeper.config.yaml'), 'srcDir: src');
      
      const found = findConfigFile(testDir);
      
      expect(found).toBe(join(testDir, 'speckeeper.config.yaml'));
    });
    
    it('should find JSON config', () => {
      writeFileSync(join(testDir, 'speckeeper.config.json'), '{}');
      
      const found = findConfigFile(testDir);
      
      expect(found).toBe(join(testDir, 'speckeeper.config.json'));
    });
    
    it('should search in specified directory', () => {
      // Note: findConfigFile may also search parent directories
      // This test verifies it can find config in the specified directory
      writeFileSync(join(testDir, 'speckeeper.config.yaml'), 'srcDir: test');
      
      const found = findConfigFile(testDir);
      
      // Should find the config in testDir, not parent
      expect(found).toBe(join(testDir, 'speckeeper.config.yaml'));
    });
  });
});
