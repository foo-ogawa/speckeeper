/**
 * Concept Model Definition
 */
import { z } from 'zod';
import { Model, RelationSchema } from '../../src/core/model.ts';
import type { LintRule, Exporter, CoverageChecker, CoverageResult, ModelLevel, Renderer, RenderContext } from '../../src/core/model.ts';

// ============================================================================
// Schema Definition
// ============================================================================

export const LogicalTypeSchema = z.enum([
  'string', 'number', 'integer', 'boolean', 'date', 'datetime', 'time',
  'uuid', 'email', 'url', 'json', 'array', 'enum', 'reference',
]);

export const AttributeSchema = z.object({
  name: z.string(),
  type: LogicalTypeSchema,
  required: z.boolean().optional().default(true),
  description: z.string().optional(),
  enumValues: z.array(z.string()).optional(),
  referenceTo: z.string().optional(),
  itemType: LogicalTypeSchema.optional(),
  constraints: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    pattern: z.string().optional(),
    format: z.string().optional(),
  }).optional(),
});

export const EntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  attributes: z.array(AttributeSchema),
  boundedContextId: z.string().optional(),
  isAggregateRoot: z.boolean().optional().default(false),
  softDelete: z.boolean().optional().default(false),
  auditable: z.boolean().optional().default(true),
  tags: z.array(z.string()).optional(),
  /** Inter-model relation */
  relations: z.array(RelationSchema).optional(),
});

export const MultiplicitySchema = z.enum(['1:1', '1:N', 'N:1', 'N:M']);

export const EntityRelationSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  multiplicity: MultiplicitySchema,
  verb: z.string(),
  description: z.string().optional(),
  composition: z.boolean().optional().default(false),
  onDelete: z.enum(['cascade', 'restrict', 'set_null', 'no_action']).optional().default('restrict'),
});

export const RuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  appliesTo: z.array(z.string()),
  type: z.enum(['invariant', 'validation', 'calculation', 'constraint']),
  expression: z.string(),
  formalExpression: z.string().optional(),
  severity: z.enum(['error', 'warning']).optional().default('error'),
});

// ============================================================================
// Type Export
// ============================================================================

export type LogicalType = z.infer<typeof LogicalTypeSchema>;
export type Attribute = z.infer<typeof AttributeSchema>;
export type Entity = z.input<typeof EntitySchema>;
export type Multiplicity = z.infer<typeof MultiplicitySchema>;
export type EntityRelation = z.input<typeof EntityRelationSchema>;
export type Rule = z.input<typeof RuleSchema>;

// ============================================================================
// Model Class
// ============================================================================

class EntityModel extends Model<typeof EntitySchema> {
  readonly id = 'entity';
  readonly name = 'Entity';
  readonly idPrefix = 'E';
  readonly schema = EntitySchema;
  readonly description = 'Defines conceptual entities (domain model)';
  protected modelLevel: ModelLevel = 'L2';

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
        lines.push(`# ${spec.name}`);
        lines.push('');
        lines.push(`**ID**: ${spec.id}`);
        lines.push('');
        lines.push(spec.description);
        lines.push('');
        lines.push('## Attributes');
        lines.push('');
        lines.push('| Name | Type | Required | Description |');
        lines.push('|------|------|----------|-------------|');
        for (const attr of spec.attributes) {
          lines.push(`| ${attr.name} | ${attr.type} | ${attr.required ? 'Yes' : 'No'} | ${attr.description || ''} |`);
        }
        return lines.join('\n');
      },
      index: (specs) => {
        const lines: string[] = [];
        lines.push('# Entities');
        lines.push('');
        lines.push('| ID | Name | Description |');
        lines.push('|----|------|-------------|');
        for (const spec of specs) {
          lines.push(`| ${spec.id} | ${spec.name} | ${spec.description} |`);
        }
        return lines.join('\n');
      },
      outputDir: 'data-model/entities',
      filename: (spec) => spec.id,
    },
  ];

  /**
   * Coverage Checker
   * 
   * Verifies that concept model Entities are documented in Artifacts
   * Checks if Entity.relations has documents, refines, or implements relations to Artifacts
   */
  protected coverageChecker: CoverageChecker<Entity> = {
    targetModel: 'artifact',
    description: 'Verifies concept model (Entity) is documented/implemented in Artifacts',
    check: (specs, registry): CoverageResult => {
      const artifacts = registry['artifact'];
      if (!artifacts) {
        return { total: 0, covered: 0, uncovered: 0, coveragePercent: 100, coveredItems: [], uncoveredItems: [] };
      }

      // Get list of Artifact IDs
      interface ArtifactSpec { id: string; name: string }
      const artifactMap = new Map<string, ArtifactSpec>();
      for (const art of artifacts.values() as IterableIterator<ArtifactSpec>) {
        artifactMap.set(art.id, art);
      }

      // Verify that Entity is documented in Artifact
      // Check if Entity.relations references ART-* with 'documents', 'refines', or 'implements'
      const coveredItems: CoverageResult['coveredItems'] = [];
      const uncoveredItems: CoverageResult['uncoveredItems'] = [];

      for (const entity of specs) {
        const relatedArtifacts = (entity.relations || [])
          .filter(rel => 
            ['documents', 'refines', 'implements'].includes(rel.type) && 
            rel.target.startsWith('ART-')
          )
          .map(rel => rel.target);

        if (relatedArtifacts.length > 0) {
          coveredItems.push({ id: entity.id, description: entity.name });
        } else {
          uncoveredItems.push({ id: entity.id, description: entity.name });
        }
      }

      const total = specs.length;
      const covered = coveredItems.length;
      const uncovered = uncoveredItems.length;
      const coveragePercent = total > 0 ? Math.round((covered / total) * 100) : 100;

      return { total, covered, uncovered, coveragePercent, coveredItems, uncoveredItems };
    },
  };

  // ============================================================================
  // Renderers (for embeds)
  // ============================================================================

  protected renderers: Renderer<Entity>[] = [
    {
      format: 'entity-table',
      render: (specs, ctx) => renderEntityTable(specs, ctx),
    },
    {
      format: 'detail',
      render: (specs, _ctx) => specs.length > 0 ? renderEntityDetail(specs[0]) : '*No matching entity found*',
    },
  ];
}

export { EntityModel };

// ============================================================================
// Rendering Helper Functions
// ============================================================================

/**
 * Entity table format
 */
function renderEntityTable(entities: Entity[], ctx: RenderContext): string {
  const headers = ['ID', 'Entity Name', 'Attribute Count', 'Description'];
  const rows = entities.map(e => [
    e.id,
    `**${e.name}**`,
    String(e.attributes.length),
    e.description.slice(0, 60) + (e.description.length > 60 ? '...' : ''),
  ]);
  return ctx.markdown.table(headers, rows);
}

/**
 * Entity detail format (including attribute list)
 */
function renderEntityDetail(entity: Entity): string {
  const lines: string[] = [];
  lines.push(`### ${entity.id}: ${entity.name}`);
  lines.push('');
  lines.push(entity.description);
  lines.push('');
  
  if (entity.attributes.length > 0) {
    lines.push('**Attributes:**');
    lines.push('');
    lines.push('| Attribute | Type | Required | Description |');
    lines.push('|-----------|------|----------|-------------|');
    for (const attr of entity.attributes) {
      const required = attr.required ? '✓' : '';
      lines.push(`| ${attr.name} | ${attr.type} | ${required} | ${attr.description || '-'} |`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}
