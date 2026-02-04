/**
 * Model Loader
 * 
 * Load models defined in TypeScript and convert to usable format for build command
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, extname, basename } from 'node:path';
import type { SpeckeeperConfig } from './config-loader.js';
import { registerModel as coreRegisterModel } from '../core/model.js';

// ============================================================================
// Registry Types
// ============================================================================

/**
 * Model registry - stores all loaded models
 */
export interface ModelRegistry {
  requirements: Map<string, unknown>;
  useCases: Map<string, unknown>;
  actors: Map<string, unknown>;
  components: Map<string, unknown>;
  entities: Map<string, unknown>;
  relations: Map<string, unknown>;
  rules: Map<string, unknown>;
  screens: Map<string, unknown>;
  transitions: Map<string, unknown>;
  forms: Map<string, unknown>;
  processFlows: Map<string, unknown>;
  glossaryTerms: Map<string, unknown>;
  apiRefs: Map<string, unknown>;
  tableRefs: Map<string, unknown>;
  testRefs: Map<string, unknown>;
  layers: Map<string, unknown>;
  boundaries: Map<string, unknown>;
  artifacts: Map<string, unknown>;
}

export function createEmptyRegistry(): ModelRegistry {
  return {
    requirements: new Map(),
    useCases: new Map(),
    actors: new Map(),
    components: new Map(),
    entities: new Map(),
    relations: new Map(),
    rules: new Map(),
    screens: new Map(),
    transitions: new Map(),
    forms: new Map(),
    processFlows: new Map(),
    glossaryTerms: new Map(),
    apiRefs: new Map(),
    tableRefs: new Map(),
    testRefs: new Map(),
    layers: new Map(),
    boundaries: new Map(),
    artifacts: new Map(),
  };
}

// ============================================================================
// Global Registry (shared registry for DSL functions to register to)
// ============================================================================

let globalRegistry: ModelRegistry = createEmptyRegistry();

export function getGlobalRegistry(): ModelRegistry {
  return globalRegistry;
}

export function resetGlobalRegistry(): void {
  globalRegistry = createEmptyRegistry();
}

/**
 * Function for DSL functions to register models
 */
export function registerModel(
  type: keyof ModelRegistry,
  id: string,
  model: unknown
): void {
  globalRegistry[type].set(id, model);
}

// ============================================================================
// Model Registration from Exports
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
 * Detect models from imported module exports and register to globalRegistry
 */
