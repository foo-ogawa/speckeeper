import { z } from 'zod';

// ============================================================================
// Phase definitions
// ============================================================================

export const PhaseSchema = z.enum(['REQ', 'HLD', 'LLD', 'IMPL', 'OPS', 'CI']);
export type Phase = z.infer<typeof PhaseSchema>;

export const PrioritySchema = z.enum(['must', 'should', 'could', 'wont']);
export type Priority = z.infer<typeof PrioritySchema>;

// ============================================================================
// ID types (using simple string types for now)
// ============================================================================

// ID types - all are strings with semantic meaning
export type RequirementId = string;
export type ComponentId = string;
export type BoundaryId = string;
export type LayerId = string;
export type EntityId = string;
export type RelationId = string;
export type RuleId = string;
export type ScreenId = string;
export type TransitionId = string;
export type FormId = string;
export type UIComponentId = string;
export type ProcessFlowId = string;
export type UseCaseId = string;
export type ActorId = string;
export type DTORequirementId = string;
export type EventRequirementId = string;
export type APIRefId = string;
export type TableRefId = string;
export type IaCRefId = string;
export type BatchRefId = string;
export type ErrorCaseId = string;
export type TermId = string;
export type StateId = string;

// ID creation helpers (no-op for now, but preserves API for future branding)
export const createRequirementId = (id: string): RequirementId => id;
export const createComponentId = (id: string): ComponentId => id;
export const createBoundaryId = (id: string): BoundaryId => id;
export const createLayerId = (id: string): LayerId => id;
export const createEntityId = (id: string): EntityId => id;
export const createRelationId = (id: string): RelationId => id;
export const createRuleId = (id: string): RuleId => id;
export const createScreenId = (id: string): ScreenId => id;
export const createTransitionId = (id: string): TransitionId => id;
export const createFormId = (id: string): FormId => id;
export const createUIComponentId = (id: string): UIComponentId => id;
export const createProcessFlowId = (id: string): ProcessFlowId => id;
export const createUseCaseId = (id: string): UseCaseId => id;
export const createActorId = (id: string): ActorId => id;
export const createDTORequirementId = (id: string): DTORequirementId => id;
export const createEventRequirementId = (id: string): EventRequirementId => id;
export const createAPIRefId = (id: string): APIRefId => id;
export const createTableRefId = (id: string): TableRefId => id;
export const createIaCRefId = (id: string): IaCRefId => id;
export const createBatchRefId = (id: string): BatchRefId => id;
export const createErrorCaseId = (id: string): ErrorCaseId => id;
export const createTermId = (id: string): TermId => id;
export const createStateId = (id: string): StateId => id;

// ============================================================================
// ID Pattern definitions
// ============================================================================

export const ID_PATTERNS = {
  requirement: /^REQ-[A-Z]+-\d{6}-[A-Z0-9]{4}$/,
  component: /^COMP-[A-Z]+-[A-Z0-9-]+$/,
  boundary: /^BND-[A-Z]+-[A-Z0-9-]+$/,
  layer: /^LAYER-[A-Z]+$/,
  entity: /^ENT-[A-Z]+-?[A-Z0-9-]*$/,
  relation: /^REL-[A-Z]+-[A-Z0-9-]+$/,
  rule: /^RULE-[A-Z0-9-]+$/,
  screen: /^SCR-[A-Z]+-?[A-Z0-9-]*$/,
  transition: /^TRANS-[A-Z0-9-]+$/,
  form: /^FORM-[A-Z0-9-]+$/,
  uiComponent: /^UI-[A-Z0-9-]+$/,
  processFlow: /^FLOW-[A-Z]+-[A-Z0-9-]+$/,
  useCase: /^UC-[A-Z]+-\d{3}$/,
  actor: /^ACTOR-[A-Z]+$/,
  dtoRequirement: /^DTO-REQ-[A-Z0-9-]+$/,
  eventRequirement: /^EVT-REQ-[A-Z0-9-]+$/,
  apiRef: /^API-[A-Z0-9-]+$/,
  tableRef: /^TBL-[A-Z0-9-]+$/,
  iacRef: /^IAC-[A-Z0-9-]+$/,
  batchRef: /^BATCH-[A-Z0-9-]+$/,
  errorCase: /^ERR-[A-Z]+-\d{3}$/,
  term: /^TERM-[A-Z0-9-]+$/,
} as const;

// ============================================================================
// Concretization Slot (TBD management)
// ============================================================================

export const ConcretizationSlotSchema = z.object({
  field: z.string(),
  mustDecideBy: PhaseSchema,
  value: z.union([z.string(), z.null()]).optional(),
  description: z.string().optional(),
});

export type ConcretizationSlot = z.infer<typeof ConcretizationSlotSchema>;

// ============================================================================
// Link types
// ============================================================================

export interface Link {
  type: 'requirement' | 'component' | 'entity' | 'screen' | 'usecase' | 'external';
  id: string;
  label?: string;
}

export const LinkSchema = z.object({
  type: z.enum(['requirement', 'component', 'entity', 'screen', 'usecase', 'external']),
  id: z.string(),
  label: z.string().optional(),
});

// ============================================================================
// Validation result types
// ============================================================================

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationError {
  severity: Severity;
  code: string;
  message: string;
  path?: string;
  id?: string;
  suggestions?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================================
// Generic model registry (Type definition)
// Note: Implementation is in utils/model-loader.ts
// ============================================================================

export interface ModelRegistrySchema {
  requirements: Map<RequirementId, unknown>;
  components: Map<ComponentId, unknown>;
  boundaries: Map<BoundaryId, unknown>;
  layers: Map<LayerId, unknown>;
  entities: Map<EntityId, unknown>;
  relations: Map<RelationId, unknown>;
  rules: Map<RuleId, unknown>;
  screens: Map<ScreenId, unknown>;
  transitions: Map<TransitionId, unknown>;
  forms: Map<FormId, unknown>;
  uiComponents: Map<UIComponentId, unknown>;
  processFlows: Map<ProcessFlowId, unknown>;
  useCases: Map<UseCaseId, unknown>;
  actors: Map<ActorId, unknown>;
  dtoRequirements: Map<DTORequirementId, unknown>;
  eventRequirements: Map<EventRequirementId, unknown>;
  apiRefs: Map<APIRefId, unknown>;
  tableRefs: Map<TableRefId, unknown>;
  iacRefs: Map<IaCRefId, unknown>;
  batchRefs: Map<BatchRefId, unknown>;
  errorCases: Map<ErrorCaseId, unknown>;
  terms: Map<TermId, unknown>;
}
