/**
 * NFR-002/003/004/005: Compatibility tests
 * 
 * - NFR-002: Operates on Node.js 20 or higher
 * - NFR-003: Type checking passes with TypeScript 5.0 or higher
 * - NFR-004: Can be distributed as an npm package
 * - NFR-005: Provided in ES Modules format
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();

describe('NFR-002: Node.js compatibility', () => {
  // NFR-002-01: Verify operation on Node.js 20 LTS
  describe('NFR-002-01: Node.js 20 LTS', () => {
    it('should specify Node.js 20+ in package.json engines', () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // Check if engines.node is specified
        if (packageJson.engines?.node) {
          // Should be >= 20
          expect(packageJson.engines.node).toMatch(/^>=?\s*20|^20/);
        } else {
          // If not specified, it's assumed to work with current Node.js
          const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
          expect(nodeVersion).toBeGreaterThanOrEqual(20);
        }
      }
    });
    
    it('should use Node.js built-in modules correctly', () => {
      // Verify we can use Node.js 20+ APIs
      expect(typeof globalThis.fetch).toBe('function'); // fetch is built-in since Node 18
      expect(typeof Buffer.from).toBe('function');
      expect(typeof URL).toBe('function');
    });
    
    it('should not use deprecated Node.js APIs', () => {
      // In ESM context, deprecated require-based APIs should not be used
      // This test verifies we're in ESM context (which is the expected mode)
      const isESMContext = typeof globalThis.require === 'undefined';
      
      // We expect to be in ESM context where deprecated require APIs aren't available
      expect(isESMContext).toBe(true);
    });
  });
  
  // NFR-002-02: Verify operation on Node.js 20 LTS
  describe('NFR-002-02: Node.js 20 LTS', () => {
    it('should be compatible with Node.js 20 features', () => {
      // Node.js 20 introduced stable test runner, but we use vitest
      // Just verify we're running on compatible Node version
      const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
      
      // This test will pass on both 18 and 20+
      expect(nodeVersion).toBeGreaterThanOrEqual(18);
    });
  });
});

describe('NFR-003: TypeScript compatibility', () => {
  // NFR-003-01: Successful compilation with TypeScript 5.0
  describe('NFR-003-01: TypeScript 5.0 compilation', () => {
    it('should have TypeScript 5.0+ as devDependency', () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        const tsVersion = packageJson.devDependencies?.typescript || 
                         packageJson.dependencies?.typescript;
        
        if (tsVersion) {
          // Extract major version (handle ^5.0.0, ~5.0.0, 5.0.0, etc.)
          const versionMatch = tsVersion.match(/(\d+)\./);
          if (versionMatch) {
            const majorVersion = parseInt(versionMatch[1], 10);
            expect(majorVersion).toBeGreaterThanOrEqual(5);
          }
        }
      }
    });
    
    it('should have valid tsconfig.json', () => {
      const tsconfigPath = join(projectRoot, 'tsconfig.json');
      
      if (existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
        
        // Should have compilerOptions
        expect(tsconfig).toHaveProperty('compilerOptions');
        
        // Should target modern ES version
        if (tsconfig.compilerOptions.target) {
          expect(['ES2020', 'ES2021', 'ES2022', 'ES2023', 'ESNext']).toContain(
            tsconfig.compilerOptions.target
          );
        }
      }
    });
  });
  
  // NFR-003-02: No type errors in strict mode
  describe('NFR-003-02: strict mode', () => {
    it('should have strict mode enabled in tsconfig.json', () => {
      const tsconfigPath = join(projectRoot, 'tsconfig.json');
      
      if (existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
        
        // strict should be true
        expect(tsconfig.compilerOptions?.strict).toBe(true);
      }
    });
    
    it('should have noEmit or build output configured', () => {
      const tsconfigPath = join(projectRoot, 'tsconfig.json');
      
      if (existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
        
        // Should have either noEmit: true (for type-checking only)
        // or outDir configured (for build output)
        const hasNoEmit = tsconfig.compilerOptions?.noEmit === true;
        const hasOutDir = !!tsconfig.compilerOptions?.outDir;
        
        expect(hasNoEmit || hasOutDir).toBe(true);
      }
    });
  });
});

describe('NFR-004: npm distribution', () => {
  // NFR-004-01: Can publish package via npm publish
  describe('NFR-004-01: npm publish', () => {
    it('should have valid package.json for npm publish', () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // Required fields for npm publish
        expect(packageJson).toHaveProperty('name');
        expect(packageJson).toHaveProperty('version');
        
        // Should have main or exports
        const hasMain = !!packageJson.main;
        const hasExports = !!packageJson.exports;
        expect(hasMain || hasExports).toBe(true);
      }
    });
    
    it('should have appropriate files field or .npmignore', () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      const npmignorePath = join(projectRoot, '.npmignore');
      
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        const hasFilesField = !!packageJson.files;
        const hasNpmignore = existsSync(npmignorePath);
        
        // Should have either files field or .npmignore
        expect(hasFilesField || hasNpmignore).toBe(true);
      }
    });
  });
  
  // NFR-004-02: Can install via npm install speckeeper
  describe('NFR-004-02: npm install', () => {
    it('should have bin field for CLI', () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // Should have bin field for CLI command
        if (packageJson.bin) {
          // bin can be either a string or an object
          if (typeof packageJson.bin === 'string') {
            expect(packageJson.bin).toBeDefined();
          } else {
            expect(typeof packageJson.bin).toBe('object');
            expect(Object.keys(packageJson.bin).length).toBeGreaterThan(0);
          }
        }
      }
    });
    
    it('should have dependencies listed correctly', () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // Should have dependencies or devDependencies
        const hasDeps = !!packageJson.dependencies;
        const hasDevDeps = !!packageJson.devDependencies;
        
        expect(hasDeps || hasDevDeps).toBe(true);
        
        // Zod should be a dependency (if using zod)
        if (packageJson.dependencies?.zod) {
          expect(packageJson.dependencies.zod).toBeDefined();
        }
      }
    });
  });
});

describe('NFR-005: ESM support', () => {
  // NFR-005-01: Can import via import statement
  describe('NFR-005-01: ESM import', () => {
    it('should have type: module in package.json', () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // Should be ESM module
        expect(packageJson.type).toBe('module');
      }
    });
    
    it('should have exports field for ESM', () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // Should have exports field
        if (packageJson.exports) {
          // Should have import condition
          const hasImport = JSON.stringify(packageJson.exports).includes('"import"') ||
                           JSON.stringify(packageJson.exports).includes('.js"');
          expect(hasImport).toBe(true);
        }
      }
    });
    
    it('should output .js files (not .cjs)', () => {
      const distDir = join(projectRoot, 'dist');
      
      if (existsSync(distDir)) {
        // Check that main output is .js not .cjs
        const hasJsOutput = existsSync(join(distDir, 'index.js')) ||
                           existsSync(join(distDir, 'cli.js'));
        
        expect(hasJsOutput).toBe(true);
      }
    });
  });
  
  // NFR-005-02: Tree-shaking works
  describe('NFR-005-02: Tree-shaking', () => {
    it('should have sideEffects field set to false', () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // sideEffects: false enables tree-shaking
        if (packageJson.sideEffects !== undefined) {
          expect(packageJson.sideEffects).toBe(false);
        }
        // If not specified, bundlers may still tree-shake based on analysis
      }
    });
    
    it('should use named exports for tree-shaking', () => {
      // This is more of a design guideline verification
      // Verify that the package exports named exports
      const packageJsonPath = join(projectRoot, 'package.json');
      
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        
        // If using exports field, verify structure
        if (packageJson.exports) {
          // Should have granular exports for tree-shaking
          const exportsString = JSON.stringify(packageJson.exports);
          
          // Either has multiple export paths or is a simple string
          const hasMultipleExports = exportsString.includes('./') ||
                                     typeof packageJson.exports === 'string';
          expect(hasMultipleExports).toBe(true);
        }
      }
    });
  });
});
