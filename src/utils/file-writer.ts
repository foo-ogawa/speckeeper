import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

// ============================================================================
// File Writing
// ============================================================================

export interface WriteResult {
  path: string;
  created: boolean;
  updated: boolean;
  unchanged: boolean;
}

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function writeFile(filePath: string, content: string): WriteResult {
  const dir = dirname(filePath);
  ensureDir(dir);
  
  const existed = existsSync(filePath);
  let unchanged = false;
  
  if (existed) {
    const existingContent = readFileSync(filePath, 'utf-8');
    unchanged = existingContent === content;
  }
  
  if (!unchanged) {
    writeFileSync(filePath, content, 'utf-8');
  }
  
  return {
    path: filePath,
    created: !existed,
    updated: existed && !unchanged,
    unchanged,
  };
}

export function writeJsonFile(filePath: string, data: unknown, indent: number = 2): WriteResult {
  const content = JSON.stringify(data, null, indent) + '\n';
  return writeFile(filePath, content);
}

// ============================================================================
// Batch Writing
// ============================================================================

export interface BatchWriteResult {
  results: WriteResult[];
  created: number;
  updated: number;
  unchanged: number;
  total: number;
}

export function batchWriteFiles(
  files: Array<{ path: string; content: string }>
): BatchWriteResult {
  const results: WriteResult[] = [];
  
  for (const { path, content } of files) {
    results.push(writeFile(path, content));
  }
  
  return {
    results,
    created: results.filter(r => r.created).length,
    updated: results.filter(r => r.updated).length,
    unchanged: results.filter(r => r.unchanged).length,
    total: results.length,
  };
}

// ============================================================================
// Drift Detection
// ============================================================================

export interface DriftResult {
  file: string;
  hasDrift: boolean;
  expectedHash?: string;
  actualHash?: string;
  missing?: boolean;
}

export function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export function checkFileDrift(
  filePath: string,
  expectedContent: string
): DriftResult {
  const expectedHash = computeHash(expectedContent);
  
  if (!existsSync(filePath)) {
    return {
      file: filePath,
      hasDrift: true,
      expectedHash,
      missing: true,
    };
  }
  
  const actualContent = readFileSync(filePath, 'utf-8');
  const actualHash = computeHash(actualContent);
  
  return {
    file: filePath,
    hasDrift: expectedHash !== actualHash,
    expectedHash,
    actualHash,
  };
}

export function checkBatchDrift(
  files: Array<{ path: string; content: string }>
): DriftResult[] {
  return files.map(({ path, content }) => checkFileDrift(path, content));
}

// ============================================================================
// File Discovery
// ============================================================================

import { glob } from 'glob';

export async function findFiles(
  pattern: string,
  cwd: string = process.cwd()
): Promise<string[]> {
  return glob(pattern, { cwd, absolute: true });
}

export async function findTypeScriptFiles(
  srcDir: string
): Promise<string[]> {
  return findFiles('**/*.ts', srcDir);
}

export async function findDefinitionFiles(
  srcDir: string,
  subDir: string
): Promise<string[]> {
  const pattern = join(srcDir, subDir, '**/*.ts');
  return glob(pattern, { absolute: true, ignore: ['**/*.d.ts', '**/index.ts'] });
}

// ============================================================================
// Output Helpers
// ============================================================================

export function generateDocsPath(
  baseDir: string,
  category: string,
  filename: string
): string {
  return join(baseDir, category, filename);
}

export function generateSpecsPath(
  baseDir: string,
  category: string,
  filename: string
): string {
  return join(baseDir, category, filename);
}
