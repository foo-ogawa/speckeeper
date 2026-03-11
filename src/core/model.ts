/**
 * Model base class
 * 
 * All model definitions inherit from this class
 */
import { z, ZodType } from 'zod';
import {
  type ModelLevel,
  type Relation,
  type RelationValidationError,
  validateRelationLevel,
  detectCycles,
  inferModelIdFromSpecId,
} from './relation.js';

// Re-export relation types
export type { ModelLevel, Relation, RelationValidationError };
export { RELATION_TYPES, RELATION_CONSTRAINTS, RelationSchema, RelationsFieldSchema } from './relation.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Lint rule definition
 */
export interface LintRule<T> {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  check: (spec: T) => boolean; // true if there is an issue
}

/**
 * Lint result
 */
export interface LintResult {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  specId?: string;
}

/**
 * Exporter definition
 */
export interface Exporter<T> {
  format: 'markdown' | 'json' | 'mermaid';
  single?: (spec: T) => string;
  index?: (specs: T[]) => string;
  /** Subdirectory under docsDir (used with single + index/index.md) */
  outputDir?: string;
  /** Direct output file path relative to docsDir (used with index-only exporters) */
  outputFile?: string;
  filename?: (spec: T) => string;
}

/**
 * External checker definition
 */
export interface ExternalChecker<T> {
  targetType: string; // 'openapi' | 'ddl' | 'cli' etc.
  sourcePath: (spec: T) => string;
  check: (spec: T, externalData: unknown) => CheckResult;
}

/**
 * Check result
 */
export interface CheckResult {
  success: boolean;
  errors: { message: string; field?: string; specId?: string }[];
  warnings: { message: string; field?: string; specId?: string }[];
}

/**
 * Coverage result
 */
export interface CoverageResult {
  /** Total target count */
  total: number;
  /** Covered count */
  covered: number;
  /** Uncovered count */
  uncovered: number;
  /** Coverage rate (%) */
  coveragePercent: number;
  /** Details of covered items */
  coveredItems: { id: string; description?: string }[];
  /** Details of uncovered items */
  uncoveredItems: { id: string; description?: string; sourceId?: string }[];
}

/**
 * Coverage checker definition
 * 
 * Verify cross-model consistency (coverage).
 * Example: Whether TestRef covers acceptanceCriteria of Requirement
 */
export interface CoverageChecker<T> {
  /** Target model ID for coverage (e.g. 'requirement') */
  targetModel: string;
  /** Description of coverage check */
  description: string;
  /** Execute coverage check */
  check: (
    specs: T[],
    registry: Record<string, Map<string, unknown>>
  ) => CoverageResult;
}

// ============================================================================
// Renderer (for embeds)
// ============================================================================

/**
 * Render context
 * Simplified version compatible with embedoc's EmbedContext
 */
export interface RenderContext {
  /** Parameters (filter conditions other than format, etc.) */
  params: Record<string, string | undefined>;
  /** Markdown helpers */
  markdown: {
    /** Generate table */
    table: (headers: string[], rows: (string | unknown)[][]) => string;
  };
}

/**
 * Renderer definition
 * 
 * Model-specific rendering called from embeds
 */
export interface Renderer<T> {
  /** Format ID ('table', 'list', 'detail', 'spec-chapter', etc.) */
  format: string;
  /** Rendering process */
  render: (specs: T[], ctx: RenderContext) => string;
}

// ============================================================================
// Model Base Class
// ============================================================================

/**
 * Model base class
 * 
 * @template TSchema - Zod schema type
 */
