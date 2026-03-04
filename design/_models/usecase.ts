/**
 * Use Case Model Definition
 */
import { z } from 'zod';
import { Model, RelationSchema } from '../../src/core/model.ts';
import type { LintRule, Exporter, ModelLevel, Renderer, RenderContext } from '../../src/core/model.ts';
import { requireField, arrayMinLength } from '../../src/core/dsl/index.ts';

// ============================================================================
// Schema Definition
// ============================================================================

export const PhaseSchema = z.enum(['REQ', 'HLD', 'LLD', 'IMPL', 'OPS', 'CI']);

export const ActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['human', 'system', 'external']),
  /** Inter-model relation */
  relations: z.array(RelationSchema).optional(),
});

export const UseCaseStepSchema = z.object({
  stepNumber: z.number(),
  type: z.enum(['user_action', 'system_response', 'alternative', 'include', 'extend']),
  description: z.string(),
  actorId: z.string().optional(),
  screenId: z.string().optional(),
  notes: z.string().optional(),
  condition: z.string().optional(),
  errorCaseId: z.string().optional(),
  includedUseCaseId: z.string().optional(),
  extensionPoint: z.string().optional(),
});

export const UseCaseExceptionSchema = z.object({
  id: z.string(),
  trigger: z.string(),
  description: z.string(),
  steps: z.array(UseCaseStepSchema),
  errorCaseId: z.string().optional(),
});

export const UseCaseFlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  actor: z.string(),
  phase: PhaseSchema.optional(),
  secondaryActors: z.array(z.string()).optional().default([]),
  preconditions: z.array(z.string()).optional().default([]),
  postconditions: z.array(z.string()).optional().default([]),
  relatedRequirements: z.array(z.string()).optional().default([]),
  relatedScreens: z.array(z.string()).optional().default([]),
  relatedProcessFlows: z.array(z.string()).optional().default([]),
  mainFlow: z.array(UseCaseStepSchema),
  alternativeFlows: z.array(z.object({
    id: z.string(),
    name: z.string(),
    branchPoint: z.number(),
    condition: z.string(),
    steps: z.array(UseCaseStepSchema),
    rejoinsAt: z.number().optional(),
  })).optional().default([]),
  exceptions: z.array(UseCaseExceptionSchema).optional().default([]),
  /** Inter-model relation */
  relations: z.array(RelationSchema).optional(),
});

// ============================================================================
// Type Export
// ============================================================================

export type Phase = z.infer<typeof PhaseSchema>;
export type Actor = z.input<typeof ActorSchema>;
export type UseCaseStep = z.infer<typeof UseCaseStepSchema>;
export type UseCaseException = z.infer<typeof UseCaseExceptionSchema>;
export type UseCase = z.input<typeof UseCaseFlowSchema>;

// ============================================================================
// Actor Model Class
// ============================================================================

class ActorModel extends Model<typeof ActorSchema> {
  readonly id = 'actor';
  readonly name = 'Actor';
  readonly idPrefix = 'UC-ACTOR';
  readonly schema = ActorSchema;
  readonly description = 'Defines actors';
  protected modelLevel: ModelLevel = 'L0';

  protected lintRules: LintRule<Actor>[] = [
    requireField<Actor>('description'),
  ];

  protected exporters: Exporter<Actor>[] = [
    {
      format: 'markdown',
      single: (spec) => {
        const lines: string[] = [];
        lines.push(`# ${spec.name}`);
        lines.push('');
        lines.push(`**ID**: ${spec.id}`);
        lines.push(`**Type**: ${spec.type}`);
        lines.push('');
        if (spec.description) {
          lines.push('## Description');
          lines.push('');
          lines.push(spec.description);
          lines.push('');
        }
        return lines.join('\n');
      },
      index: (specs) => {
        const lines: string[] = [];
        lines.push('# Actors');
        lines.push('');
        lines.push('| ID | Name | Type | Description |');
        lines.push('|----|------|------|-------------|');
        for (const spec of specs) {
          lines.push(`| ${spec.id} | ${spec.name} | ${spec.type} | ${spec.description || ''} |`);
        }
        return lines.join('\n');
      },
      outputDir: 'actors',
      filename: (spec) => spec.id,
    },
  ];

