/**
 * FR-500: Drift check tests
 * 
 * Detect whether generated output (docs/, specs/) has been manually edited
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const testDir = join(process.cwd(), '.test-drift');

// Hash computation
function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// Drift detection result
interface DriftResult {
  path: string;
  hasDrift: boolean;
  missing?: boolean;
  expectedHash?: string;
  actualHash?: string;
}

// Drift detection
function detectDrift(filePath: string, expectedContent: string): DriftResult {
  const result: DriftResult = {
    path: filePath,
    hasDrift: false,
  };
  
  if (!existsSync(filePath)) {
    return { ...result, hasDrift: true, missing: true };
  }
  
  const actualContent = readFileSync(filePath, 'utf-8');
  const expectedHash = computeHash(expectedContent);
  const actualHash = computeHash(actualContent);
  
  result.expectedHash = expectedHash;
  result.actualHash = actualHash;
  result.hasDrift = expectedHash !== actualHash;
  
  return result;
}

// Batch drift detection
function detectBatchDrift(files: Array<{ path: string; expectedContent: string }>): {
  results: DriftResult[];
  hasDrift: boolean;
  driftCount: number;
  missingCount: number;
} {
  const results = files.map(f => detectDrift(f.path, f.expectedContent));
  const driftFiles = results.filter(r => r.hasDrift && !r.missing);
  const missingFiles = results.filter(r => r.missing);
  
  return {
    results,
    hasDrift: results.some(r => r.hasDrift),
    driftCount: driftFiles.length,
    missingCount: missingFiles.length,
  };
}

// Generate drift report
function generateDriftReport(results: DriftResult[]): string {
  const lines: string[] = ['# Drift Report', ''];
  
  const driftFiles = results.filter(r => r.hasDrift && !r.missing);
  const missingFiles = results.filter(r => r.missing);
  const _okFiles = results.filter(r => !r.hasDrift);
  
  if (driftFiles.length === 0 && missingFiles.length === 0) {
    lines.push('✅ No drift detected. All files are in sync.');
    return lines.join('\n');
  }
  
  if (driftFiles.length > 0) {
    lines.push('## Drifted Files');
    lines.push('');
    lines.push('The following files have been modified and differ from the expected output:');
    lines.push('');
    for (const file of driftFiles) {
      lines.push(`- \`${file.path}\``);
      lines.push(`  - Expected hash: \`${file.expectedHash}\``);
      lines.push(`  - Actual hash: \`${file.actualHash}\``);
    }
    lines.push('');
  }
  
  if (missingFiles.length > 0) {
    lines.push('## Missing Files');
    lines.push('');
    lines.push('The following expected files are missing:');
    lines.push('');
    for (const file of missingFiles) {
      lines.push(`- \`${file.path}\``);
    }
    lines.push('');
  }
  
  lines.push('## Action Required');
  lines.push('');
  lines.push('Run `spects build` to regenerate files, then commit the changes.');
  lines.push('');
  lines.push('> **Note**: Manual editing of generated files is discouraged.');
  lines.push('> Modify the source TypeScript models instead.');
  
  return lines.join('\n');
}

// CI exit code logic
function getDriftExitCode(results: DriftResult[]): number {
  return results.some(r => r.hasDrift) ? 1 : 0;
}

describe('FR-500: Drift check', () => {
  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(join(testDir, 'docs'), { recursive: true });
    mkdirSync(join(testDir, 'specs'), { recursive: true });
  });
  
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });
  
  // FR-500-01: Detect differences between generated docs/ / specs/ and committed files after build
  describe('FR-500-01: Diff detection', () => {
    it('should detect no drift when content matches', () => {
      const filePath = join(testDir, 'docs', 'test.md');
      const content = '# Test Document\n\nThis is the expected content.';
      
      writeFileSync(filePath, content);
      
      const result = detectDrift(filePath, content);
      
      expect(result.hasDrift).toBe(false);
      expect(result.missing).toBeUndefined();
    });
    
    it('should detect drift when content differs', () => {
      const filePath = join(testDir, 'docs', 'test.md');
      const originalContent = '# Test Document\n\nOriginal content.';
      const modifiedContent = '# Test Document\n\nModified content.';
      
      writeFileSync(filePath, modifiedContent);
      
      const result = detectDrift(filePath, originalContent);
      
      expect(result.hasDrift).toBe(true);
      expect(result.expectedHash).not.toBe(result.actualHash);
    });
    
    it('should detect missing files', () => {
      const filePath = join(testDir, 'docs', 'nonexistent.md');
      const expectedContent = '# Expected Content';
      
      const result = detectDrift(filePath, expectedContent);
      
      expect(result.hasDrift).toBe(true);
      expect(result.missing).toBe(true);
    });
    
    it('should detect drift in JSON files (specs/)', () => {
      const filePath = join(testDir, 'specs', 'schema.json');
      const originalJson = JSON.stringify({ version: 1, data: 'original' }, null, 2);
      const modifiedJson = JSON.stringify({ version: 1, data: 'modified' }, null, 2);
      
      writeFileSync(filePath, modifiedJson);
      
      const result = detectDrift(filePath, originalJson);
      
      expect(result.hasDrift).toBe(true);
    });
    
    it('should detect batch drift across multiple files', () => {
      // Setup files
      writeFileSync(join(testDir, 'docs', 'file1.md'), 'Content 1');
      writeFileSync(join(testDir, 'docs', 'file2.md'), 'Modified Content 2'); // Drifted
      // file3.md missing
      
      const files = [
        { path: join(testDir, 'docs', 'file1.md'), expectedContent: 'Content 1' },
        { path: join(testDir, 'docs', 'file2.md'), expectedContent: 'Content 2' },
        { path: join(testDir, 'docs', 'file3.md'), expectedContent: 'Content 3' },
      ];
      
      const batch = detectBatchDrift(files);
      
      expect(batch.hasDrift).toBe(true);
      expect(batch.driftCount).toBe(1);
      expect(batch.missingCount).toBe(1);
    });
    
    it('should handle whitespace-only differences', () => {
      const filePath = join(testDir, 'docs', 'whitespace.md');
      const original = 'Line 1\nLine 2\n';
      const modified = 'Line 1\nLine 2\n\n'; // Extra newline
      
      writeFileSync(filePath, modified);
      
      const result = detectDrift(filePath, original);
      
      expect(result.hasDrift).toBe(true);
    });
  });
  
  // FR-500-02: Fail CI when differences are detected
  describe('FR-500-02: CI failure', () => {
    it('should return exit code 1 when drift detected', () => {
      const results: DriftResult[] = [
        { path: 'file1.md', hasDrift: false },
        { path: 'file2.md', hasDrift: true, expectedHash: 'abc', actualHash: 'def' },
      ];
      
      const exitCode = getDriftExitCode(results);
      
      expect(exitCode).toBe(1);
    });
    
    it('should return exit code 0 when no drift', () => {
      const results: DriftResult[] = [
        { path: 'file1.md', hasDrift: false },
        { path: 'file2.md', hasDrift: false },
      ];
      
      const exitCode = getDriftExitCode(results);
      
      expect(exitCode).toBe(0);
    });
    
    it('should return exit code 1 for missing files', () => {
      const results: DriftResult[] = [
        { path: 'missing.md', hasDrift: true, missing: true },
      ];
      
      const exitCode = getDriftExitCode(results);
      
      expect(exitCode).toBe(1);
    });
  });
  
  // FR-500-03: Output message prompting to "regenerate and commit"
  describe('FR-500-03: Regeneration message', () => {
    it('should generate report with action required message', () => {
      const results: DriftResult[] = [
        { path: 'docs/test.md', hasDrift: true, expectedHash: 'abc', actualHash: 'def' },
      ];
      
      const report = generateDriftReport(results);
      
      expect(report).toContain('Action Required');
      expect(report).toContain('spects build');
      expect(report).toContain('commit');
    });
    
    it('should list drifted files in report', () => {
      const results: DriftResult[] = [
        { path: 'docs/file1.md', hasDrift: true, expectedHash: 'aaa', actualHash: 'bbb' },
        { path: 'docs/file2.md', hasDrift: true, expectedHash: 'ccc', actualHash: 'ddd' },
      ];
      
      const report = generateDriftReport(results);
      
      expect(report).toContain('`docs/file1.md`');
      expect(report).toContain('`docs/file2.md`');
    });
    
    it('should list missing files in report', () => {
      const results: DriftResult[] = [
        { path: 'docs/missing.md', hasDrift: true, missing: true },
      ];
      
      const report = generateDriftReport(results);
      
      expect(report).toContain('Missing Files');
      expect(report).toContain('`docs/missing.md`');
    });
    
    it('should show success message when no drift', () => {
      const results: DriftResult[] = [
        { path: 'docs/ok.md', hasDrift: false },
      ];
      
      const report = generateDriftReport(results);
      
      expect(report).toContain('No drift detected');
      expect(report).toContain('✅');
    });
    
    it('should warn against manual editing', () => {
      const results: DriftResult[] = [
        { path: 'docs/edited.md', hasDrift: true, expectedHash: 'a', actualHash: 'b' },
      ];
      
      const report = generateDriftReport(results);
      
      expect(report).toContain('Manual editing');
      expect(report).toContain('discouraged');
    });
  });
  
  // Additional edge case tests
  describe('Edge cases', () => {
    it('should handle empty files', () => {
      const filePath = join(testDir, 'docs', 'empty.md');
      writeFileSync(filePath, '');
      
      const result = detectDrift(filePath, '');
      
      expect(result.hasDrift).toBe(false);
    });
    
    it('should handle binary-like content in text files', () => {
      const filePath = join(testDir, 'docs', 'special.md');
      const content = 'Content with special chars: \x00\x01\x02';
      
      writeFileSync(filePath, content);
      
      const result = detectDrift(filePath, content);
      
      expect(result.hasDrift).toBe(false);
    });
    
    it('should produce consistent hashes', () => {
      const content = 'Test content for hashing';
      
      const hash1 = computeHash(content);
      const hash2 = computeHash(content);
      const hash3 = computeHash(content);
      
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
    
    it('should produce different hashes for different content', () => {
      const hash1 = computeHash('Content A');
      const hash2 = computeHash('Content B');
      
      expect(hash1).not.toBe(hash2);
    });
  });
});
