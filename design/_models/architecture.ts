/**
 * Architecture Model Definition
 */
import { z } from 'zod';
import { Model, RelationSchema } from '../../src/core/model.ts';
import type { LintRule, Exporter, ModelLevel } from '../../src/core/model.ts';
import { requireField, relationCoverage } from '../../src/core/dsl/index.ts';

// ============================================================================
// Schema Definition
// ============================================================================

export const ArchitectureElementTypeSchema = z.enum(['system', 'container', 'component', 'person']);

export const TechnologySchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
});

export const LayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  order: z.number().int().nonnegative(),
  allowedDependencies: z.array(z.string()).optional(),
  /** Inter-model relation */
  relations: z.array(RelationSchema).optional(),
});

export const BoundarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['system', 'context', 'container', 'deployment']),
  parentBoundaryId: z.string().optional(),
  allowCrossBoundaryDependencies: z.boolean().optional().default(false),
  /** Inter-model relation */
  relations: z.array(RelationSchema).optional(),
});

export const ComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ArchitectureElementTypeSchema,
  description: z.string(),
  technology: TechnologySchema.optional(),
  layerId: z.string().optional(),
  boundaryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  relatedRequirements: z.array(z.string()).optional(),
  external: z.boolean().optional().default(false),
  /** Inter-model relation */
  relations: z.array(RelationSchema).optional(),
});

export const RelationTypeSchema = z.enum([
  'uses', 'calls', 'depends_on', 'reads_from', 'writes_to',
  'publishes', 'subscribes', 'inherits', 'implements',
]);

export const ArchitectureRelationSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  type: RelationTypeSchema.optional(),
  label: z.string(),
  technology: z.string().optional(),
  description: z.string().optional(),
  async: z.boolean().optional().default(false),
});

// ============================================================================
// Type Export
// ============================================================================

export type ArchitectureElementType = z.infer<typeof ArchitectureElementTypeSchema>;
export type Technology = z.infer<typeof TechnologySchema>;
export type Layer = z.input<typeof LayerSchema>;
export type Boundary = z.input<typeof BoundarySchema>;
export type Component = z.input<typeof ComponentSchema>;
export type RelationType = z.infer<typeof RelationTypeSchema>;
export type ArchitectureRelation = z.input<typeof ArchitectureRelationSchema>;

// ============================================================================
// Component Model Class
// ============================================================================

class ComponentModelBase extends Model<typeof ComponentSchema> {
  readonly id: string = 'component';
  readonly name: string = 'Component';
  readonly idPrefix: string = 'COMP';
  readonly schema = ComponentSchema;
  readonly description: string = 'Defines architecture components';
  protected modelLevel: ModelLevel = 'L2';

  protected lintRules: LintRule<Component>[] = [
    requireField<Component>('description'),
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
        if (spec.technology) lines.push(`**Technology**: ${spec.technology.name}`);
        lines.push('');
        lines.push(spec.description);
        return lines.join('\n');
      },
      index: (specs) => {
        const lines: string[] = [];
        lines.push('# Components');
        lines.push('');
        lines.push('| ID | Name | Type | Description |');
        lines.push('|----|------|------|-------------|');
        for (const spec of specs) {
          lines.push(`| ${spec.id} | ${spec.name} | ${spec.type} | ${spec.description} |`);
        }
        return lines.join('\n');
      },
      outputDir: 'architecture',
      filename: (spec) => spec.id,
    },
  ];

}

// ============================================================================
// Boundary Model Class
// ============================================================================

class BoundaryModel extends Model<typeof BoundarySchema> {
  readonly id = 'boundary';
  readonly name = 'Boundary';
  readonly idPrefix = 'BND';
  readonly schema = BoundarySchema;
  readonly description = 'Defines system boundaries (context)';
  protected modelLevel: ModelLevel = 'L2';
  protected lintRules: LintRule<Boundary>[] = [];
  protected exporters: Exporter<Boundary>[] = [];
}

// ============================================================================
// Layer Model Class
// ============================================================================

class LayerModel extends Model<typeof LayerSchema> {
  readonly id = 'layer';
  readonly name = 'Layer';
  readonly idPrefix = 'LAYER';
  readonly schema = LayerSchema;
  readonly description = 'Defines architecture layers';
  protected modelLevel: ModelLevel = 'L2';
  protected lintRules: LintRule<Layer>[] = [];
  protected exporters: Exporter<Layer>[] = [];
}

// ============================================================================
// Relation Model Class
// ============================================================================

class RelationModel extends Model<typeof ArchitectureRelationSchema> {
  readonly id = 'relation';
  readonly name = 'Relation';
  readonly idPrefix = 'REL';
  readonly schema = ArchitectureRelationSchema;
  readonly description = 'Defines relations between components';
  protected modelLevel: ModelLevel = 'L2';

  protected lintRules: LintRule<ArchitectureRelation>[] = [
    {
      id: 'relation-from-to-different',
      severity: 'error',
      message: 'Relation from and to should be different',
      check: (spec) => spec.from === spec.to,
    },
  ];

  protected exporters: Exporter<ArchitectureRelation>[] = [];
}

class ActorComponentModel extends ComponentModelBase {
  readonly id = 'actor-component';
  readonly name = 'Actor (Architecture)';
  readonly idPrefix = 'ACTOR';
  readonly description = 'Defines actors (people) in the architecture';
}

class ExternalSystemModel extends ComponentModelBase {
  readonly id = 'external-system';
  readonly name = 'External System';
  readonly idPrefix = 'EXT';
  readonly description = 'Defines external systems';
}

class ContainerModel extends ComponentModelBase {
  readonly id = 'container';
  readonly name = 'Container';
  readonly idPrefix = 'CONT';
  readonly description = 'Defines containers (deployable units)';

  protected coverageChecker = relationCoverage<Component>({
    targetModel: 'functional-requirement',
    description: 'Verifies functional requirements (FR-*) are implemented by Containers',
    relationType: 'implements',
  });
}

export {
  ComponentModelBase as ComponentModel,
  ActorComponentModel,
  ExternalSystemModel,
  ContainerModel,
  BoundaryModel,
  LayerModel,
  RelationModel,
};