export abstract class Model<TSchema extends ZodType> {
  /** Singleton instance storage (per subclass) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static _instances: WeakMap<new () => any, Model<ZodType>> = new WeakMap();

  /**
   * Get singleton instance of the model
   * Usage: RequirementModel.instance
   */
  static get instance(): Model<ZodType> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctor = this as unknown as new () => any;
    if (!this._instances.has(ctor)) {
      this._instances.set(ctor, new ctor());
    }
    return this._instances.get(ctor)!;
  }

  /** Model ID ('requirement', 'usecase', etc.) */
  abstract readonly id: string;
  
  /** Model name ('Requirement', 'UseCase', etc.) */
  abstract readonly name: string;
  
  /** ID prefix ('REQ', 'UC', etc.) */
  abstract readonly idPrefix: string;
  
  /** Zod schema */
  abstract readonly schema: TSchema;
  
  /** Model description (optional) */
  readonly description?: string;
  
  /** External SSOT type (optional, e.g. 'OpenAPI', 'DDL/Prisma') */
  readonly externalSsotType?: string;
  
  /** Spec instance type */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get specType(): z.infer<TSchema> { return undefined as any; }
  
  /** Lint rules (override in subclass) */
  protected lintRules: LintRule<z.infer<TSchema>>[] = [];
  
  /** Exporters (override in subclass) */
  protected exporters: Exporter<z.infer<TSchema>>[] = [];
  
  /** External checker (optional) */
  protected externalChecker?: ExternalChecker<z.infer<TSchema>>;
  
  /** Coverage checker (optional) */
  protected coverageChecker?: CoverageChecker<z.infer<TSchema>>;
  
  /** Model level (set in _models/) */
  protected modelLevel?: ModelLevel;
  
  /** Renderers (for embeds, override in subclass) */
  protected renderers: Renderer<z.infer<TSchema>>[] = [];
  
  /**
   * Get model level
   * Returns modelLevel set in _models/
   */
  get level(): ModelLevel | undefined {
    return this.modelLevel;
  }
  
  /**
   * Execute schema validation
   */
  validate(spec: unknown): z.infer<TSchema> {
    return this.schema.parse(spec);
  }
  
  /**
   * Schema validation (safe version, returns error object on failure)
   */
  safeParse(spec: unknown): { success: true; data: z.infer<TSchema> } | { success: false; error: z.ZodError } {
    return this.schema.safeParse(spec);
  }
  
  /**
   * Execute lint
   */
  lint(spec: z.infer<TSchema>): LintResult[] {
    const specId = (spec as { id?: string }).id;
    return this.lintRules
      .filter(rule => rule.check(spec))
      .map(rule => ({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.message,
        specId,
      }));
  }
  
  /**
   * Execute lint for multiple specs
   */
  lintAll(specs: z.infer<TSchema>[]): LintResult[] {
    return specs.flatMap(spec => this.lint(spec));
  }
  
  /**
   * Validate level constraints of relations
   * @param spec - Spec instance (if it has relations property)
   * @returns Array of validation errors
   */
  validateRelations(spec: z.infer<TSchema>): RelationValidationError[] {
    const errors: RelationValidationError[] = [];
    const specWithRelations = spec as { id?: string; relations?: Relation[] };
    
    if (!specWithRelations.relations || !specWithRelations.id) {
      return errors;
    }
    
    // Get all models to retrieve target model levels
    const allModels = getAllModels();
    const modelLevelMap = new Map<string, ModelLevel | undefined>();
    for (const model of allModels) {
      modelLevelMap.set(model.id, model.level);
    }
    
    for (const relation of specWithRelations.relations) {
      // Infer target model ID
      const targetModelId = inferModelIdFromSpecId(relation.target);
      if (!targetModelId) {
        continue; // Skip if model ID cannot be inferred
      }
      
      const targetLevel = modelLevelMap.get(targetModelId);
      
      const error = validateRelationLevel(
        this.level,
        specWithRelations.id,
        relation,
        targetLevel,
      );
      
      if (error) {
        errors.push(error);
      }
    }
    
    return errors;
  }
  
  /**
   * Validate relations of multiple specs (including circular reference check)
   */
  validateAllRelations(specs: z.infer<TSchema>[]): RelationValidationError[] {
    const errors: RelationValidationError[] = [];
    const allRelations: Array<{ sourceId: string; targetId: string; type: string }> = [];
    
    for (const spec of specs) {
      // Individual level constraint check
      errors.push(...this.validateRelations(spec));
      
      // Collect relations for circular reference check
      const specWithRelations = spec as { id?: string; relations?: Relation[] };
      if (specWithRelations.relations && specWithRelations.id) {
        for (const rel of specWithRelations.relations) {
          allRelations.push({
            sourceId: specWithRelations.id,
            targetId: rel.target,
            type: rel.type,
          });
        }
      }
    }
    
    // Circular reference check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errors.push(...detectCycles(allRelations as any));
    
    return errors;
  }
  
  /**
   * Export in specified format (single spec)
   */
  exportSingle(spec: z.infer<TSchema>, format: string): string | null {
    const exporter = this.exporters.find(e => e.format === format);
    if (!exporter?.single) return null;
    return exporter.single(spec);
  }
  
  /**
   * Export in specified format (index)
   */
  exportIndex(specs: z.infer<TSchema>[], format: string): string | null {
    const exporter = this.exporters.find(e => e.format === format);
    if (!exporter?.index) return null;
    return exporter.index(specs);
  }
  
  /**
   * Get exporter output directory
   */
  getOutputDir(format: string): string | null {
    const exporter = this.exporters.find(e => e.format === format);
    return exporter?.outputDir ?? null;
  }
  
  /**
   * Get filename
   */
  getFilename(spec: z.infer<TSchema>, format: string): string | null {
    const exporter = this.exporters.find(e => e.format === format);
    if (!exporter?.filename) return null;
    return exporter.filename(spec);
  }
  
  /**
   * Check consistency with external SSOT
   */
  check(spec: z.infer<TSchema>, externalData: unknown): CheckResult {
    if (!this.externalChecker) {
      return { success: true, errors: [], warnings: [] };
    }
    return this.externalChecker.check(spec, externalData);
  }
  
  /**
   * Get external SSOT path
   */
  getExternalSourcePath(spec: z.infer<TSchema>): string | null {
    if (!this.externalChecker) return null;
    return this.externalChecker.sourcePath(spec);
  }
  
  /**
   * Execute coverage check
   * @param specs - Array of spec instances for this model
   * @param registry - Registry of all models
   */
  checkCoverage(
    specs: z.infer<TSchema>[],
    registry: Record<string, Map<string, unknown>>
  ): CoverageResult | null {
    if (!this.coverageChecker) return null;
    return this.coverageChecker.check(specs, registry);
  }
  
  /**
   * Get coverage checker
   */
  getCoverageChecker(): CoverageChecker<z.infer<TSchema>> | undefined {
    return this.coverageChecker;
  }
  
  /**
   * Get lint rules
   */
  getLintRules(): LintRule<z.infer<TSchema>>[] {
    return this.lintRules;
  }
  
  /**
   * Get exporters
   */
  getExporters(): Exporter<z.infer<TSchema>>[] {
    return this.exporters;
  }
  
  // ============================================================================
  // Renderer (for embeds)
  // ============================================================================
  
  /**
   * Render in specified format
   * @param format - Format ID ('table', 'list', 'detail', etc.)
   * @param specs - Array of specs to render
   * @param ctx - Render context
   * @returns Rendered result (Markdown string), null if no matching renderer
   */
  render(format: string, specs: z.infer<TSchema>[], ctx: RenderContext): string | null {
    const renderer = this.renderers.find(r => r.format === format);
    if (!renderer) return null;
    return renderer.render(specs, ctx);
  }
  
  /**
   * Get list of available formats
   */
  getAvailableFormats(): string[] {
    return this.renderers.map(r => r.format);
  }
  
  /**
   * Get renderers
   */
  getRenderers(): Renderer<z.infer<TSchema>>[] {
    return this.renderers;
  }
  
  /**
   * Check if renderer exists for specific format
   */
  hasRenderer(format: string): boolean {
    return this.renderers.some(r => r.format === format);
  }
  
  /**
   * Register spec instances for this model.
   * Stores specs in the global specStore keyed by this model's id.
   */
  register(specs: z.infer<TSchema>[]): void {
    if (!specStore.has(this.id)) {
      specStore.set(this.id, new Map());
    }
    const map = specStore.get(this.id)!;
    for (const spec of specs) {
      map.set((spec as { id: string }).id, spec);
    }
  }
}

