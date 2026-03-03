/**
 * Shared types for scaffold templates
 */
import type { ModelLevel } from '../../core/relation.js';

/** Parameters passed to a model template function */
export interface ModelTemplateParams {
  /** Model id (e.g. 'requirement') */
  modelId: string;
  /** Model class name PascalCase (e.g. 'Requirement') */
  modelName: string;
  /** ID prefix (e.g. 'REQ') */
  idPrefix: string;
  /** Model level */
  level: ModelLevel;
  /** Description derived from mermaid label */
  description: string;
}

/** Parameters passed to a checker template function */
export interface CheckerTemplateParams {
  /** Checker file name (without .ts) */
  checkerName: string;
  /** Target type (e.g. 'ddl', 'openapi') */
  targetType: string;
  /** Source model name PascalCase (e.g. 'LogicalEntity') */
  sourceModelName: string;
  /** Source model file name (e.g. 'logical-entity') */
  sourceModelFile: string;
  /** Description */
  description: string;
}
