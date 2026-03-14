import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  annotationChecker,
  setArtifactsConfig,
} from '../../src/core/dsl/checkers.js';

let tempDir: string;
let originalCwd: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'speckeeper-test-'));
  originalCwd = process.cwd();
});

afterEach(() => {
  process.chdir(originalCwd);
  setArtifactsConfig({});
  rmSync(tempDir, { recursive: true, force: true });
});

describe('annotationChecker', () => {
  it('detects basic @verifies annotation and returns success with matchedFiles', () => {
    writeFileSync(join(tempDir, 'handler.ts'), '// @verifies FR-001\nfunction foo() {}');
    setArtifactsConfig({
      code: { globs: ['**/*.ts'] },
    });
    process.chdir(tempDir);

    const checker = annotationChecker({
      artifact: 'code',
      relationType: 'verifiedBy',
    });
    const result = checker.check({ id: 'FR-001', name: 'Feature' }, undefined);

    expect(result.success).toBe(true);
    expect(result.matchedFiles).toBeDefined();
    expect(result.matchedFiles).toHaveLength(1);
    expect(result.matchedFiles![0]).toMatchObject({
      specId: 'FR-001',
      filePath: 'handler.ts',
      line: 1,
      relationType: 'verifiedBy',
    });
  });

  it('detects multiple comma-separated IDs in one line', () => {
    writeFileSync(
      join(tempDir, 'multi.ts'),
      '// @verifies FR-001, FR-002, FR-003\nexport const x = 1;',
    );
    setArtifactsConfig({
      code: { globs: ['**/*.ts'] },
    });
    process.chdir(tempDir);

    const checker = annotationChecker({
      artifact: 'code',
      relationType: 'verifiedBy',
    });

    const result1 = checker.check({ id: 'FR-001', name: 'F1' }, undefined);
    const result2 = checker.check({ id: 'FR-002', name: 'F2' }, undefined);
    const result3 = checker.check({ id: 'FR-003', name: 'F3' }, undefined);

    expect(result1.matchedFiles).toHaveLength(1);
    expect(result2.matchedFiles).toHaveLength(1);
    expect(result3.matchedFiles).toHaveLength(1);
  });

  it('detects space-separated IDs', () => {
    writeFileSync(
      join(tempDir, 'space.ts'),
      '// @verifies FR-001 FR-002\nconst a = 1;',
    );
    setArtifactsConfig({
      code: { globs: ['**/*.ts'] },
    });
    process.chdir(tempDir);

    const checker = annotationChecker({
      artifact: 'code',
      relationType: 'verifiedBy',
    });
    const result1 = checker.check({ id: 'FR-001', name: 'F1' }, undefined);
    const result2 = checker.check({ id: 'FR-002', name: 'F2' }, undefined);

    expect(result1.matchedFiles).toHaveLength(1);
    expect(result2.matchedFiles).toHaveLength(1);
  });

  it('detects annotations in different comment styles', () => {
    writeFileSync(join(tempDir, 'script.py'), '# @verifies FR-001\nprint("ok")');
    writeFileSync(join(tempDir, 'query.sql'), '-- @implements FR-001\nSELECT 1;');
    writeFileSync(join(tempDir, 'block.ts'), '/* @verifies FR-001 */\nconst x = 1;');
    writeFileSync(join(tempDir, 'page.html'), '<!-- @implements FR-001 -->\n<div></div>');

    setArtifactsConfig({
      code: {
        globs: ['**/*.py', '**/*.sql', '**/*.ts', '**/*.html'],
      },
    });
    process.chdir(tempDir);

    const checker = annotationChecker({
      checks: [
        { artifact: 'code', relationType: 'verifiedBy' },
        { artifact: 'code', relationType: 'implements' },
      ],
    });
    const result = checker.check({ id: 'FR-001', name: 'Feature' }, undefined);

    expect(result.success).toBe(true);
    expect(result.matchedFiles).toBeDefined();
    expect(result.matchedFiles!.length).toBeGreaterThanOrEqual(2);
    const filePaths = result.matchedFiles!.map((m) => m.filePath);
    expect(filePaths).toContain('script.py');
    expect(filePaths).toContain('query.sql');
    expect(filePaths).toContain('block.ts');
    expect(filePaths).toContain('page.html');
  });

  it('generates warning when file exists but does not contain spec ID', () => {
    writeFileSync(join(tempDir, 'other.ts'), '// @verifies FR-999\nfunction bar() {}');
    setArtifactsConfig({
      code: { globs: ['**/*.ts'] },
    });
    process.chdir(tempDir);

    const checker = annotationChecker({
      artifact: 'code',
      relationType: 'verifiedBy',
    });
    const result = checker.check({ id: 'FR-001', name: 'Feature' }, undefined);

    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes('No annotation matches'))).toBe(true);
    expect(result.matchedFiles).toBeUndefined();
  });

  it('generates warning when glob matches no files', () => {
    writeFileSync(join(tempDir, 'only.ts'), '// @verifies FR-001');
    setArtifactsConfig({
      code: { globs: ['**/*.py'] },
    });
    process.chdir(tempDir);

    const checker = annotationChecker({
      artifact: 'code',
      relationType: 'verifiedBy',
    });
    const result = checker.check({ id: 'FR-001', name: 'Feature' }, undefined);

    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes('No annotation matches'))).toBe(true);
    expect(result.matchedFiles).toBeUndefined();
  });

  it('uses custom contentPatterns override instead of default', () => {
    writeFileSync(join(tempDir, 'custom.ts'), '// CUSTOM:FR-001\nconst x = 1;');
    setArtifactsConfig({
      code: { globs: ['**/*.ts'] },
    });
    process.chdir(tempDir);

    const checker = annotationChecker({
      artifact: 'code',
      relationType: 'verifiedBy',
      contentPatterns: [/CUSTOM:([\w-]+)/g],
    });
    const result = checker.check({ id: 'FR-001', name: 'Feature' }, undefined);

    expect(result.success).toBe(true);
    expect(result.matchedFiles).toHaveLength(1);
    expect(result.matchedFiles![0].filePath).toBe('custom.ts');
  });

  it('scans both implements and verifiedBy when checks array has two entries', () => {
    writeFileSync(
      join(tempDir, 'both.ts'),
      '// @verifies FR-001\n// @implements FR-001\nexport const x = 1;',
    );
    setArtifactsConfig({
      code: { globs: ['**/*.ts'] },
    });
    process.chdir(tempDir);

    const checker = annotationChecker({
      checks: [
        { artifact: 'code', relationType: 'verifiedBy' },
        { artifact: 'code', relationType: 'implements' },
      ],
    });
    const result = checker.check({ id: 'FR-001', name: 'Feature' }, undefined);

    expect(result.success).toBe(true);
    expect(result.matchedFiles).toBeDefined();
    expect(result.matchedFiles!.length).toBe(2);
    const relationTypes = result.matchedFiles!.map((m) => m.relationType);
    expect(relationTypes).toContain('verifiedBy');
    expect(relationTypes).toContain('implements');
  });

  it('detects @implements annotation with relationType implements', () => {
    writeFileSync(join(tempDir, 'impl.ts'), '// @implements COMP-01\nclass Component {}');
    setArtifactsConfig({
      code: { globs: ['**/*.ts'] },
    });
    process.chdir(tempDir);

    const checker = annotationChecker({
      artifact: 'code',
      relationType: 'implements',
    });
    const result = checker.check({ id: 'COMP-01', name: 'Component' }, undefined);

    expect(result.success).toBe(true);
    expect(result.matchedFiles).toHaveLength(1);
    expect(result.matchedFiles![0]).toMatchObject({
      specId: 'COMP-01',
      relationType: 'implements',
    });
  });

  it('does not match when spec ID is in file but not in captured group for checked ID', () => {
    writeFileSync(join(tempDir, 'other-id.ts'), '// @verifies FR-002\nfunction foo() {}');
    setArtifactsConfig({
      code: { globs: ['**/*.ts'] },
    });
    process.chdir(tempDir);

    const checker = annotationChecker({
      artifact: 'code',
      relationType: 'verifiedBy',
    });
    const result = checker.check({ id: 'FR-001', name: 'Feature' }, undefined);

    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.message.includes('No annotation matches'))).toBe(true);
    expect(result.matchedFiles).toBeUndefined();
  });

  it('excludes files matching exclude patterns from scan', () => {
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'included.ts'), '// @verifies FR-001\nconst a = 1;');
    writeFileSync(join(tempDir, 'src', 'excluded.ts'), '// @verifies FR-001\nconst b = 2;');
    setArtifactsConfig({
      code: {
        globs: ['**/*.ts'],
        exclude: ['**/excluded.ts'],
      },
    });
    process.chdir(tempDir);

    const checker = annotationChecker({
      artifact: 'code',
      relationType: 'verifiedBy',
    });
    const result = checker.check({ id: 'FR-001', name: 'Feature' }, undefined);

    expect(result.success).toBe(true);
    expect(result.matchedFiles).toHaveLength(1);
    expect(result.matchedFiles![0].filePath).toBe('src/included.ts');
    expect(result.matchedFiles!.some((m) => m.filePath.includes('excluded'))).toBe(false);
  });
});
