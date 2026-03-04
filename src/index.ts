// Types (prioritize definitions from meta-model.ts)
export * from './types/index.js';

// Core (Model Registry) - export excluding duplicates
export {
  Model,
  defineSpecs,
  mergeSpecs,
  buildRegistryFromConfig,
  getSpecsFromConfig,
  findModelTypeFromConfig,
  // Re-exported from relation.ts
  RELATION_TYPES,
  RELATION_CONSTRAINTS,
  RelationSchema,
  RelationsFieldSchema,
} from './core/model.js';

export type {
  ModelLevel,
  Relation,
  RelationValidationError,
  LintRule,
  LintResult,
  Exporter,
  ExternalChecker,
  CheckResult,
  CoverageResult,
  CoverageChecker,
  Renderer,
  RenderContext,
  SpecEntry,
  SpecModule,
  MergedDesign,
} from './core/model.js';

// Relation utilities
export {
  validateRelationLevel,
  detectCycles,
  inferModelIdFromSpecId,
  getLevelIndex,
} from './core/relation.js';

export * from './core/model-registry.js';
export * from './core/config-api.js';

// Utils
export * from './utils/index.js';
