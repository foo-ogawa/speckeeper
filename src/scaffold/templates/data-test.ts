import type { ModelTemplateParams } from './types.js';

export function generateDataTestModel(_params: ModelTemplateParams): string {
  return `/**
 * DataTest Model Definition
 */
import { z } from 'zod';
import { Model, RelationSchema } from 'speckeeper';
import type { LintRule, Exporter, ModelLevel } from 'speckeeper';

// =============================================================================
// Schema Definition
// =============================================================================

export const DataTestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  targetEntityId: z.string(),
  ruleType: z.enum(['fk', 'unique', 'type', 'not-null']),
  condition: z.string(),
  relations: z.array(RelationSchema).optional(),
});

// =============================================================================
// Type Export
// =============================================================================

export type DataTest = z.input<typeof DataTestSchema>;

// =============================================================================
// Model Class
// =============================================================================

class DataTestModel extends Model<typeof DataTestSchema> {
  readonly id = 'data-test';
  readonly name = 'DataTest';
  readonly idPrefix = 'DT';
  readonly schema = DataTestSchema;
  readonly description = 'Defines data integrity test specifications';
  protected modelLevel: ModelLevel = 'L2';

  protected lintRules: LintRule<DataTest>[] = [
    {
      id: 'dt-has-target-entity',
      severity: 'error',
      message: 'DataTest must reference a target entity',
      check: (spec) => !spec.targetEntityId || spec.targetEntityId.trim() === '',
    },
  ];

  protected exporters: Exporter<DataTest>[] = [];
}

export { DataTestModel };
`;
}
