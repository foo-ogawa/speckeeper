/**
 * File Writer Tests
 * 
 * FR-301: Markdown rendering functionality - File output verification
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  ensureDir,
  writeFile,
  writeJsonFile,
  batchWriteFiles,
  computeHash,
  checkFileDrift,
  checkBatchDrift,
} from '../../src/utils/file-writer.js';

describe('FR-301: file-writer', () => {
  const testDir = join(process.cwd(), '.test-file-writer');
  
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
  
  describe('ensureDir', () => {
    it('should create directory if not exists', () => {
      const dir = join(testDir, 'new-dir', 'sub-dir');
      
      ensureDir(dir);
      
      expect(existsSync(dir)).toBe(true);
    });
    
    it('should not throw if directory exists', () => {
      mkdirSync(join(testDir, 'existing-dir'));
      
      expect(() => ensureDir(join(testDir, 'existing-dir'))).not.toThrow();
    });
  });
  
  describe('writeFile', () => {
    it('should create new file', () => {
      const filePath = join(testDir, 'new-file.txt');
      
      const result = writeFile(filePath, 'hello');
      
      expect(result.created).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.unchanged).toBe(false);
      expect(readFileSync(filePath, 'utf-8')).toBe('hello');
    });
    
    it('should update existing file with different content', () => {
      const filePath = join(testDir, 'existing-file.txt');
      writeFileSync(filePath, 'old content');
      
      const result = writeFile(filePath, 'new content');
      
      expect(result.created).toBe(false);
      expect(result.updated).toBe(true);
      expect(result.unchanged).toBe(false);
      expect(readFileSync(filePath, 'utf-8')).toBe('new content');
    });
    
    it('should not rewrite file with same content', () => {
      const filePath = join(testDir, 'same-file.txt');
      writeFileSync(filePath, 'same content');
      
      const result = writeFile(filePath, 'same content');
      
      expect(result.created).toBe(false);
      expect(result.updated).toBe(false);
      expect(result.unchanged).toBe(true);
    });
    
    it('should create parent directories', () => {
      const filePath = join(testDir, 'nested', 'dir', 'file.txt');
      
      writeFile(filePath, 'content');
      
      expect(existsSync(filePath)).toBe(true);
    });
  });
  
  describe('writeJsonFile', () => {
    it('should write JSON with indentation', () => {
      const filePath = join(testDir, 'data.json');
      
      writeJsonFile(filePath, { key: 'value' });
      
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toBe('{\n  "key": "value"\n}\n');
    });
    
    it('should write JSON with custom indentation', () => {
      const filePath = join(testDir, 'data.json');
      
      writeJsonFile(filePath, { key: 'value' }, 4);
      
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toBe('{\n    "key": "value"\n}\n');
    });
  });
  
  describe('batchWriteFiles', () => {
    it('should write multiple files', () => {
      const files = [
        { path: join(testDir, 'file1.txt'), content: 'content1' },
        { path: join(testDir, 'file2.txt'), content: 'content2' },
        { path: join(testDir, 'file3.txt'), content: 'content3' },
      ];
      
      const result = batchWriteFiles(files);
      
      expect(result.total).toBe(3);
      expect(result.created).toBe(3);
      expect(result.updated).toBe(0);
      expect(result.unchanged).toBe(0);
    });
    
    it('should report mixed results', () => {
      // Create existing files
      writeFileSync(join(testDir, 'existing1.txt'), 'old content');
      writeFileSync(join(testDir, 'existing2.txt'), 'same content');
      
      const files = [
        { path: join(testDir, 'new.txt'), content: 'new content' },
        { path: join(testDir, 'existing1.txt'), content: 'new content' },
        { path: join(testDir, 'existing2.txt'), content: 'same content' },
      ];
      
      const result = batchWriteFiles(files);
      
      expect(result.total).toBe(3);
      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.unchanged).toBe(1);
    });
  });
  
  describe('computeHash', () => {
    it('should compute consistent hash', () => {
      const hash1 = computeHash('hello world');
      const hash2 = computeHash('hello world');
      
      expect(hash1).toBe(hash2);
    });
    
    it('should compute different hash for different content', () => {
      const hash1 = computeHash('hello');
      const hash2 = computeHash('world');
      
      expect(hash1).not.toBe(hash2);
    });
    
    it('should return 16-character hash', () => {
      const hash = computeHash('test content');
      
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });
  });
  
  describe('checkFileDrift', () => {
    it('should detect no drift for matching content', () => {
      const filePath = join(testDir, 'matching.txt');
      const content = 'expected content';
      writeFileSync(filePath, content);
      
      const result = checkFileDrift(filePath, content);
      
      expect(result.hasDrift).toBe(false);
      expect(result.missing).toBeUndefined();
    });
    
    it('should detect drift for mismatching content', () => {
      const filePath = join(testDir, 'drifted.txt');
      writeFileSync(filePath, 'actual content');
      
      const result = checkFileDrift(filePath, 'expected content');
      
      expect(result.hasDrift).toBe(true);
      expect(result.missing).toBeUndefined();
      expect(result.expectedHash).not.toBe(result.actualHash);
    });
    
    it('should detect missing file', () => {
      const filePath = join(testDir, 'nonexistent.txt');
      
      const result = checkFileDrift(filePath, 'expected content');
      
      expect(result.hasDrift).toBe(true);
      expect(result.missing).toBe(true);
    });
  });
  
  describe('checkBatchDrift', () => {
    it('should check multiple files', () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1');
      writeFileSync(join(testDir, 'file2.txt'), 'content2');
      
      const files = [
        { path: join(testDir, 'file1.txt'), content: 'content1' },
        { path: join(testDir, 'file2.txt'), content: 'different' },
        { path: join(testDir, 'file3.txt'), content: 'content3' },
      ];
      
      const results = checkBatchDrift(files);
      
      expect(results).toHaveLength(3);
      expect(results[0].hasDrift).toBe(false);
      expect(results[1].hasDrift).toBe(true);
      expect(results[2].hasDrift).toBe(true);
      expect(results[2].missing).toBe(true);
    });
  });
});
