/**
 * spects Use Cases - Use Case Definitions
 * 
 * Defines the main use cases for spects.
 */
import type { UseCase, Actor } from './_models/usecase.ts';

// ============================================================================
// Actor Definitions
// Synchronized with framework_requirements_spec.md "5. Stakeholders"
// ============================================================================

export const actors: Actor[] = [
  {
    id: 'UC-ACTOR-001',
    name: 'Requirements Engineer',
    type: 'human',
    description: 'PO/PM/Business representative. Defines requirements and acceptance criteria in TS models and generates documentation',
  },
  {
    id: 'UC-ACTOR-002',
    name: 'Design Engineer',
    type: 'human',
    description: 'Architect/Development lead. Defines logical architecture and concept models in TS models and generates C4/ER diagrams',
  },
  {
    id: 'UC-ACTOR-003',
    name: 'Implementation Engineer',
    type: 'human',
    description: 'App/Infrastructure developer. Defines screen specifications and process flows, checks consistency with external SSOT',
  },
  {
    id: 'UC-ACTOR-004',
    name: 'Operations Engineer',
    type: 'human',
    description: 'SRE/Operations staff. Manages observability requirements, Runbook and monitoring configuration consistency',
  },
  {
    id: 'UC-ACTOR-005',
    name: 'Reviewer',
    type: 'human',
    description: 'Quality/Security staff. Performs design reviews and verifies consistency check results',
  },
  {
    id: 'UC-ACTOR-SYS-001',
    name: 'CI/CD System',
    type: 'system',
    description: 'System that automatically executes lint/drift/check commands',
  },
];

// ============================================================================
// Use Case Definitions
// ============================================================================