  // ============================================================================
  // Renderers (for embeds)
  // ============================================================================

  protected renderers: Renderer<Actor>[] = [
    {
      format: 'table',
      render: (specs, ctx) => renderActorTable(specs, ctx),
    },
    {
      format: 'list',
      render: (specs, _ctx) => renderActorList(specs),
    },
  ];
}

// ============================================================================
// UseCase Model Class
// ============================================================================

class UseCaseModel extends Model<typeof UseCaseFlowSchema> {
  readonly id = 'usecase';
  readonly name = 'UseCase';
  readonly idPrefix = 'UC';
  readonly schema = UseCaseFlowSchema;
  readonly description = 'Defines use cases (business flows)';
  protected modelLevel: ModelLevel = 'L0';

  protected lintRules: LintRule<UseCase>[] = [
    arrayMinLength<UseCase>('mainFlow', 1),
    requireField<UseCase>('actor', 'error'),
  ];

  protected exporters: Exporter<UseCase>[] = [
    {
      format: 'markdown',
      single: (spec) => {
        const lines: string[] = [];
        lines.push(`# ${spec.name}`);
        lines.push('');
        lines.push(`**ID**: ${spec.id}`);
        lines.push(`**Actor**: ${spec.actor}`);
        lines.push('');
        lines.push('## Main Flow');
        lines.push('');
        for (const step of spec.mainFlow) {
          lines.push(`${step.stepNumber}. ${step.description}`);
        }
        return lines.join('\n');
      },
      index: (specs) => {
        const lines: string[] = [];
        lines.push('# Use Cases');
        lines.push('');
        lines.push('| ID | Name | Actor |');
        lines.push('|----|------|-------|');
        for (const spec of specs) {
          lines.push(`| ${spec.id} | ${spec.name} | ${spec.actor} |`);
        }
        return lines.join('\n');
      },
      outputDir: 'usecases',
      filename: (spec) => spec.id,
    },
  ];

  // ============================================================================
  // Renderers (for embeds)
  // ============================================================================

  protected renderers: Renderer<UseCase>[] = [
    {
      format: 'table',
      render: (specs, ctx) => renderUseCaseTable(specs, ctx),
    },
    {
      format: 'list',
      render: (specs, _ctx) => renderUseCaseList(specs),
    },
  ];
}

export { ActorModel, UseCaseModel };

// ============================================================================
// Actor Rendering Helper Functions
// ============================================================================

const actorTypeLabels: Record<string, string> = {
  human: '👤 Human',
  system: '🖥️ System',
  external: '🔗 External',
};

/**
 * Actor table format
 */
function renderActorTable(actors: Actor[], ctx: RenderContext): string {
  const headers = ['ID', 'Actor Name', 'Type', 'Description'];
  const rows = actors.map(a => [
    a.id,
    a.name,
    actorTypeLabels[a.type] || a.type,
    a.description || '-',
  ]);
  return ctx.markdown.table(headers, rows);
}

/**
 * Actor list format
 */
function renderActorList(actors: Actor[]): string {
  const lines = actors.map(a => {
    const typeIcon = a.type === 'human' ? '👤' : a.type === 'system' ? '🖥️' : '🔗';
    return `- ${typeIcon} **${a.name}**: ${a.description || '(no description)'}`;
  });
  return lines.join('\n');
}

// ============================================================================
// UseCase Rendering Helper Functions
// ============================================================================

/**
 * Use case table format
 */
function renderUseCaseTable(useCases: UseCase[], ctx: RenderContext): string {
  const headers = ['ID', 'Phase', 'Use Case Name', 'Actor'];
  const rows = useCases.map(uc => [
    uc.id,
    uc.phase || '-',
    uc.name,
    uc.actor,
  ]);
  return ctx.markdown.table(headers, rows);
}

/**
 * Use case list format
 */
function renderUseCaseList(useCases: UseCase[]): string {
  const lines = useCases.map(uc => {
    const phase = uc.phase ? `[${uc.phase}]` : '';
    return `- **${uc.id}** ${phase}: ${uc.name}`;
  });
  return lines.join('\n');
}
