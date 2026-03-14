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

