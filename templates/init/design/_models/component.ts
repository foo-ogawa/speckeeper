/**
 * Component Model Definition (Architecture)
 */
import { z } from 'zod';
import { Model, RelationSchema } from 'speckeeper';
import type { LintRule, Exporter, ModelLevel } from 'speckeeper';

// =============================================================================
// Schema Definition
// =============================================================================

export const ComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['system', 'container', 'component', 'person']),
  description: z.string(),
  technology: z.string().optional(),
  layerId: z.string().optional(),
  boundaryId: z.string().optional(),
  relations: z.array(RelationSchema).optional(),
});

// =============================================================================
// Type Export
// =============================================================================

export type Component = z.input<typeof ComponentSchema>;

// =============================================================================
// Model Class
// =============================================================================

class ComponentModel extends Model<typeof ComponentSchema> {
  readonly id = 'component';
  readonly name = 'Component';
  readonly idPrefix = 'COMP';
  readonly schema = ComponentSchema;
  readonly description = 'Defines architecture components';
  protected modelLevel: ModelLevel = 'L2';

  protected lintRules: LintRule<Component>[] = [
    {
      id: 'component-has-description',
      severity: 'warning',
      message: 'Component should have a description',
      check: (spec) => !spec.description || spec.description.trim() === '',
    },
  ];

  protected exporters: Exporter<Component>[] = [
    {
      format: 'markdown',
      single: (spec) => {
        const lines: string[] = [];
        lines.push(`# ${spec.name}`);
        lines.push('');
        lines.push(`**ID**: ${spec.id}`);
        lines.push(`**Type**: ${spec.type}`);
        if (spec.technology) lines.push(`**Technology**: ${spec.technology}`);
        lines.push('');
        lines.push(spec.description);
        return lines.join('\n');
      },
      outputDir: 'architecture',
      filename: (spec) => spec.id,
    },
  ];
}

export { ComponentModel };