function registerExportedModels(module: Record<string, unknown>): void {
  for (const [exportName, exportValue] of Object.entries(module)) {
    if (!exportValue || typeof exportValue !== 'object') continue;
    
    // Detect and register Model class instances
    if (isModelInstance(exportValue)) {
      // Register to core model registry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      coreRegisterModel(exportValue as any);
      continue;
    }
    
    // Process arrays
    if (Array.isArray(exportValue)) {
      registerArrayItems(exportName, exportValue);
      continue;
    }
    
    const value = exportValue as Record<string, unknown>;
    
    // Detect ArchitectureModel (has components, layers, boundaries, relations)
    if (value.components && value.layers && value.boundaries && value.relations) {
      const arch = value as { 
        name?: string;
        components: { id?: string }[]; 
        layers: { id?: string }[]; 
        boundaries: { id?: string }[];
        relations: { id?: string }[];
      };
      for (const comp of arch.components) {
        if (comp.id) globalRegistry.components.set(comp.id, comp);
      }
      for (const layer of arch.layers) {
        if (layer.id) globalRegistry.layers.set(layer.id, layer);
      }
      for (const boundary of arch.boundaries) {
        if (boundary.id) globalRegistry.boundaries.set(boundary.id, boundary);
      }
      for (const rel of arch.relations) {
        if (rel.id) globalRegistry.relations.set(rel.id, rel);
      }
      continue;
    }
    
    // Detect ConceptModel (has entities, relations, rules)
    if (value.entities && value.relations && Array.isArray(value.entities)) {
      const concept = value as { 
        entities: { id?: string }[]; 
        relations: { id?: string }[];
        rules?: { id?: string }[];
      };
      for (const entity of concept.entities) {
        if (entity.id) globalRegistry.entities.set(entity.id, entity);
      }
      for (const rel of concept.relations) {
        if (rel.id) globalRegistry.relations.set(rel.id, rel);
      }
      for (const rule of concept.rules || []) {
        if (rule.id) globalRegistry.rules.set(rule.id, rule);
      }
      continue;
    }
    
    // Detect UseCaseModel (has useCases, actors)
    if (value.useCases && value.actors) {
      const ucModel = value as { 
        useCases: { id?: string }[]; 
        actors: { id?: string }[];
      };
      for (const uc of ucModel.useCases) {
        if (uc.id) globalRegistry.useCases.set(uc.id, uc);
      }
      for (const actor of ucModel.actors) {
        if (actor.id) globalRegistry.actors.set(actor.id, actor);
      }
      continue;
    }
    
    // Detect Glossary (array with terms or {terms: []} format)
    if (value.terms && Array.isArray(value.terms)) {
      const glossary = value as { terms: { id?: string }[] };
      for (const term of glossary.terms) {
        if (term.id) globalRegistry.glossaryTerms.set(term.id, term);
      }
      continue;
    }
    
    // Detect single Requirement
    if (value.id && value.title && (value.kind || value.type || value.acceptance)) {
      globalRegistry.requirements.set(value.id as string, value);
      continue;
    }
    
    // Detect single Entity
    if (value.id && value.name && value.attributes && Array.isArray(value.attributes)) {
      globalRegistry.entities.set(value.id as string, value);
      continue;
    }
    
    // Detect single UseCase
    if (value.id && value.name && value.actor && value.mainFlow) {
      globalRegistry.useCases.set(value.id as string, value);
      continue;
    }
    
    // Detect single Actor
    if (value.id && value.name && value.type && ['human', 'system', 'external'].includes(value.type as string)) {
      globalRegistry.actors.set(value.id as string, value);
      continue;
    }
    
    // Detect single Term
    if (value.id && (value.term || value.abbreviation) && value.definition) {
      globalRegistry.glossaryTerms.set(value.id as string, value);
      continue;
    }
  }
}

/**
 * Detect items from array and register to registry
 */
function registerArrayItems(exportName: string, items: unknown[]): void {
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (!obj.id || typeof obj.id !== 'string') continue;
    
    // Infer type from export name or object structure
    // requirements / allRequirements / functionalRequirements etc.
    if (exportName.toLowerCase().includes('requirement') || 
        exportName.toLowerCase().includes('constraints') ||
        (obj.type && obj.acceptanceCriteria)) {
      globalRegistry.requirements.set(obj.id, item);
      continue;
    }
    
    // useCases / usecases
    if (exportName.toLowerCase().includes('usecase') || 
        (obj.actor && obj.mainFlow)) {
      globalRegistry.useCases.set(obj.id, item);
      continue;
    }
    
    // actors
    if (exportName.toLowerCase().includes('actor') ||
        (obj.type && ['human', 'system', 'external'].includes(obj.type as string) && !obj.mainFlow)) {
      globalRegistry.actors.set(obj.id, item);
      continue;
    }
    
    // components / containers
    if (exportName.toLowerCase().includes('component') ||
        exportName.toLowerCase().includes('container') ||
        (obj.type && ['person', 'system', 'container', 'component'].includes(obj.type as string))) {
      globalRegistry.components.set(obj.id, item);
      continue;
    }
    
    // entities
    if (exportName.toLowerCase().includes('entit') ||
        (obj.name && obj.attributes && Array.isArray(obj.attributes))) {
      globalRegistry.entities.set(obj.id, item);
      continue;
    }
    
    // terms / acronyms / glossary
    if (exportName.toLowerCase().includes('term') ||
        exportName.toLowerCase().includes('acronym') ||
        exportName.toLowerCase().includes('glossary') ||
        (obj.term && obj.definition)) {
      globalRegistry.glossaryTerms.set(obj.id, item);
      continue;
    }
    
    // relations
    if (exportName.toLowerCase().includes('relation') ||
        (obj.from && obj.to && obj.label)) {
      globalRegistry.relations.set(obj.id, item);
      continue;
    }
    
    // layers
    if (exportName.toLowerCase().includes('layer') ||
        (obj.name && typeof obj.order === 'number')) {
      globalRegistry.layers.set(obj.id, item);
      continue;
    }
    
    // boundaries
    if (exportName.toLowerCase().includes('boundar') ||
        (obj.type && ['system', 'context', 'container', 'deployment'].includes(obj.type as string) && obj.description)) {
      globalRegistry.boundaries.set(obj.id, item);
      continue;
    }
    
    // screens
    if (exportName.toLowerCase().includes('screen') ||
        (obj.type && ['page', 'modal', 'drawer', 'panel', 'wizard'].includes(obj.type as string) && obj.auth)) {
      globalRegistry.screens.set(obj.id, item);
      continue;
    }
    
    // testRefs
    if (exportName.toLowerCase().includes('testref') ||
        exportName.toLowerCase().includes('test-ref') ||
        (obj.source && obj.verifiesRequirements && Array.isArray(obj.verifiesRequirements))) {
      globalRegistry.testRefs.set(obj.id, item);
      continue;
    }
    
    // artifacts
    if (exportName.toLowerCase().includes('artifact') ||
        (obj.category && obj.location && obj.purpose &&
         ['ssot', 'human-readable', 'machine-readable', 'implementation'].includes(obj.category as string))) {
      globalRegistry.artifacts.set(obj.id, item);
      continue;
    }
  }
}

