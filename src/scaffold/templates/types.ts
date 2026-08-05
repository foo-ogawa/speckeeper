/**
 * Shared types for scaffold templates
 */
import type { ModelLevel } from '../../core/relation.js';

/** One checker-triggering edge the generated model should be bound against */
export interface CheckerBinding {
  /** Normalized edge label ('implements' or 'verifiedBy') */
  relation: string;
  /** ID of the external node the edge points at */
  targetId: string;
  /** Label of the external node, when the flowchart gave one */
  targetLabel?: string;
}

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
  /** Checker-triggering edges detected for this model, in flowchart order */
  checkerBindings?: CheckerBinding[];
}

