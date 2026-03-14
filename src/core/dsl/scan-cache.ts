import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  mkdirSync,
  appendFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { glob } from 'glob';
import type { ArtifactConfig } from '../config-api.js';

export interface ScanCacheEntry {
  mtime: number;
  size: number;
  annotations: Array<{
    specId: string;
    line: number;
    relationType: 'verifiedBy' | 'implements' | 'traces';
  }>;
}

export interface ScanCacheData {
  version: number;
  configHash: string;
  files: Record<string, ScanCacheEntry>;
}

const CACHE_VERSION = 1;
const CACHE_DIR = '.speckeeper';
const CACHE_FILE = 'scan-cache.json';

type RelationType = 'verifiedBy' | 'implements' | 'traces';

function serializeForHash(config: Record<string, ArtifactConfig>): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(config).sort()) {
    const ac = config[key];
    const serialized: Record<string, unknown> = {
      globs: [...(ac.globs ?? [])].sort(),
      exclude: ac.exclude ? [...ac.exclude].sort() : undefined,
      contentPatterns: ac.contentPatterns?.map((r) => ({
        source: r.source,
        flags: r.flags,
      })),
    };
    sorted[key] = serialized;
  }
  return JSON.stringify(sorted);
}

export function computeConfigHash(
  artifactsConfig: Record<string, ArtifactConfig>,
): string {
  const hash = createHash('sha256');
  hash.update(serializeForHash(artifactsConfig));
  return hash.digest('hex').slice(0, 16);
}

export function loadScanCache(basePath: string): ScanCacheData | null {
  const cachePath = join(basePath, CACHE_DIR, CACHE_FILE);
  if (!existsSync(cachePath)) return null;
  try {
    const raw = readFileSync(cachePath, 'utf-8');
    const data = JSON.parse(raw) as ScanCacheData;
    if (data.version !== CACHE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveScanCache(
  basePath: string,
  cache: ScanCacheData,
): void {
  const dir = join(basePath, CACHE_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const cachePath = join(dir, CACHE_FILE);
  writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');

  const gitignorePath = join(basePath, '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    const entry = `${CACHE_DIR}/`;
    if (!content.includes(entry)) {
      const line = content.endsWith('\n') ? `${entry}\n` : `\n${entry}\n`;
      appendFileSync(gitignorePath, line);
    }
  }
}

function extractSpecIds(captureGroup: string): string[] {
  return captureGroup
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getCachedOrScan(
  filePath: string,
  basePath: string,
  cache: ScanCacheData | null,
  patterns: RegExp[],
  relationType: RelationType,
): { entry: ScanCacheEntry; fromCache: boolean } {
  const fullPath = join(basePath, filePath);
  let stat: { mtimeMs: number; size: number };
  try {
    const s = statSync(fullPath);
    stat = { mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    return {
      entry: { mtime: 0, size: 0, annotations: [] },
      fromCache: false,
    };
  }

  const cached = cache?.files[filePath];
  if (
    cached &&
    cached.mtime === stat.mtimeMs &&
    cached.size === stat.size
  ) {
    return { entry: cached, fromCache: true };
  }

  let content: string;
  try {
    content = readFileSync(fullPath, 'utf-8');
  } catch {
    return {
      entry: { mtime: stat.mtimeMs, size: stat.size, annotations: [] },
      fromCache: false,
    };
  }

  const annotations: ScanCacheEntry['annotations'] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (!match || match.length < 2) continue;
      const capture = match[1];
      if (capture == null) continue;
      const ids = extractSpecIds(capture);
      for (const specId of ids) {
        annotations.push({ specId, line: lineNum, relationType });
      }
    }
  }

  return {
    entry: {
      mtime: stat.mtimeMs,
      size: stat.size,
      annotations,
    },
    fromCache: false,
  };
}

export interface ScanWithCacheOptions {
  basePath: string;
  artifactName: string;
  globs: string[];
  exclude?: string[];
  contentPatterns: RegExp[];
  relationType: RelationType;
  configHash: string;
  noCache?: boolean;
}

export interface ScanResult {
  matches: Array<{
    specId: string;
    filePath: string;
    line: number;
    relationType: RelationType;
  }>;
  stats: {
    totalFiles: number;
    cachedFiles: number;
    scannedFiles: number;
  };
}

export function scanFilesWithCache(
  options: ScanWithCacheOptions,
): ScanResult {
  const {
    basePath,
    globs,
    exclude,
    contentPatterns,
    relationType,
    configHash,
    noCache = false,
  } = options;

  let cache: ScanCacheData | null = null;
  if (!noCache) {
    cache = loadScanCache(basePath);
    if (cache && cache.configHash !== configHash) {
      cache = null;
    }
  }

  const globOptions: { cwd: string; ignore?: string[] } = { cwd: basePath };
  if (exclude && exclude.length > 0) {
    globOptions.ignore = exclude;
  }

  const allPaths = new Set<string>();
  for (const pattern of globs) {
    const matches = glob.sync(pattern, globOptions);
    for (const p of matches) {
      allPaths.add(p);
    }
  }

  const fileList = [...allPaths];
  const matches: ScanResult['matches'] = [];
  let cachedCount = 0;
  let scannedCount = 0;

  const newFiles: Record<string, ScanCacheEntry> = {};

  for (const filePath of fileList) {
    const { entry, fromCache } = getCachedOrScan(
      filePath,
      basePath,
      cache,
      contentPatterns,
      relationType,
    );

    if (fromCache) {
      cachedCount++;
    } else {
      scannedCount++;
    }

    newFiles[filePath] = entry;

    for (const a of entry.annotations) {
      matches.push({
        specId: a.specId,
        filePath,
        line: a.line,
        relationType: a.relationType,
      });
    }
  }

  const newCache: ScanCacheData = {
    version: CACHE_VERSION,
    configHash,
    files: newFiles,
  };

  if (!noCache) {
    saveScanCache(basePath, newCache);
  }

  return {
    matches,
    stats: {
      totalFiles: fileList.length,
      cachedFiles: cachedCount,
      scannedFiles: scannedCount,
    },
  };
}