// ============================================================================
// Spec Store
// ============================================================================

const specStore = new Map<string, Map<string, unknown>>();

/**
 * Get the global spec store (model ID → spec ID → spec data)
 */
export function getSpecStore(): Map<string, Map<string, unknown>> {
  return specStore;
}

/**
 * Reset the spec store (clears all registered specs)
 */
export function resetSpecStore(): void {
  specStore.clear();
}

// ============================================================================
// Model Registry
// ============================================================================

/** Map of registered models */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelRegistry = new Map<string, Model<any>>();

/**
 * Register model
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerModel(model: Model<any>): void {
  modelRegistry.set(model.id, model);
}

/**
 * Get model
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModel(id: string): Model<any> | undefined {
  return modelRegistry.get(id);
}

/**
 * Get all registered models
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAllModels(): Model<any>[] {
  return Array.from(modelRegistry.values());
}

/**
 * Clear registry
 */
export function clearModelRegistry(): void {
  modelRegistry.clear();
}

/**
 * Register model instances from config.models array.
 * Filters out non-Model values. Call this once after config is loaded.
 */
export function registerModelsFromConfig(models: unknown[]): void {
  for (const model of models) {
    if (model && typeof model === 'object' && 'id' in model && 'schema' in model) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registerModel(model as Model<any>);
    }
  }
}

