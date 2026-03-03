import type { ModelTemplateParams } from './types.js';

export function generateLogicalEntityModel(_params: ModelTemplateParams): string {
  return `/**
 * LogicalEntity Model Definition (Logical Data Model)
 */
import { z } from 'zod';
import { Model, RelationSchema } from 'speckeeper';
import type { LintRule, Exporter, ModelLevel } from 'speckeeper';

// =============================================================================
// Schema Definition
// =============================================================================

export const ColumnSchema = z.object({
  name: z.string(),
  dataType: z.string(),
  nullable: z.boolean().optional().default(false),
  primaryKey: z.boolean().optional().default(false),
  foreignKey: z.object({
    table: z.string(),
    column: z.string(),
  }).optional(),
  description: z.string().optional(),
});

export const ConstraintSchema = z.object({
  name: z.string(),
  type: z.enum(['unique', 'check', 'foreign_key', 'index']),
  columns: z.array(z.string()),
  expression: z.string().optional(),
});

export const LogicalEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tableName: z.string(),
  columns: z.array(ColumnSchema).min(1),
  constraints: z.array(ConstraintSchema).optional(),
  relations: z.array(RelationSchema).optional(),
});

// =============================================================================
// Type Export
// =============================================================================

export type Column = z.infer<typeof ColumnSchema>;
export type Constraint = z.infer<typeof ConstraintSchema>;
export type LogicalEntity = z.input<typeof LogicalEntitySchema>;

// =============================================================================
// Model Class
// =============================================================================

class LogicalDataModel extends Model<typeof LogicalEntitySchema> {
  readonly id = 'logical-data-model';
  readonly name = 'LogicalDataModel';
  readonly idPrefix = 'LDM';
  readonly schema = LogicalEntitySchema;
  readonly description = 'Defines logical data model entities (tables, columns, constraints)';
  protected modelLevel: ModelLevel = 'L2';

  protected lintRules: LintRule<LogicalEntity>[] = [
    {
      id: 'lent-has-columns',
      severity: 'error',
      message: 'LogicalEntity must have at least one column',
      check: (spec) => !spec.columns || spec.columns.length === 0,
    },
    {
      id: 'lent-has-primary-key',
      severity: 'warning',
      message: 'LogicalEntity should have at least one primary key column',
      check: (spec) => {
        if (!spec.columns) return true;
        return !spec.columns.some(c => c.primaryKey);
      },
    },
  ];

  protected exporters: Exporter<LogicalEntity>[] = [
    {
      format: 'markdown',
      single: (spec) => {
        const lines: string[] = [];
        lines.push(\`# \${spec.name}\`);
        lines.push('');
        lines.push(\`**ID**: \${spec.id}  \`);
        lines.push(\`**Table**: \${spec.tableName}\`);
        lines.push('');
        lines.push(spec.description);
        lines.push('');
        lines.push('## Columns');
        lines.push('');
        lines.push('| Name | Type | Nullable | PK | Description |');
        lines.push('|------|------|----------|----|-------------|');
        for (const col of spec.columns) {
          lines.push(\`| \${col.name} | \${col.dataType} | \${col.nullable ? 'Yes' : 'No'} | \${col.primaryKey ? 'Yes' : ''} | \${col.description || ''} |\`);
        }
        return lines.join('\\n');
      },
      outputDir: 'data-model',
      filename: (spec) => spec.id,
    },
  ];
}

export { LogicalDataModel };
`;
}