// ============================================================================
// Model Loading
// ============================================================================

/**
 * Dynamically import TS files from specified directory and collect models
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
      // Target .ts, .js, .mts, .mjs files
      if (['.ts', '.js', '.mts', '.mjs'].includes(ext) && !entry.endsWith('.d.ts')) {
        // Exclude index.ts (possibly a re-export file)
        if (basename(entry, ext) === 'index') {
          continue;
        }
        
        try {
          // Dynamic import
          const module = await import(fullPath);
          loadedFiles.push(fullPath);
          
          // Register exported models to globalRegistry
          registerExportedModels(module);
        } catch (error) {
          console.error(`Failed to load model from ${fullPath}:`, error);
        }
      }
    }
  }
  
  return loadedFiles;
}

/**
 * Load all models based on configuration
 */
export async function loadAllModels(
  config: SpeckeeperConfig,
  cwd: string = process.cwd()
): Promise<{
  registry: ModelRegistry;
  loadedFiles: string[];
  errors: Array<{ file: string; error: unknown }>;
}> {
  // Reset registry
  resetGlobalRegistry();
  
  const loadedFiles: string[] = [];
  const errors: Array<{ file: string; error: unknown }> = [];
  
  // Load from design/ directory (compliant with spec section 7.1)
  const designDir = resolve(cwd, config.designDir || 'design');
  
  // Standard directory structure (compliant with spec section 7.1)
  const modelDirs = [
    { path: join(designDir, 'requirements') },
    { path: join(designDir, 'usecases') },
    { path: join(designDir, 'architecture') },
    { path: join(designDir, 'data-model') },
    { path: join(designDir, 'screens') },
    { path: join(designDir, 'flows') },
    { path: join(designDir, 'glossary') },
    // Also load files directly under design/ by default (index.ts, etc.)
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
  
  return {
    registry: getGlobalRegistry(),
    loadedFiles,
    errors,
  };
}

// ============================================================================
// Registry Helpers
// ============================================================================

/**
 * Get registry statistics
 */
export function getRegistryStats(registry: ModelRegistry): Record<string, number> {
  const stats: Record<string, number> = {};
  
  for (const [key, map] of Object.entries(registry)) {
    stats[key] = (map as Map<string, unknown>).size;
  }
  
  return stats;
}

/**
 * Get all IDs in registry
 */
export function getAllIds(registry: ModelRegistry): Set<string> {
  const allIds = new Set<string>();
  
  for (const map of Object.values(registry)) {
    for (const id of (map as Map<string, unknown>).keys()) {
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
): keyof ModelRegistry | null {
  for (const [type, map] of Object.entries(registry)) {
    if ((map as Map<string, unknown>).has(id)) {
      return type as keyof ModelRegistry;
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
): { type: keyof ModelRegistry; model: unknown } | null {
  const type = findModelType(registry, id);
  if (!type) return null;
  
  return {
    type,
    model: registry[type].get(id),
  };
}
