import type { ModelTemplateParams } from './types.js';

export function generateAcceptanceTestModel(_params: ModelTemplateParams): string {
  return `/**
 * AcceptanceTest Model Definition
 */
import { z } from 'zod';
import { Model, RelationSchema } from 'speckeeper';
import type { LintRule, Exporter, ModelLevel } from 'speckeeper';

// =============================================================================
// Schema Definition
// =============================================================================

export const TestStepSchema = z.object({
  stepNumber: z.number(),
  action: z.string(),
  expectedResult: z.string(),
});

export const AcceptanceTestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  targetId: z.string(),
  testType: z.enum(['e2e', 'manual', 'review']),
  steps: z.array(TestStepSchema).optional(),
  expectedResult: z.string(),
  relations: z.array(RelationSchema).optional(),
});

// =============================================================================
// Type Export
// =============================================================================

export type TestStep = z.infer<typeof TestStepSchema>;
export type AcceptanceTest = z.input<typeof AcceptanceTestSchema>;

// =============================================================================
// Model Class
// =============================================================================

class AcceptanceTestModel extends Model<typeof AcceptanceTestSchema> {
  readonly id = 'acceptance-test';
  readonly name = 'AcceptanceTest';
  readonly idPrefix = 'AT';
  readonly schema = AcceptanceTestSchema;
  readonly description = 'Defines acceptance test specifications';
  protected modelLevel: ModelLevel = 'L2';

  protected lintRules: LintRule<AcceptanceTest>[] = [
    {
      id: 'at-has-target',
      severity: 'error',
      message: 'AcceptanceTest must reference a target requirement or use case',
      check: (spec) => !spec.targetId || spec.targetId.trim() === '',
    },
  ];

  protected exporters: Exporter<AcceptanceTest>[] = [];
}

export { AcceptanceTestModel };
`;
}
