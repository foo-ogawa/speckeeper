/**
 * Requirement Model Definition
 */
import { z } from 'zod';
import { Model, RelationSchema } from 'speckeeper';
import type { LintRule, Exporter, ModelLevel } from 'speckeeper';

// =============================================================================
// Schema Definition
// =============================================================================

export const AcceptanceCriteriaSchema = z.object({
  id: z.string(),
  description: z.string(),
  verificationMethod: z.enum(['test', 'review', 'demo', 'inspection']).optional(),
});

export const RequirementSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  type: z.enum(['functional', 'non-functional', 'constraint']),
  priority: z.enum(['must', 'should', 'could']),
  rationale: z.string().optional(),
  acceptanceCriteria: z.array(AcceptanceCriteriaSchema).min(1),
  category: z.string().optional(),
  relations: z.array(RelationSchema).optional(),
});

// =============================================================================
// Type Export
// =============================================================================

export type AcceptanceCriteria = z.infer<typeof AcceptanceCriteriaSchema>;
export type Requirement = z.input<typeof RequirementSchema>;

// =============================================================================
// Model Class
// =============================================================================

class RequirementModel extends Model<typeof RequirementSchema> {
  readonly id = 'requirement';
  readonly name = 'Requirement';
  readonly idPrefix = 'REQ';
  readonly schema = RequirementSchema;
  readonly description = 'Defines functional requirements, non-functional requirements, and constraints';
  protected modelLevel: ModelLevel = 'L1';

  protected lintRules: LintRule<Requirement>[] = [
    {
      id: 'req-acceptance-not-empty',
      severity: 'error',
      message: 'Requirement must have at least one acceptance criteria',
      check: (spec) => !spec.acceptanceCriteria || spec.acceptanceCriteria.length === 0,
    },
    {
      id: 'req-acceptance-id-format',
      severity: 'warning',
      message: 'Acceptance criteria ID should follow parent requirement ID (e.g., FR-001-01)',
      check: (spec) => {
        if (!spec.acceptanceCriteria) return false;
        return spec.acceptanceCriteria.some(ac => !ac.id.startsWith(spec.id + '-'));
      },
    },
  ];

  protected exporters: Exporter<Requirement>[] = [
    {
      format: 'markdown',
      single: (spec) => {
        const lines: string[] = [];
        lines.push(`# ${spec.name}`);
        lines.push('');
        lines.push(`**ID**: ${spec.id}`);
        lines.push(`**Type**: ${spec.type}`);
        lines.push(`**Priority**: ${spec.priority}`);
        lines.push('');
        lines.push('## Description');
        lines.push('');
        lines.push(spec.description);
        lines.push('');
        lines.push('## Acceptance Criteria');
        lines.push('');
        for (const ac of spec.acceptanceCriteria) {
          lines.push(`- **${ac.id}**: ${ac.description}`);
        }
        return lines.join('\n');
      },
      outputDir: 'requirements',
      filename: (spec) => spec.id,
    },
  ];
}

export { RequirementModel };
