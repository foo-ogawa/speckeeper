/**
 * Review — public API for declaring per-target LLM review checks
 */
export { defineReviewOutput } from './output.js';
export type { ReviewOutputDefinition, ReviewFinding } from './output.js';
export { relationsContext } from './context.js';
export type { RelationsContextOptions } from './context.js';
export type {
  ContextProvider,
  ContextResult,
  ReviewAdapterName,
  ReviewCheck,
  ReviewConfigInput,
  ReviewGateConfig,
  ReviewGateSeverity,
  ReviewModelClass,
  ReviewPrompt,
  ReviewRegistry,
  ReviewTarget,
} from './types.js';