export const useCases: UseCase[] = [
  // REQ Phase
  {
    id: 'UC-001',
    name: 'Define Requirements',
    description: 'Requirements engineer defines requirements using TypeScript DSL',
    actor: 'UC-ACTOR-001',
    phase: 'REQ',
    preconditions: [
      'spects is installed',
      'design/ directory exists in the project',
    ],
    postconditions: [
      'Requirements list Markdown has been generated',
      'Lint has verified requirement consistency, required fields, and reference integrity',
    ],
    relatedRequirements: ['FR-001', 'FR-002', 'FR-003'],
    mainFlow: [
      { stepNumber: 1, type: 'user_action', description: 'Requirements engineer creates or edits design/requirements.ts' },
      { stepNumber: 2, type: 'system_response', description: 'IDE displays type completion and validation errors' },
      { stepNumber: 3, type: 'user_action', description: 'Define requirements using DSL' },
      { stepNumber: 4, type: 'system_response', description: 'DSL builder validates input' },
      { stepNumber: 5, type: 'user_action', description: 'Run spects build' },
      { stepNumber: 6, type: 'system_response', description: 'Markdown is generated in docs/requirements/' },
      { stepNumber: 7, type: 'user_action', description: 'Run spects lint' },
      { stepNumber: 8, type: 'system_response', description: 'Requirement consistency is verified' },
    ],
    // L0(UseCase) traces→ L1(Requirement)
    relations: [
      { type: 'traces', target: 'FR-100', description: 'Related to common requirements' },
      { type: 'traces', target: 'FR-104', description: 'Related to model definition requirement' },
    ],
  },

  // HLD Phase
  {
    id: 'UC-002',
    name: 'Define Architecture',
    description: 'Design engineer defines components, boundaries, and layers',
    actor: 'UC-ACTOR-002',
    phase: 'HLD',
    preconditions: ['spects is installed', 'REQ phase is complete'],
    postconditions: ['C4 diagram has been generated', 'Lint has verified architecture consistency'],
    relatedRequirements: ['FR-004'],
    mainFlow: [
      { stepNumber: 1, type: 'user_action', description: 'Create or edit design/architecture.ts' },
      { stepNumber: 2, type: 'system_response', description: 'IDE displays type completion' },
      { stepNumber: 3, type: 'user_action', description: 'Define components and relationships' },
      { stepNumber: 4, type: 'system_response', description: 'DSL builder validates input' },
      { stepNumber: 5, type: 'user_action', description: 'Run spects build' },
      { stepNumber: 6, type: 'system_response', description: 'Mermaid C4 diagram is generated in docs/architecture/' },
      { stepNumber: 7, type: 'user_action', description: 'Run spects lint' },
      { stepNumber: 8, type: 'system_response', description: 'Layer violations, boundary crossings, etc. are verified' },
    ],
    relations: [
      { type: 'traces', target: 'FR-104', description: 'Related to model definition requirement' },
      { type: 'traces', target: 'FR-300', description: 'Related to build command requirement' },
      { type: 'traces', target: 'FR-500', description: 'Related to lint requirement' },
    ],
  },
  {
    id: 'UC-003',
    name: 'Define Screen Specifications',
    description: 'Design engineer defines screen list and screen transitions',
    actor: 'UC-ACTOR-002',
    phase: 'HLD',
    preconditions: ['spects is installed', 'REQ phase is complete'],
    postconditions: ['Screen transition diagram has been generated', 'Lint has verified screen consistency'],
    relatedRequirements: ['FR-004'],
    mainFlow: [
      { stepNumber: 1, type: 'user_action', description: 'Create or edit design/screens.ts' },
      { stepNumber: 2, type: 'system_response', description: 'IDE displays type completion' },
      { stepNumber: 3, type: 'user_action', description: 'Define screen list and transitions' },
      { stepNumber: 4, type: 'user_action', description: 'Run spects build' },
      { stepNumber: 5, type: 'system_response', description: 'Mermaid screen transition diagram is generated in docs/screens/' },
      { stepNumber: 6, type: 'user_action', description: 'Run spects lint' },
      { stepNumber: 7, type: 'system_response', description: 'Screen consistency is verified' },
    ],
  },

  // LLD Phase
  {
    id: 'UC-004',
    name: 'Define Concept Model',
    description: 'Design engineer defines entities, relations, and business rules',
    actor: 'UC-ACTOR-002',
    phase: 'LLD',
    preconditions: ['spects is installed', 'HLD phase is complete'],
    postconditions: ['ER diagram has been generated', 'Common vocabulary JSON has been generated'],
    relatedRequirements: ['FR-004', 'FR-005'],
    mainFlow: [
      { stepNumber: 1, type: 'user_action', description: 'Create or edit design/concept-model.ts' },
      { stepNumber: 2, type: 'system_response', description: 'IDE displays type completion' },
      { stepNumber: 3, type: 'user_action', description: 'Define entities and relations' },
      { stepNumber: 4, type: 'user_action', description: 'Run spects build' },
      { stepNumber: 5, type: 'system_response', description: 'Mermaid ER diagram is generated in docs/data-model/' },
      { stepNumber: 6, type: 'system_response', description: 'Common vocabulary JSON is generated in specs/schemas/' },
    ],
  },
  {
    id: 'UC-005',
    name: 'Define Form Details',
    description: 'Implementation engineer defines form fields and validation',
    actor: 'UC-ACTOR-003',
    phase: 'LLD',
    preconditions: ['spects is installed', 'Screen specifications are defined'],
    postconditions: ['Form requirement definition has been generated', 'Screen-API consistency has been verified'],
    relatedRequirements: ['FR-004'],
    mainFlow: [
      { stepNumber: 1, type: 'user_action', description: 'Add form definition to design/screens/forms/' },
      { stepNumber: 2, type: 'system_response', description: 'IDE displays type completion' },
      { stepNumber: 3, type: 'user_action', description: 'Define fields and validation' },
      { stepNumber: 4, type: 'user_action', description: 'Run spects build' },
      { stepNumber: 5, type: 'system_response', description: 'Form requirement definition is generated' },
      { stepNumber: 6, type: 'user_action', description: 'Run spects lint' },
      { stepNumber: 7, type: 'system_response', description: 'Form-request consistency is verified' },
    ],
  },

  // Implementation Phase
  {
    id: 'UC-006',
    name: 'Check External SSOT Consistency',
    description: 'Implementation engineer verifies consistency between TS models and external SSOT (OpenAPI/DDL)',
    actor: 'UC-ACTOR-003',
    phase: 'IMPL',
    preconditions: [
      'spects is installed',
      'APIRef/TableRef are defined',
      'Corresponding external SSOT files exist',
    ],
    postconditions: ['Consistency errors are reported if any'],
    relatedRequirements: ['FR-020', 'FR-033'],
    mainFlow: [
      { stepNumber: 1, type: 'user_action', description: 'Run spects check external-ssot' },
      { stepNumber: 2, type: 'system_response', description: 'Load OpenAPI/DDL files' },
      { stepNumber: 3, type: 'system_response', description: 'Verify requirement-external SSOT consistency' },
      { stepNumber: 4, type: 'system_response', description: 'Display verification results' },
    ],
    relations: [
      { type: 'traces', target: 'FR-600', description: 'Related to check command requirement' },
      { type: 'traces', target: 'FR-200', description: 'Related to external SSOT reference requirement' },
    ],
  },
  {
    id: 'UC-007',
    name: 'Link IDs to Implementation',
    description: 'Implementation engineer embeds componentId/entityId/requirementId in implementation code',
    actor: 'UC-ACTOR-003',
    phase: 'IMPL',
    preconditions: [
      'LLD phase is complete',
      'Implementation code generation by external tools is complete',
    ],
    postconditions: ['spects IDs are linked to implementation code'],
    relatedRequirements: [],
    mainFlow: [
      { stepNumber: 1, type: 'user_action', description: 'Add componentId/entityId to implementation code as comments or annotations' },
      { stepNumber: 2, type: 'user_action', description: 'Run spects impact to check impact scope' },
      { stepNumber: 3, type: 'system_response', description: 'Components and requirements related to the ID are listed' },
    ],
  },

  // OPS Phase
  {
    id: 'UC-008',
    name: 'Finalize Runbook and Monitoring Settings',
    description: 'Operations engineer finalizes runbook URLs, etc. and passes the final gate',
    actor: 'UC-ACTOR-004',
    phase: 'OPS',
    preconditions: [
      'spects is installed',
      'Implementation phase is complete',
    ],
    postconditions: ['All TBDs in OPS phase are resolved'],
    relatedRequirements: ['FR-012'],
    mainFlow: [
      { stepNumber: 1, type: 'user_action', description: 'Add runbook URLs, etc. to models under design/' },
      { stepNumber: 2, type: 'user_action', description: 'Run spects lint --phase OPS' },
      { stepNumber: 3, type: 'system_response', description: 'Required items for OPS phase are verified' },
      { stepNumber: 4, type: 'system_response', description: 'Report error if TBDs remain' },
    ],
  },

  // CI (Always Executed)
  {
    id: 'UC-010',
    name: 'Check Design Consistency',
    description: 'CI/CD system verifies model consistency',
    actor: 'UC-ACTOR-SYS-001',
    phase: 'CI',
    secondaryActors: ['UC-ACTOR-003'],
    preconditions: [
      'spects is installed',
      'Model files exist under design/',
    ],
    postconditions: ['Validation results are reported'],
    relatedRequirements: ['FR-010', 'FR-011', 'FR-012', 'FR-031'],
    mainFlow: [
      { stepNumber: 1, type: 'user_action', description: 'Run spects lint' },
      { stepNumber: 2, type: 'system_response', description: 'Verify ID uniqueness' },
      { stepNumber: 3, type: 'system_response', description: 'Verify reference integrity' },
      { stepNumber: 4, type: 'system_response', description: 'Verify layer dependency direction' },
      { stepNumber: 5, type: 'system_response', description: 'Display verification results to stdout' },
    ],
    relations: [
      { type: 'traces', target: 'FR-500', description: 'Related to lint command requirement' },
      { type: 'traces', target: 'FR-701', description: 'Related to inter-model relation requirement' },
    ],
  },
  {
    id: 'UC-011',
    name: 'Detect Drift',
    description: 'CI/CD system detects manual edits to generated artifacts',
    actor: 'UC-ACTOR-SYS-001',
    phase: 'CI',
    preconditions: [
      'spects is installed',
      'Generated artifacts exist under docs/ or specs/',
    ],
    postconditions: ['Exit with code 1 if drift exists'],
    relatedRequirements: ['FR-032'],
    mainFlow: [
      { stepNumber: 1, type: 'user_action', description: 'Run spects drift' },
      { stepNumber: 2, type: 'system_response', description: 'Regenerate artifacts from TS models' },
      { stepNumber: 3, type: 'system_response', description: 'Compare existing artifacts with regenerated artifacts' },
      { stepNumber: 4, type: 'system_response', description: 'Report if differences exist' },
    ],
    relations: [
      { type: 'traces', target: 'FR-400', description: 'Related to drift command requirement' },
    ],
  },
  {
    id: 'UC-012',
    name: 'Check Contract Consistency',
    description: 'CI/CD system verifies consistency between implementation and contract',
    actor: 'UC-ACTOR-SYS-001',
    phase: 'CI',
    preconditions: [
      'spects is installed',
      'Implementation code and contract definition exist',
    ],
    postconditions: ['Contract violations are reported if any'],
    relatedRequirements: ['FR-033'],
    mainFlow: [
      { stepNumber: 1, type: 'user_action', description: 'Run spects check contract' },
      { stepNumber: 2, type: 'system_response', description: 'Compare implementation and contract definition' },
      { stepNumber: 3, type: 'system_response', description: 'Report if violations exist' },
    ],
    relations: [
      { type: 'traces', target: 'FR-600', description: 'Related to check command requirement' },
    ],
  },
];