/**
 * Get specs for a given model ID from specStore
 */
export function getSpecs(modelId: string): unknown[] {
  const map = specStore.get(modelId);
  if (!map) return [];
  return Array.from(map.values());
}

/**
 * Get all spec IDs across all models
 */
export function getAllSpecIds(): Set<string> {
  const ids = new Set<string>();
  for (const map of specStore.values()) {
    for (const id of map.keys()) {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * Find which model type a spec ID belongs to
 */
export function findModelTypeBySpecId(specId: string): string | null {
  for (const [modelId, map] of specStore) {
    if (map.has(specId)) return modelId;
  }
  return null;
}

/**
 * Get a spec by ID (searches all models)
 */
export function getSpecById(specId: string): { modelId: string; spec: unknown } | null {
  const modelId = findModelTypeBySpecId(specId);
  if (!modelId) return null;
  return { modelId, spec: specStore.get(modelId)!.get(specId) };
}

// ============================================================================
// SpecModule: Common interface for spec data files
// ============================================================================

/**
 * A single (Model, data[]) pair.
 * Uses structural typing (not nominal Model<any>) so that
 * compiled dist/ Model instances are compatible with src/ types.
 */
export interface SpecEntry {
  model: { id: string; register: (data: unknown[]) => void };
  data: unknown[];
}

/**
 * Common export interface for spec data files.
 * Each spec file exports a SpecModule via defineSpecs().
 */
export interface SpecModule {
  entries: SpecEntry[];
}

/**
 * Aggregated result from mergeSpecs().
 */
export interface MergedDesign {
  models: SpecEntry['model'][];
  specs: SpecEntry[];
}

/**
 * Define spec data in a spec file. Returns a SpecModule.
 *
 * @example
 * ```typescript
 * export default defineSpecs(
 *   [FunctionalRequirementModel.instance, functionalRequirements],
 *   [NonFunctionalRequirementModel.instance, nonFunctionalRequirements],
 * );
 * ```
 */
export function defineSpecs(...entries: [SpecEntry['model'], unknown[]][]): SpecModule {
  return {
    entries: entries.map(([model, data]) => ({ model, data })),
  };
}

/**
 * Merge multiple SpecModules into a single MergedDesign.
 * Models are deduplicated by model.id.
 *
 * @example
 * ```typescript
 * // design/index.ts
 * export default mergeSpecs(requirements, usecases, glossary);
 * ```
 */
export function mergeSpecs(...modules: SpecModule[]): MergedDesign {
  const modelMap = new Map<string, SpecEntry['model']>();
  const allSpecs: SpecEntry[] = [];

  for (const mod of modules) {
    for (const entry of mod.entries) {
      modelMap.set(entry.model.id, entry.model);
      allSpecs.push(entry);
    }
  }

  return {
    models: Array.from(modelMap.values()),
    specs: allSpecs,
  };
}

/**
 * Build a registry (modelId -> Map<specId, spec>) from config.specs.
 * Pure function — no global state.
 */
export function buildRegistryFromConfig(
  specs: SpecEntry[] | undefined
): Record<string, Map<string, unknown>> {
  const registry: Record<string, Map<string, unknown>> = {};
  if (!specs) return registry;
  for (const entry of specs) {
    if (!registry[entry.model.id]) {
      registry[entry.model.id] = new Map();
    }
    const map = registry[entry.model.id];
    for (const spec of entry.data) {
      map.set((spec as { id: string }).id, spec);
    }
  }
  return registry;
}

/**
 * Get specs for a model ID from config.specs.
 * Pure function — no global state.
 */
export function getSpecsFromConfig(
  specs: SpecEntry[] | undefined,
  modelId: string
): unknown[] {
  if (!specs) return [];
  return specs
    .filter(e => e.model.id === modelId)
    .flatMap(e => e.data);
}

/**
 * Find which model type a spec ID belongs to, from config.specs.
 * Pure function — no global state.
 */
export function findModelTypeFromConfig(
  specs: SpecEntry[] | undefined,
  specId: string
): string | null {
  if (!specs) return null;
  for (const entry of specs) {
    for (const spec of entry.data) {
      if ((spec as { id: string }).id === specId) {
        return entry.model.id;
      }
    }
  }
  return null;
}
