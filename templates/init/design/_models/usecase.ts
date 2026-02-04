/**
 * UseCase Model Definition
 */
import { z } from 'zod';
import { Model, RelationSchema } from 'spects';
import type { LintRule, Exporter, ModelLevel } from 'spects';

// =============================================================================
// Schema Definition
// =============================================================================

export const ActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['human', 'system', 'external']),
  relations: z.array(RelationSchema).optional(),
});

export const UseCaseStepSchema = z.object({
  stepNumber: z.number(),
  type: z.enum(['user_action', 'system_response', 'alternative']),
  description: z.string(),
});

export const UseCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  actor: z.string(),
  preconditions: z.array(z.string()).optional().default([]),
  postconditions: z.array(z.string()).optional().default([]),
  mainFlow: z.array(UseCaseStepSchema),
  relations: z.array(RelationSchema).optional(),
});

// =============================================================================
// Type Export
// =============================================================================

export type Actor = z.input<typeof ActorSchema>;
export type UseCaseStep = z.infer<typeof UseCaseStepSchema>;
export type UseCase = z.input<typeof UseCaseSchema>;

// =============================================================================
// Actor Model Class
// =============================================================================

class ActorModel extends Model<typeof ActorSchema> {
  readonly id = 'actor';
  readonly name = 'Actor';
  readonly idPrefix = 'ACT';
  readonly schema = ActorSchema;
  readonly description = 'Defines actors';
  protected modelLevel: ModelLevel = 'L0';

  protected lintRules: LintRule<Actor>[] = [
    {
      id: 'actor-has-description',
      severity: 'warning',
      message: 'Actor should have a description',
      check: (spec) => !spec.description || spec.description.trim() === '',
    },
  ];

  protected exporters: Exporter<Actor>[] = [];
}

// =============================================================================
// UseCase Model Class
// =============================================================================

class UseCaseModel extends Model<typeof UseCaseSchema> {
  readonly id = 'usecase';
  readonly name = 'UseCase';
  readonly idPrefix = 'UC';
  readonly schema = UseCaseSchema;
  readonly description = 'Defines use cases (business flows)';
  protected modelLevel: ModelLevel = 'L0';

  protected lintRules: LintRule<UseCase>[] = [
    {
      id: 'usecase-has-main-flow',
      severity: 'error',
      message: 'UseCase must have a main flow',
      check: (spec) => !spec.mainFlow || spec.mainFlow.length === 0,
    },
    {
      id: 'usecase-has-actor',
      severity: 'error',
      message: 'UseCase must have an actor',
      check: (spec) => !spec.actor || spec.actor.trim() === '',
    },
  ];

  protected exporters: Exporter<UseCase>[] = [];
}

export { ActorModel, UseCaseModel };
