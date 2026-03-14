import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  annotationScanner,
  createAnnotationScanner,
  runGlobalScan,
} from '../../src/core/global-scanner.js';
import type { SourceConfig } from '../../src/core/config-api.js';

let tempDir: string;
let originalCwd: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'speckeeper-test-'));
  originalCwd = process.cwd();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tempDir, { recursive: true, force: true });
});

describe('annotationScanner', () => {
  it('detects basic @verifies annotation', () => {
    const content = '// @verifies FR-001\nfunction foo() {}';
    const matches = annotationScanner.findSpecIds(content, ['FR-001'], 'handler.ts');

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      specId: 'FR-001',
      location: 'handler.ts:1',
    });
  });

  it('detects multiple comma-separated IDs in one line', () => {
    const content = '// @verifies FR-001, FR-002, FR-003\nexport const x = 1;';
    const matches = annotationScanner.findSpecIds(content, ['FR-001', 'FR-002', 'FR-003'], 'multi.ts');

    expect(matches).toHaveLength(3);
    const foundIds = matches.map(m => m.specId).sort();
    expect(foundIds).toEqual(['FR-001', 'FR-002', 'FR-003']);
  });

  it('detects space-separated IDs', () => {
    const content = '// @verifies FR-001 FR-002\nconst a = 1;';
    const matches = annotationScanner.findSpecIds(content, ['FR-001', 'FR-002'], 'space.ts');

    expect(matches).toHaveLength(2);
  });

  it('detects @implements annotation', () => {
    const content = '// @implements COMP-01\nclass Component {}';
    const matches = annotationScanner.findSpecIds(content, ['COMP-01'], 'impl.ts');

    expect(matches).toHaveLength(1);
    expect(matches[0].specId).toBe('COMP-01');
  });

  it('detects @traces annotation', () => {
    const content = '// @traces REQ-001\nfunction doStuff() {}';
    const matches = annotationScanner.findSpecIds(content, ['REQ-001'], 'trace.ts');

    expect(matches).toHaveLength(1);
    expect(matches[0].specId).toBe('REQ-001');
  });

  it('detects annotations in different comment styles', () => {
    const pyContent = '# @verifies FR-001\nprint("ok")';
    const sqlContent = '-- @implements FR-001\nSELECT 1;';
    const blockContent = '/* @verifies FR-001 */\nconst x = 1;';
    const htmlContent = '<!-- @implements FR-001 -->\n<div></div>';

    expect(annotationScanner.findSpecIds(pyContent, ['FR-001'], 'script.py')).toHaveLength(1);
    expect(annotationScanner.findSpecIds(sqlContent, ['FR-001'], 'query.sql')).toHaveLength(1);
    expect(annotationScanner.findSpecIds(blockContent, ['FR-001'], 'block.ts')).toHaveLength(1);
    expect(annotationScanner.findSpecIds(htmlContent, ['FR-001'], 'page.html')).toHaveLength(1);
  });

  it('does not match when spec ID is not in content', () => {
    const content = '// @verifies FR-002\nfunction bar() {}';
    const matches = annotationScanner.findSpecIds(content, ['FR-001'], 'other.ts');
    expect(matches).toHaveLength(0);
  });

  it('returns correct line number', () => {
    const content = 'line1\nline2\n// @verifies FR-001\nline4';
    const matches = annotationScanner.findSpecIds(content, ['FR-001'], 'test.ts');
    expect(matches).toHaveLength(1);
    expect(matches[0].location).toBe('test.ts:3');
  });
});

describe('createAnnotationScanner', () => {
  it('uses custom content patterns', () => {
    const scanner = createAnnotationScanner([/CUSTOM:([\w-]+)/g]);
    const content = '// CUSTOM:FR-001\nconst x = 1;';
    const matches = scanner.findSpecIds(content, ['FR-001'], 'custom.ts');

    expect(matches).toHaveLength(1);
    expect(matches[0].specId).toBe('FR-001');
  });

  it('does not match default patterns when custom is provided', () => {
    const scanner = createAnnotationScanner([/CUSTOM:([\w-]+)/g]);
    const content = '// @verifies FR-001\nconst x = 1;';
    const matches = scanner.findSpecIds(content, ['FR-001'], 'nope.ts');

    expect(matches).toHaveLength(0);
  });
});

describe('runGlobalScan with annotation source', () => {
  it('scans annotation files and returns matches', () => {
    writeFileSync(join(tempDir, 'handler.ts'), '// @verifies FR-001\nfunction foo() {}');
    writeFileSync(join(tempDir, 'impl.ts'), '// @implements FR-002\nclass Bar {}');
    process.chdir(tempDir);

    const sources: SourceConfig[] = [{
      type: 'annotation',
      paths: ['**/*.ts'],
      relation: 'verifiedBy',
    }];
    const { matches } = runGlobalScan(sources, ['FR-001', 'FR-002', 'FR-999'], tempDir);

    expect(matches.has('FR-001')).toBe(true);
    expect(matches.has('FR-002')).toBe(true);
    expect(matches.has('FR-999')).toBe(false);
  });

  it('uses custom contentPatterns in annotation source', () => {
    writeFileSync(join(tempDir, 'custom.ts'), '// TRACK:FR-001\nconst x = 1;');
    process.chdir(tempDir);

    const sources: SourceConfig[] = [{
      type: 'annotation',
      paths: ['**/*.ts'],
      relation: 'verifiedBy',
      contentPatterns: [/TRACK:([\w-]+)/g],
    }];
    const { matches } = runGlobalScan(sources, ['FR-001'], tempDir);

    expect(matches.has('FR-001')).toBe(true);
  });

  it('respects exclude patterns', () => {
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'included.ts'), '// @verifies FR-001\nconst a = 1;');
    writeFileSync(join(tempDir, 'src', 'excluded.ts'), '// @verifies FR-001\nconst b = 2;');
    process.chdir(tempDir);

    const sources: SourceConfig[] = [{
      type: 'annotation',
      paths: ['**/*.ts'],
      exclude: ['**/excluded.ts'],
      relation: 'verifiedBy',
    }];
    const { matches } = runGlobalScan(sources, ['FR-001'], tempDir);

    expect(matches.has('FR-001')).toBe(true);
    const allMatches = matches.get('FR-001')!;
    expect(allMatches).toHaveLength(1);
    expect(allMatches[0].filePath).toBe('src/included.ts');
  });
});
