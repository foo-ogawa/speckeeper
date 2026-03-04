/**
 * Template registry — base template only
 *
 * All artifact classes use the same base template (FR-SCF-028).
 * Class-specific schemas, lint rules, and exporters are not pre-defined;
 * users customise the generated model after scaffold.
 */
import type { ModelTemplateParams } from './types.js';
import { generateBaseModel } from './base.js';

export type ModelTemplateFunction = (params: ModelTemplateParams) => string;

export const MODEL_TEMPLATE_FUNCTIONS: Record<string, ModelTemplateFunction> = {
  base: generateBaseModel,
};
