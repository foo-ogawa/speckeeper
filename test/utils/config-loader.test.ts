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
  findConfigFile,
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

  describe('loadConfig rejects a config that exists but cannot be loaded', () => {
    it('rejects malformed YAML', async () => {
      const configPath = join(testDir, 'speckeeper.config.yaml');
      writeFileSync(configPath, 'srcDir: [unterminated\n');

      await expect(loadConfig(configPath)).rejects.toThrow(/Failed to load config/);
    });

    it('rejects malformed JSON', async () => {
      const configPath = join(testDir, 'speckeeper.config.json');
      writeFileSync(configPath, '{ "srcDir": ');

      await expect(loadConfig(configPath)).rejects.toThrow(/Failed to load config/);
    });

    it('rejects a TypeScript config that throws while loading', async () => {
      const configPath = join(testDir, 'speckeeper.config.ts');
      writeFileSync(configPath, "throw new Error('config exploded');\n");

      await expect(loadConfig(configPath)).rejects.toThrow(/config exploded/);
    });

    it('rejects a config that does not produce an object', async () => {
      const configPath = join(testDir, 'speckeeper.config.yaml');
      writeFileSync(configPath, '# only a comment\n');

      await expect(loadConfig(configPath)).rejects.toThrow(/must export an object/);
    });

    it('rejects an unsupported config file extension', async () => {
      const configPath = join(testDir, 'speckeeper.config.toml');
      writeFileSync(configPath, 'srcDir = "custom-src"\n');

      await expect(loadConfig(configPath)).rejects.toThrow(/Unsupported config file extension/);
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
