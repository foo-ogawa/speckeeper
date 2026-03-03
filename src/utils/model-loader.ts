/**
 * Model Loader
 * 
 * Load models and specs from design/ directory.
 * Spec registration is done explicitly via Model.register() in each spec file.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, extname, basename } from 'node:path';
import type { SpeckeeperConfig } from './config-loader.js';
import {
  registerModel as coreRegisterModel,
  clearModelRegistry,
  getSpecStore,
  resetSpecStore,
} from '../core/model.js';

// ============================================================================
// Registry Types
// ============================================================================

/**
 * Model registry - stores all loaded spec data.
 * Keys are model IDs (e.g. 'functional-requirement', 'usecase').
 * Values are Maps of spec ID -> spec data.
 */
export type ModelRegistry = Record<string, Map<string, unknown>>;

// ============================================================================
// Model Instance Detection
// ============================================================================

/**
 * Determine if value is a Model class instance
 */
function isModelInstance(value: unknown): value is { id: string; name: string; idPrefix: string; schema: unknown } {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.idPrefix === 'string' &&
    obj.schema !== undefined &&
    typeof obj.validate === 'function' &&
    typeof obj.lint === 'function'
  );
}

/**
 * Detect and register Model class instances from module exports.
 * Only registers Model instances to the core model registry.
 * Spec data registration is handled by Model.register() calls in spec files.
 */
function registerExportedModelInstances(module: Record<string, unknown>): void {
  for (const [, exportValue] of Object.entries(module)) {
    if (!exportValue || typeof exportValue !== 'object') continue;
    if (isModelInstance(exportValue)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      coreRegisterModel(exportValue as any);
    }
  }
}

// ============================================================================
// File Loading
// ============================================================================

/**
 * Dynamically import TS files from specified directory.
 * Model class instances found in exports are registered to core registry.
 * Spec data is registered via Model.register() side effects during import.
 */
export async function loadModelsFromDirectory(
  dirPath: string,
  options: { recursive?: boolean } = {}
): Promise<string[]> {
  const loadedFiles: string[] = [];

  if (!existsSync(dirPath)) {
    return loadedFiles;
  }

  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && options.recursive) {
      const subFiles = await loadModelsFromDirectory(fullPath, options);
      loadedFiles.push(...subFiles);
    } else if (stat.isFile()) {
      const ext = extname(entry);
      if (['.ts', '.js', '.mts', '.mjs'].includes(ext) && !entry.endsWith('.d.ts')) {
        if (basename(entry, ext) === 'index') {
          continue;
        }

        try {
          const module = await import(fullPath);
          loadedFiles.push(fullPath);
          registerExportedModelInstances(module);
        } catch (error) {
          console.error(`Failed to load from ${fullPath}:`, error);
        }
      }
    }
  }

  return loadedFiles;
}

/**
 * Load all models and specs based on configuration.
 * 
 * 1. Reset spec store and model registry
 * 2. Register Model class instances from config.models
 * 3. Scan design/ files (triggers Model.register() calls as side effects)
 * 4. Build registry from specStore
 */
export async function loadAllModels(
  config: SpeckeeperConfig,
  cwd: string = process.cwd()
): Promise<{
  registry: ModelRegistry;
  loadedFiles: string[];
  errors: Array<{ file: string; error: unknown }>;
}> {
  resetSpecStore();
  clearModelRegistry();

  const loadedFiles: string[] = [];
  const errors: Array<{ file: string; error: unknown }> = [];

  // Register Model class instances from config.models first
  if (config.models && Array.isArray(config.models)) {
    for (const model of config.models) {
      if (isModelInstance(model)) {
        coreRegisterModel(model as Parameters<typeof coreRegisterModel>[0]);
      }
    }
  }

  const designDir = resolve(cwd, config.designDir || 'design');

  const modelDirs = [
    { path: join(designDir, '_models') },
    { path: join(designDir, 'requirements') },
    { path: join(designDir, 'usecases') },
    { path: join(designDir, 'architecture') },
    { path: join(designDir, 'data-model') },
    { path: join(designDir, 'screens') },
    { path: join(designDir, 'flows') },
    { path: join(designDir, 'glossary') },
    { path: designDir },
  ];

  for (const { path: dirPath } of modelDirs) {
    if (!existsSync(dirPath)) {
      continue;
    }

    try {
      const files = await loadModelsFromDirectory(dirPath, { recursive: true });
      loadedFiles.push(...files);
    } catch (error) {
      errors.push({ file: dirPath, error });
    }
  }

  // Build registry from specStore (populated by Model.register() calls)
  const store = getSpecStore();
  const registry: ModelRegistry = {};
  for (const [modelId, specMap] of store) {
    registry[modelId] = specMap;
  }

  return {
    registry,
    loadedFiles,
    errors,
  };
}

// ============================================================================
// Registry Helpers
// ============================================================================

/**
 * Get specs from registry for a given model ID
 */
export function getSpecsFromRegistry(registry: ModelRegistry, modelId: string): unknown[] {
  const map = registry[modelId];
  if (!map) return [];
  return Array.from(map.values());
}

/**
 * Get registry statistics
 */
export function getRegistryStats(registry: ModelRegistry): Record<string, number> {
  const stats: Record<string, number> = {};

  for (const [key, map] of Object.entries(registry)) {
    stats[key] = map.size;
  }

  return stats;
}

/**
 * Get all IDs in registry
 */
export function getAllIds(registry: ModelRegistry): Set<string> {
  const allIds = new Set<string>();

  for (const map of Object.values(registry)) {
    for (const id of map.keys()) {
      allIds.add(id);
    }
  }

  return allIds;
}

/**
 * Identify model type from ID
 */
export function findModelType(
  registry: ModelRegistry,
  id: string
): string | null {
  for (const [type, map] of Object.entries(registry)) {
    if (map.has(id)) {
      return type;
    }
  }
  return null;
}

/**
 * Get model by ID
 */
export function getModelById(
  registry: ModelRegistry,
  id: string
): { type: string; model: unknown } | null {
  const type = findModelType(registry, id);
  if (!type) return null;

  return {
    type,
    model: registry[type].get(id),
  };
}