// ============================================================================
// Phase-based Workflow Summaries (for embedoc output)
// Summary of work done in each phase. Can be derived from use case mainFlow,
// but explicitly defined here for human readability.
// ============================================================================

export const phaseWorkflowSummaries: Record<string, string[]> = {
  REQ: [
    'Write requirements in TypeScript',
    'Generate Markdown/Mermaid via `build` (review on PR by viewing docs/)',
    'Verify requirement consistency, required fields, reference integrity, and phase gate via `lint`',
  ],
  HLD: [
    'Write logical architecture (`design/architecture.ts`) in TypeScript',
    'Generate Markdown/Mermaid via `build` (review on PR by viewing docs/)',
    'Verify architecture consistency (layer violations, boundary crossings, etc.) via `lint`',
    'Write screen specifications (`design/screens.ts`) in TypeScript',
    'Verify screen consistency via `lint`',
  ],
  LLD: [
    'Write concept model (`design/concept-model.ts`) in TypeScript',
    'Generate Markdown/Mermaid via `build` (review on PR by viewing docs/)',
    'Write form details (`design/screens/forms/`) in TypeScript',
  ],
  IMPL: [
    'Verify requirement-external SSOT consistency via `check external-ssot`',
    'Check change impact scope via `impact`',
  ],
  OPS: [
    'Finalize runbook URLs, etc. and pass the final gate',
  ],
  CI: [
    'Verify ID uniqueness, reference integrity, and layer dependency direction via `lint`',
    'Detect manual edits to artifacts via `drift`',
    'Verify implementation-contract consistency via `check contract`',
  ],
};

// Phase display order and labels
export const phaseConfig: Record<string, { order: number; label: string }> = {
  REQ: { order: 1, label: 'REQ Phase' },
  HLD: { order: 2, label: 'HLD Phase' },
  LLD: { order: 3, label: 'LLD Phase' },
  IMPL: { order: 4, label: 'Implementation Phase' },
  OPS: { order: 5, label: 'OPS Phase' },
  CI: { order: 6, label: 'CI (Always)' },
};

console.log('Use cases loaded successfully');
