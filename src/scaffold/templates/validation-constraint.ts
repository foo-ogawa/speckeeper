import type { ModelTemplateParams } from './types.js';

export function generateValidationConstraintModel(_params: ModelTemplateParams): string {
  return `/**
 * ValidationConstraint Model Definition
 */
import { z } from 'zod';
import { Model, RelationSchema } from 'speckeeper';
import type { LintRule, Exporter, ModelLevel } from 'speckeeper';

// =============================================================================
// Schema Definition
// =============================================================================

export const ValidationConstraintSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  targetField: z.string(),
  constraintType: z.enum(['range', 'format', 'required', 'enum', 'custom']),
  rule: z.string(),
  errorMessage: z.string().optional(),
  relations: z.array(RelationSchema).optional(),
});

// =============================================================================
// Type Export
// =============================================================================

export type ValidationConstraint = z.input<typeof ValidationConstraintSchema>;

// =============================================================================
// Model Class
// =============================================================================

class ValidationConstraintModel extends Model<typeof ValidationConstraintSchema> {
  readonly id = 'validation-constraint';
  readonly name = 'ValidationConstraint';
  readonly idPrefix = 'VC';
  readonly schema = ValidationConstraintSchema;
  readonly description = 'Defines validation constraints (input rules, boundary values, formats)';
  protected modelLevel: ModelLevel = 'L2';

  protected lintRules: LintRule<ValidationConstraint>[] = [
    {
      id: 'vc-has-rule',
      severity: 'error',
      message: 'ValidationConstraint must have a rule definition',
      check: (spec) => !spec.rule || spec.rule.trim() === '',
    },
  ];

  protected exporters: Exporter<ValidationConstraint>[] = [];
}

export { ValidationConstraintModel };
`;
}
