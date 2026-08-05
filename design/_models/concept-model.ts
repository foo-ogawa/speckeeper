/**
 * Concept Model Definition
 */
import { z } from 'zod';
import { Model, RelationSchema } from '../../src/core/model.ts';
import type { LintRule, Exporter, CoverageChecker, CoverageResult, ModelLevel, Renderer, RenderContext } from '../../src/core/model.ts';
import { arrayMinLength } from '../../src/core/dsl/index.ts';

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
    arrayMinLength<Entity>('attributes', 1, 'warning'),
  ];

  protected exporters: Exporter<Entity>[] = [
    {
      format: 'markdown',
      index: (specs) => {
        const lines: string[] = [];
        lines.push('# Entities');
        lines.push('');
        lines.push('| ID | Name | Description |');
        lines.push('|----|------|-------------|');
        for (const spec of specs) {
          lines.push(`| ${spec.id} | ${spec.name} | ${spec.description} |`);
        }
        lines.push('');
        lines.push('---');
        lines.push('');
        for (const spec of specs) {
          lines.push(`## ${spec.id}: ${spec.name}`);
          lines.push('');
          lines.push(spec.description);
          lines.push('');
          lines.push('### Attributes');
          lines.push('');
          lines.push('| Name | Type | Required | Description |');
          lines.push('|------|------|----------|-------------|');
          for (const attr of spec.attributes) {
            lines.push(`| ${attr.name} | ${attr.type} | ${attr.required ? 'Yes' : 'No'} | ${attr.description || ''} |`);
          }
          lines.push('');
          lines.push('---');
          lines.push('');
        }
        return lines.join('\n').replace(/\n---\n\n$/, '\n');
      },
      outputFile: 'design/entities.md',
    },
    {
      format: 'json',
      target: 'specs',
      outputDir: 'schemas/entities',
      filename: (spec) => spec.id,
      single: (spec) => JSON.stringify(entityJsonSchema(spec), null, 2) + '\n',
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
// JSON Schema Derivation
// ============================================================================

type EntityAttribute = Entity['attributes'][number];

/** JSON Schema keywords produced for a single attribute */
interface JsonSchemaProperty {
  type?: string;
  format?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  description?: string;
  $comment?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

/** JSON Schema document describing instances of one Entity */
interface EntityJsonSchema {
  $schema: string;
  $id: string;
  title: string;
  description: string;
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

/**
 * Map a logical type to the JSON Schema keywords it implies
 */
function logicalTypeSchema(
  attr: Pick<EntityAttribute, 'type' | 'enumValues' | 'itemType' | 'referenceTo'>,
  where: string,
): JsonSchemaProperty {
  switch (attr.type) {
    case 'string':
      return { type: 'string' };
    case 'number':
      return { type: 'number' };
    case 'integer':
      return { type: 'integer' };
    case 'boolean':
      return { type: 'boolean' };
    case 'date':
      return { type: 'string', format: 'date' };
    case 'datetime':
      return { type: 'string', format: 'date-time' };
    case 'time':
      return { type: 'string', format: 'time' };
    case 'uuid':
      return { type: 'string', format: 'uuid' };
    case 'email':
      return { type: 'string', format: 'email' };
    case 'url':
      return { type: 'string', format: 'uri' };
    case 'json':
      return {};
    case 'array':
      return attr.itemType
        ? { type: 'array', items: logicalTypeSchema({ type: attr.itemType }, where) }
        : { type: 'array' };
    case 'enum':
      if (!attr.enumValues || attr.enumValues.length === 0) {
        throw new Error(`${where}: attribute of type "enum" requires enumValues`);
      }
      return { type: 'string', enum: attr.enumValues };
    case 'reference':
      return attr.referenceTo
        ? { type: 'string', $comment: `Reference to ${attr.referenceTo}` }
        : { type: 'string' };
  }
}

/**
 * Derive the JSON Schema property for one entity attribute
 */
function attributeSchema(attr: EntityAttribute, where: string): JsonSchemaProperty {
  const property = logicalTypeSchema(attr, where);

  if (attr.description) {
    property.description = attr.description;
  }

  const constraints = attr.constraints;
  if (constraints) {
    if (constraints.minLength !== undefined) property.minLength = constraints.minLength;
    if (constraints.maxLength !== undefined) property.maxLength = constraints.maxLength;
    if (constraints.minimum !== undefined) property.minimum = constraints.minimum;
    if (constraints.maximum !== undefined) property.maximum = constraints.maximum;
    if (constraints.pattern !== undefined) property.pattern = constraints.pattern;
    if (constraints.format !== undefined) property.format = constraints.format;
  }

  return property;
}

/**
 * Derive the JSON Schema of an Entity: its attributes become properties
 */
function entityJsonSchema(entity: Entity): EntityJsonSchema {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const attr of entity.attributes) {
    properties[attr.name] = attributeSchema(attr, `${entity.id}.${attr.name}`);
    if (attr.required !== false) {
      required.push(attr.name);
    }
  }

  const schema: EntityJsonSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${entity.id}.json`,
    title: entity.name,
    description: entity.description,
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

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
