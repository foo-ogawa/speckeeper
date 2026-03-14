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

// Checker factories
export {
  testChecker,
  externalOpenAPIChecker,
  externalSqlSchemaChecker,
  relationCoverage,
  annotationChecker,
  annotationCoverage,
  setArtifactsConfig,
  getArtifactsConfig,
} from './checkers.js';
export type {
  AnnotationCheckerConfig,
  AnnotationCheckEntry,
  AnnotationCoverageConfig,
} from './checkers.js';

// Type compatibility utility
export { isTypeContainedBy } from './type-compat.js';

// Edge-typed relation schemas
export { ImplementsRelationSchema, VerifiedByRelationSchema } from './relation-schemas.js';
export type { ImplementsRelation, VerifiedByRelation } from './relation-schemas.js';
