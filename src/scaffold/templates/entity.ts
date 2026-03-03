import type { ModelTemplateParams } from './types.js';

export function generateEntityModel(_params: ModelTemplateParams): string {
  return `/**
 * Entity Model Definition (Conceptual Data Model)
 */
import { z } from 'zod';
import { Model, RelationSchema } from 'speckeeper';
import type { LintRule, Exporter, ModelLevel } from 'speckeeper';

// =============================================================================
// Schema Definition
// =============================================================================

export const AttributeSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'date', 'datetime', 'uuid', 'enum', 'reference']),
  required: z.boolean().optional().default(true),
  description: z.string().optional(),
});

export const EntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  attributes: z.array(AttributeSchema),
  isAggregateRoot: z.boolean().optional().default(false),
  relations: z.array(RelationSchema).optional(),
});

// =============================================================================
// Type Export
// =============================================================================

export type Attribute = z.infer<typeof AttributeSchema>;
export type Entity = z.input<typeof EntitySchema>;

// =============================================================================
// Model Class
// =============================================================================

class ConceptualDataModel extends Model<typeof EntitySchema> {
  readonly id = 'conceptual-data-model';
  readonly name = 'ConceptualDataModel';
  readonly idPrefix = 'CDM';
  readonly schema = EntitySchema;
  readonly description = 'Defines conceptual entities (domain model)';
  protected modelLevel: ModelLevel = 'L0';

  protected lintRules: LintRule<Entity>[] = [
    {
      id: 'entity-has-attributes',
      severity: 'warning',
      message: 'Entity should have at least one attribute',
      check: (spec) => !spec.attributes || spec.attributes.length === 0,
    },
  ];

  protected exporters: Exporter<Entity>[] = [
    {
      format: 'markdown',
      single: (spec) => {
        const lines: string[] = [];
        lines.push(\`# \${spec.name}\`);
        lines.push('');
        lines.push(\`**ID**: \${spec.id}\`);
        lines.push('');
        lines.push(spec.description);
        lines.push('');
        lines.push('## Attributes');
        lines.push('');
        lines.push('| Name | Type | Required | Description |');
        lines.push('|------|------|----------|-------------|');
        for (const attr of spec.attributes) {
          lines.push(\`| \${attr.name} | \${attr.type} | \${attr.required ? 'Yes' : 'No'} | \${attr.description || ''} |\`);
        }
        return lines.join('\\n');
      },
      outputDir: 'data-model',
      filename: (spec) => spec.id,
    },
  ];
}

export { ConceptualDataModel };
`;
}
