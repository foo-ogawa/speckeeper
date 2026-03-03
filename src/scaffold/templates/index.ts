/**
 * Template registry — maps template names to generator functions
 */
import type { ModelTemplateParams, CheckerTemplateParams } from './types.js';

import { generateRequirementModel } from './requirement.js';
import { generateUseCaseModel } from './usecase.js';
import { generateTermModel } from './term.js';
import { generateEntityModel } from './entity.js';
import { generateLogicalEntityModel } from './logical-entity.js';
import { generateAcceptanceTestModel } from './acceptance-test.js';
import { generateDataTestModel } from './data-test.js';
import { generateValidationConstraintModel } from './validation-constraint.js';
import { generateBaseModel } from './base.js';

import { generateDdlChecker } from './checkers/ddl-checker.js';
import { generateOpenapiChecker } from './checkers/openapi-checker.js';
import { generateTestChecker } from './checkers/test-checker.js';
import { generateBaseChecker } from './checkers/base-checker.js';

export type ModelTemplateFunction = (params: ModelTemplateParams) => string;
export type CheckerTemplateFunction = (params: CheckerTemplateParams) => string;

export const MODEL_TEMPLATE_FUNCTIONS: Record<string, ModelTemplateFunction> = {
  requirement: generateRequirementModel,
  usecase: generateUseCaseModel,
  term: generateTermModel,
  entity: generateEntityModel,
  'logical-entity': generateLogicalEntityModel,
  'acceptance-test': generateAcceptanceTestModel,
  'data-test': generateDataTestModel,
  'validation-constraint': generateValidationConstraintModel,
  base: generateBaseModel,
};

export const CHECKER_TEMPLATE_FUNCTIONS: Record<string, CheckerTemplateFunction> = {
  'ddl-checker': generateDdlChecker,
  'openapi-checker': generateOpenapiChecker,
  'test-checker': generateTestChecker,
  'base-checker': generateBaseChecker,
};
