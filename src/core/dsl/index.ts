/**
 * Core DSL — Public exports
 *
 * Factory functions for lint rules, exporters, checkers, and schemas.
 * Users import from 'speckeeper/dsl'.
 */

// Schema
export { baseSpecSchema } from './schema.js';
export type { BaseSpec } from './schema.js';

// Lint rule factories
export { requireField, arrayMinLength, idFormat, childIdFormat } from './lint-rules.js';

// Exporter factories
export { markdownExporter } from './exporters.js';
export type { MarkdownExporterConfig } from './exporters.js';

// Coverage checkers
export {
  relationCoverage,
  annotationCoverage,
  setArtifactsConfig,
  getArtifactsConfig,
} from './checkers.js';
export type {
  AnnotationCoverageConfig,
} from './checkers.js';

// Type compatibility utility
export { isTypeContainedBy } from './type-compat.js';

// Edge-typed relation schemas
export { ImplementsRelationSchema, VerifiedByRelationSchema } from './relation-schemas.js';
export type { ImplementsRelation, VerifiedByRelation } from './relation-schemas.js';

// Global scanner (re-export for convenience)
export {
  runGlobalScan,
  runDeepValidation,
  openapiScanner,
  ddlScanner,
  annotationScanner,
  createAnnotationScanner,
} from '../global-scanner.js';
export type {
  GlobalScanMatch,
  GlobalScanResult,
  GlobalScanOutput,
  ScanWarning,
  LookupKeyMap,
} from '../global-scanner.js';
