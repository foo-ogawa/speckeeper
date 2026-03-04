/**
 * speckeeper Requirements - Requirement Definitions
 * 
 * Defines the functional and non-functional requirements for speckeeper itself.
 * 
 * Requirements are organized in a parent-child hierarchy and categorized as:
 * - FR-1xx: Common requirements (ID management, phase management, model definition)
 * - FR-2xx: External SSOT reference
 * - FR-3xx: Generation (build)
 * - FR-4xx: Lint/Validation
 * - FR-5xx: Drift check
 * - FR-6xx: External SSOT consistency check
 * - FR-7xx: Change impact analysis
 * - FR-8xx: Export
 * - FR-9xx: CLI Test Infrastructure
 */
import type { Requirement } from './_models/requirement.ts';
import { FunctionalRequirementModel, NonFunctionalRequirementModel, ConstraintModel } from './_models/requirement.ts';
import { defineSpecs } from '../src/core/model';

// ============================================================================
// Functional Requirements - 8.1 Common Requirements
// ============================================================================

const commonRequirements: Requirement[] = [
  // ---------------------------------------------------------------------------
  // FR-100: Common Requirements (Parent)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-100',
    name: 'Common Requirements (All Models)',
    description: 'Defines common requirements that apply to all models.',
    type: 'functional',
    priority: 'must',
    category: 'common',
    acceptanceCriteria: [
      { id: 'FR-100-01', description: 'All child requirements (FR-101, FR-102, FR-104) are satisfied', verificationMethod: 'review' },
    ],
    // L1(Requirement) satisfies→ L0(UseCase)
    relations: [
      { type: 'satisfies', target: 'UC-001', description: 'Satisfies requirement definition use case' },
      { type: 'satisfies', target: 'UC-002', description: 'Satisfies architecture definition use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-101: ID Management
  // ---------------------------------------------------------------------------
  {
    id: 'FR-101',
    name: 'ID Management',
    description: 'All model elements have a unique `id` and provide ID-based reference and consistency checking',
    type: 'functional',
    priority: 'must',
    category: 'common',
    parentId: 'FR-100',
    rationale: 'To prevent ID duplication, ensure reference integrity, and maintain traceability',
    acceptanceCriteria: [
      { id: 'FR-101-01', description: 'All model elements have a unique id', verificationMethod: 'test' },
      { id: 'FR-101-02', description: 'id follows conventions (e.g., REQ-OBS-001, ENT-ORDER, COMP-API)', verificationMethod: 'test' },
      { id: 'FR-101-03', description: 'References are expressed by ID and reference integrity checking is provided', verificationMethod: 'test' },
      { id: 'FR-101-04', description: 'ID changes detect all reference locations via reference integrity check (lint)', verificationMethod: 'test' },
    ],
    notes: `**Impact of ID Changes**
- ID changes detect all reference locations via reference integrity check (lint)
- **Change Impact Analysis CLI**: \`speckeeper impact {ID}\` lists the impact scope`,
    relations: [
      { type: 'satisfies', target: 'UC-001', description: 'Satisfies requirement definition use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-102: Phase Management
  // ---------------------------------------------------------------------------
  {
    id: 'FR-102',
    name: 'Phase Management',
    description: 'Set phase (REQ/HLD/LLD/OPS) on models and verify phase gates',
    type: 'functional',
    priority: 'must',
    category: 'common',
    parentId: 'FR-100',
    rationale: 'To ensure no items requiring resolution in subsequent phases remain',
    acceptanceCriteria: [
      { id: 'FR-102-01', description: 'Phase can be handled as REQ | HLD | LLD | OPS', verificationMethod: 'test' },
      { id: 'FR-102-02', description: 'Can set phase in model definition and verify phase gate', verificationMethod: 'test' },
      { id: 'FR-102-03', description: 'TBD is allowed/prohibited at specified phase', verificationMethod: 'test' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-001', description: 'Satisfies requirement definition use case' },
    ],
  },

  // FR-103 deleted (vacant)

  // ---------------------------------------------------------------------------
  // FR-104: Model Definition
  // ---------------------------------------------------------------------------
  {
    id: 'FR-104',
    name: 'Model Definition',
    description: 'Define and register project-specific models in TypeScript',
    type: 'functional',
    priority: 'must',
    category: 'common',
    parentId: 'FR-100',
    rationale: 'To define project-specific models (Requirement, Entity, Screen, Runbook, etc.) in a unified way',
    acceptanceCriteria: [
      { id: 'FR-104-01', description: 'Can define models by inheriting from Model base class', verificationMethod: 'test' },
      { id: 'FR-104-02', description: 'Can define runtime validation with Zod schema', verificationMethod: 'test' },
      { id: 'FR-104-03', description: 'Can define model-specific lint rules', verificationMethod: 'test' },
      { id: 'FR-104-04', description: 'Can define model-specific renderers (text output functions)', verificationMethod: 'test' },
      { id: 'FR-104-05', description: 'Can define external SSOT consistency checkers (optional)', verificationMethod: 'test' },
      { id: 'FR-104-06', description: 'Can register as models: [...] in speckeeper.config.ts', verificationMethod: 'demo' },
      { id: 'FR-104-07', description: 'Registered models become targets of lint/build/drift/check', verificationMethod: 'test' },
      { id: 'FR-104-08', description: 'Can set modelLevel on models to enable relation constraint verification', verificationMethod: 'test' },
      { id: 'FR-104-09', description: 'Can get model level (L0/L1/L2/L3) via Model.level property', verificationMethod: 'test' },
    ],
    notes: `**Model Definition Components**

| Element | Required | Description |
|---------|----------|-------------|
| \`id\` | ✓ | Unique identifier for the model |
| \`name\` | ✓ | Model name (for display) |
| \`idPrefix\` | ✓ | ID prefix (e.g., \`REQ-\`, \`ENT-\`) |
| \`schema\` | ✓ | Zod schema |
| \`modelLevel\` | | Model level (L0/L1/L2/L3) - Used for relation constraint verification |
| \`lintRules\` | | Model-specific lint rules |
| \`renderers\` | | Renderers (text output functions) |
| \`externalChecker\` | | External SSOT consistency checker |

**Defined Models (design/_models/)**

The following models are defined in this project:

| Model | ID Prefix | Purpose |
|-------|-----------|---------|
| Requirement | \`REQ-\` | Requirement definition |
| UseCase | \`UC-\` | Use case |
| Term | \`TERM-\` | Term definition |
| Architecture | \`COMP-\`/\`LAYER-\` | Architecture |
| ConceptModel | \`ENT-\`/\`REL-\` | Concept model |
| Screen | \`SCR-\` | Screen definition |
| ProcessFlow | \`FLOW-\` | Process flow |
| APIRef | \`API-\` | API reference (external SSOT) |
| TableRef | \`TBL-\` | Table reference (external SSOT) |
| IaCRef | \`IAC-\` | IaC reference (external SSOT) |
| BatchRef | \`BATCH-\` | Batch reference (external SSOT) |`,
    examples: [
      {
        language: 'typescript',
        code: `// Model definition example
import { z } from 'zod';
import { Model } from 'speckeeper';

const RunbookSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  symptoms: z.array(z.string()),
  steps: z.array(z.object({
    order: z.number(),
    action: z.string(),
    verification: z.string().optional(),
  })),
});

class RunbookModel extends Model<typeof RunbookSchema> {
  id = 'runbook';
  name = 'Runbook';
  idPrefix = 'RB';
  schema = RunbookSchema;
  
  lintRules = [
    {
      id: 'runbook-has-steps',
      severity: 'error',
      message: 'Runbook must have at least one step',
      check: (spec) => spec.steps.length === 0,
    },
  ];
  
  renderers = [
    {
      format: 'markdown',
      render: (specs, ctx) => specs.map(s => \`# \${s.title}\\n\${s.symptoms.join('\\n')}\`).join('\\n'),
    },
  ];
}`,
        description: 'Runbook model definition example',
      },
    ],
    seeAlso: [
      { label: 'Model definition examples', href: 'model-guide.md' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-001', description: 'Satisfies requirement definition use case' },
      { type: 'satisfies', target: 'UC-002', description: 'Satisfies architecture definition use case' },
      { type: 'satisfies', target: 'UC-004', description: 'Satisfies concept model definition use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-105: Project Initialization
  // ---------------------------------------------------------------------------
  {
    id: 'FR-105',
    name: 'Project Initialization',
    description: 'Initialize a new speckeeper project with starter templates and basic model definitions',
    type: 'functional',
    priority: 'should',
    category: 'common',
    parentId: 'FR-100',
    rationale: 'To provide a quick start experience for new users by generating project structure, configuration, and basic model definitions',
    acceptanceCriteria: [
      { id: 'FR-105-01', description: 'speckeeper init creates design/ directory structure', verificationMethod: 'test' },
      { id: 'FR-105-02', description: 'speckeeper init generates speckeeper.config.ts with default settings', verificationMethod: 'test' },
      { id: 'FR-105-03', description: 'speckeeper init generates package.json with type: module and dependencies', verificationMethod: 'test' },
      { id: 'FR-105-04', description: 'speckeeper init generates tsconfig.json for TypeScript support', verificationMethod: 'test' },
      { id: 'FR-105-05', description: 'speckeeper init generates basic model definitions in design/_models/', verificationMethod: 'test' },
      { id: 'FR-105-06', description: 'speckeeper init generates sample specification files', verificationMethod: 'test' },
      { id: 'FR-105-07', description: 'Generated project passes speckeeper lint without errors', verificationMethod: 'test' },
      { id: 'FR-105-08', description: 'Generated project passes typecheck without errors', verificationMethod: 'test' },
      { id: 'FR-105-09', description: 'speckeeper init --force overwrites existing files', verificationMethod: 'test' },
      { id: 'FR-105-10', description: 'speckeeper init skips package.json if it already exists (without --force)', verificationMethod: 'test' },
    ],
    notes: `**Generated Files**

| Path | Description |
|------|-------------|
| \`design/\` | Design directory root |
| \`design/_models/\` | Model definitions directory |
| \`design/_models/requirement.ts\` | Requirement model |
| \`design/_models/usecase.ts\` | UseCase and Actor models |
| \`design/_models/entity.ts\` | Entity model |
| \`design/_models/component.ts\` | Component model |
| \`design/_models/term.ts\` | Term model |
| \`design/_models/index.ts\` | Model exports |
| \`design/index.ts\` | Design entry point |
| \`design/requirements.ts\` | Sample requirements |
| \`speckeeper.config.ts\` | Configuration file |
| \`package.json\` | Package manifest (if not exists) |
| \`tsconfig.json\` | TypeScript configuration |`,
    examples: [
      {
        language: 'bash',
        code: `# Initialize a new project
npx speckeeper init

# Force overwrite existing files
npx speckeeper init --force`,
        description: 'Project initialization examples',
      },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-001', description: 'Satisfies requirement definition use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-106: Artifact Class-Based Scaffold (from specs/002)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-106',
    name: 'Artifact Class-Based Scaffold',
    description: 'Scaffold generates model files from a common base template based on artifact class specified in mermaid flowchart, replacing fixed node-to-template mappings',
    type: 'functional',
    priority: 'must',
    category: 'common',
    parentId: 'FR-105',
    rationale: 'To eliminate fixed template mappings (NODE_ALIAS, TEMPLATE_META, CHECKER_ALIAS) and enable flexible artifact type addition via class specification',
    acceptanceCriteria: [
      { id: 'FR-106-01', description: 'Scaffold recognizes artifact class on mermaid flowchart nodes and generates model files from a common base template', verificationMethod: 'test' },
      { id: 'FR-106-02', description: 'Artifact class is used for: (1) aggregating same-class nodes into one model file, (2) deriving model/file names from class name, (3) selecting checker bindings for external nodes', verificationMethod: 'test' },
      { id: 'FR-106-03', description: 'Multiple nodes with same artifact class are aggregated into a single model file', verificationMethod: 'test' },
      { id: 'FR-106-04', description: 'Nodes without artifact class are generated with base template using node ID as model name', verificationMethod: 'test' },
      { id: 'FR-106-05', description: 'Model name is PascalCase of node ID/class name, file name is kebab-case (e.g., class "requirement" → Model "Requirement", file "requirement.ts")', verificationMethod: 'test' },
      { id: 'FR-106-06', description: 'NODE_ALIAS (fixed node ID to template mapping) is removed', verificationMethod: 'test' },
      { id: 'FR-106-07', description: 'TEMPLATE_META (fixed template name to level/type/filename registry) is removed', verificationMethod: 'test' },
      { id: 'FR-106-08', description: 'CHECKER_ALIAS (fixed external node ID to checker template mapping) is removed', verificationMethod: 'test' },
      { id: 'FR-106-09', description: 'Fixed model template functions (requirement.ts, usecase.ts, term.ts, etc.) are removed; only base template remains', verificationMethod: 'test' },
    ],
    relations: [
      { type: 'refines', target: 'FR-105', description: 'Refines scaffold generation mechanism' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-107: Core-Provided Model Factories (from specs/002)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-107',
    name: 'Core-Provided Model Factories',
    description: 'speckeeper core provides generic lint rule, exporter, schema, test checker, and coverage checker factories to simplify model definitions',
    type: 'functional',
    priority: 'must',
    category: 'common',
    parentId: 'FR-104',
    rationale: 'To reduce model definition verbosity by extracting common patterns into reusable core-provided factories',
    acceptanceCriteria: [
      { id: 'FR-107-01', description: 'Core provides generic lint rule factories: field required check, array min length check, ID format check, child element ID format check', verificationMethod: 'test' },
      { id: 'FR-107-02', description: 'Core provides generic exporter factories: markdown single exporter (declarative title/metadata/section), markdown index exporter (declarative table columns)', verificationMethod: 'test' },
      { id: 'FR-107-03', description: 'Core provides common schema base (id, name, description, relations) that models extend with custom fields', verificationMethod: 'test' },
      { id: 'FR-107-04', description: 'Core provides test verification common logic (test file search, spec ID reference check, test result parsing) usable by specifying test file path only', verificationMethod: 'test' },
      { id: 'FR-107-05', description: 'Core provides relation-based coverage checker common logic (coverage calculation against all IDs of target model)', verificationMethod: 'test' },
      { id: 'FR-107-06', description: 'All core-provided factories are optional; custom logic can coexist with core factories', verificationMethod: 'test' },
    ],
    relations: [
      { type: 'refines', target: 'FR-104', description: 'Refines model definition by providing reusable factories' },
    ],
  },
];

// ============================================================================
// Functional Requirements - 8.2 External SSOT Reference
// ============================================================================

const modelRequirements: Requirement[] = [
  // ---------------------------------------------------------------------------
  // FR-200: External SSOT Reference
  // ---------------------------------------------------------------------------
  {
    id: 'FR-200',
    name: 'External SSOT Reference',
    description: 'Can define references to external SSOT (OpenAPI, DDL, IaC, etc.)',
    type: 'functional',
    priority: 'must',
    category: 'model',
    rationale: 'To manage API specifications and DB definitions with external tools while ensuring model consistency',
    acceptanceCriteria: [
      { id: 'FR-200-01', description: 'Provides basic interfaces for APIRef/TableRef/IaCRef/BatchRef', verificationMethod: 'test' },
      { id: 'FR-200-02', description: 'Can set file path and identifier for referenced target', verificationMethod: 'test' },
      { id: 'FR-200-03', description: 'Can associate with related components and entities', verificationMethod: 'test' },
    ],
    notes: `| Reference | Target | Main Consistency Checks |
|-----------|--------|------------------------|
| \`APIRef\` | OpenAPI | operationId existence, Entity consistency |
| \`TableRef\` | DDL/Prisma | Table existence, column consistency |
| \`IaCRef\` | CloudFormation/Terraform | Resource existence, type consistency |
| \`BatchRef\` | Step Functions/EventBridge | Definition existence, schedule consistency |`,
    seeAlso: [
      { label: 'External SSOT Reference Details', href: 'model-guide.md#10-external-ssot-reference' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-006', description: 'Satisfies external SSOT consistency check use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-201: External SSOT Path Configuration (from specs/002)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-201',
    name: 'External SSOT Path Configuration',
    description: 'External SSOT file paths (OpenAPI, DDL, test code, etc.) are configured in speckeeper.config.ts, not in mermaid flowcharts',
    type: 'functional',
    priority: 'must',
    category: 'model',
    parentId: 'FR-200',
    rationale: 'To centralize runtime configuration (file paths) in config file, keeping mermaid flowcharts as scaffold-only artifacts',
    acceptanceCriteria: [
      { id: 'FR-201-01', description: 'External SSOT file paths are defined in speckeeper.config.ts via ExternalSsotPaths', verificationMethod: 'test' },
      { id: 'FR-201-02', description: 'Mermaid flowchart is scaffold-only and does not contain runtime configuration such as file paths', verificationMethod: 'review' },
    ],
    relations: [
      { type: 'refines', target: 'FR-200', description: 'Refines external SSOT reference path management' },
    ],
  },
];

// ============================================================================
// Functional Requirements - 8.4 Generation (build)
// ============================================================================

const buildRequirements: Requirement[] = [
  // ---------------------------------------------------------------------------
  // FR-300: Generation (Parent)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-300',
    name: 'Generation (build)',
    description: 'Generate "human-readable artifacts (docs/)" and "machine-readable artifacts (specs/)" from TS models',
    type: 'functional',
    priority: 'must',
    category: 'build',
    acceptanceCriteria: [
      { id: 'FR-300-01', description: 'Can output human-readable artifacts (docs/)', verificationMethod: 'test' },
      { id: 'FR-300-02', description: 'Can output machine-readable artifacts (specs/)', verificationMethod: 'test' },
      { id: 'FR-300-03', description: 'Manual editing of artifacts is prohibited (subject to drift check)', verificationMethod: 'review' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-002', description: 'Satisfies architecture definition use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-301: Markdown Rendering Feature
  // ---------------------------------------------------------------------------
  {
    id: 'FR-301',
    name: 'Rendering Feature for External Programs',
    description: 'Models provide text rendering functionality callable from external programs',
    type: 'functional',
    priority: 'must',
    category: 'build',
    parentId: 'FR-300',
    rationale: 'To make model rendering functionality available to external programs (template engines, document generation tools, etc.)',
    acceptanceCriteria: [
      { id: 'FR-301-01', description: 'Can define rendering functions in Model class via renderers property', verificationMethod: 'test' },
      { id: 'FR-301-02', description: 'Rendering can be invoked via common interface from external programs', verificationMethod: 'test' },
      { id: 'FR-301-03', description: 'Rendering results switch internally based on model class', verificationMethod: 'test' },
      { id: 'FR-301-04', description: 'Output format can be specified via format parameter', verificationMethod: 'test' },
      { id: 'FR-301-05', description: 'Regeneration produces identical content (idempotency)', verificationMethod: 'test' },
    ],
    notes: `**Design Policy**

- speckeeper itself does not directly generate documents (docs/)
- External programs (template engines, etc.) invoke model rendering functionality to generate documents
- Model-specific rendering logic is consolidated in \`design/_models/\`
- Common rendering interface (\`Renderer\`) is provided

**Rendering Interface**

| Method | Description |
|--------|-------------|
| \`model.render(format, specs, ctx)\` | Render in specified format |
| \`model.hasRenderer(format)\` | Check if format is available |
| \`model.getAvailableFormats()\` | List available formats |

**RenderContext**

| Property | Description |
|----------|-------------|
| \`params\` | Parameters (filter conditions, etc.) |
| \`markdown.table()\` | Markdown table generation helper |`,
    examples: [
      {
        language: 'typescript',
        code: `// Model renderers definition example
protected renderers: Renderer<MySpec>[] = [
  {
    format: 'table',
    render: (specs, ctx) => ctx.markdown.table(
      ['ID', 'Name'],
      specs.map(s => [s.id, s.name])
    ),
  },
  {
    format: 'list',
    render: (specs, _ctx) => specs.map(s => \`- \${s.id}: \${s.name}\`).join('\\n'),
  },
];

// Invocation example from external program
import { myModel } from '../design/_models/my-model.ts';

const table = myModel.render('table', specs, ctx);
const list = myModel.render('list', specs, ctx);`,
        description: 'Rendering functionality definition and invocation example',
      },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-002', description: 'Satisfies architecture definition use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-302: Machine-readable Artifacts
  // ---------------------------------------------------------------------------
  {
    id: 'FR-302',
    name: 'Machine-readable Artifacts (specs/)',
    description: 'Generate JSON Schema and requirement definitions from concept model entities',
    type: 'functional',
    priority: 'must',
    category: 'build',
    parentId: 'FR-300',
    rationale: 'For use as contract definitions with external systems, validation, and input for lint/check/impact analysis',
    acceptanceCriteria: [
      { id: 'FR-302-01', description: 'Entity attributes are mapped to JSON Schema properties', verificationMethod: 'test' },
      { id: 'FR-302-02', description: 'Can output reference resolution graph (specs/index.json)', verificationMethod: 'test' },
    ],
    notes: `| Output | Content |
|--------|---------|
| \`specs/schemas/entities/\` | JSON Schema (concept Entity common vocabulary) |
| \`specs/index.json\` | Reference resolution graph (ID list and reference relations for all models) |

> **Note**: speckeeper **does not generate implementation code**.
> Implementation code is generated by external tools from external SSOT:
> - API contract → External tools (generated from OpenAPI)
> - DB connection → ORM/DDL tools (generated from DDL/Prisma)`,
    relations: [
      { type: 'satisfies', target: 'UC-002', description: 'Satisfies architecture definition use case' },
    ],
  },
];

// ============================================================================
// Functional Requirements - 8.5 Lint/Validation
// ============================================================================

const lintRequirements: Requirement[] = [
  // ---------------------------------------------------------------------------
  // FR-400: Lint/Validation (Parent)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-400',
    name: 'Lint/Validation',
    description: 'Provides lint functionality to verify model consistency',
    type: 'functional',
    priority: 'must',
    category: 'lint',
    acceptanceCriteria: [
      { id: 'FR-400-01', description: 'Can verify common lint items', verificationMethod: 'test' },
      { id: 'FR-400-02', description: 'Can define and execute model-specific custom lint rules', verificationMethod: 'test' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-010', description: 'Satisfies design consistency check use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-401: Common Lint Items
  // ---------------------------------------------------------------------------
  {
    id: 'FR-401',
    name: 'Common Lint Items',
    description: 'Verify common lint items that apply to all models',
    type: 'functional',
    priority: 'must',
    category: 'lint',
    parentId: 'FR-400',
    rationale: 'ID duplication and reference inconsistencies break traceability',
    acceptanceCriteria: [
      { id: 'FR-401-01', description: 'Verify IDs are not duplicated within the same type', verificationMethod: 'test' },
      { id: 'FR-401-02', description: 'Verify IDs follow conventions', verificationMethod: 'test' },
      { id: 'FR-401-03', description: 'Verify referenced targets exist', verificationMethod: 'test' },
      { id: 'FR-401-04', description: 'Verify no circular references exist', verificationMethod: 'test' },
      { id: 'FR-401-05', description: 'Verify no TBDs remain at specified phase', verificationMethod: 'test' },
      { id: 'FR-401-06', description: 'Detect orphan elements (entities without relations, etc.)', verificationMethod: 'test' },
    ],
    notes: `| Check Item | Description |
|------------|-------------|
| ID Uniqueness | IDs are not duplicated within the same type |
| ID Format | IDs follow conventions |
| Reference Integrity | Referenced targets exist |
| Circular Reference | No circular references |
| Phase Gate | No TBDs remain at specified phase |
| Orphan Elements | Detect entities without relations, etc. |`,
    relations: [
      { type: 'satisfies', target: 'UC-010', description: 'Satisfies design consistency check use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-402: Custom Lint Rules
  // ---------------------------------------------------------------------------
  {
    id: 'FR-402',
    name: 'Custom Lint Rules',
    description: 'Each model can define lintRules to verify model-specific constraints',
    type: 'functional',
    priority: 'must',
    category: 'lint',
    parentId: 'FR-400',
    rationale: 'To verify model-specific constraints (layer violations, required attributes, etc.)',
    acceptanceCriteria: [
      { id: 'FR-402-01', description: 'Can set lintRules in Model definition', verificationMethod: 'test' },
      { id: 'FR-402-02', description: 'Can set severity (error/warning/info)', verificationMethod: 'test' },
      { id: 'FR-402-03', description: 'Lint results include rule ID, message, and target ID', verificationMethod: 'test' },
    ],
    examples: [
      {
        language: 'typescript',
        code: `lintRules: LintRule<T>[] = [
  {
    id: 'rule-id',
    severity: 'error' | 'warning' | 'info',
    message: 'Error message',
    check: (spec) => /* true if problem exists */,
  },
];`,
        description: 'Custom lint rule definition example',
      },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-010', description: 'Satisfies design consistency check use case' },
    ],
  },
];

// ============================================================================
// Functional Requirements - 8.6 Drift Check
// ============================================================================

const driftRequirements: Requirement[] = [
  {
    id: 'FR-500',
    name: 'Drift Check',
    description: 'Detect if artifacts (docs/, specs/) have been manually edited',
    type: 'functional',
    priority: 'must',
    category: 'drift',
    rationale: 'To detect divergence between TS models and artifacts and maintain SSOT principle',
    acceptanceCriteria: [
      { id: 'FR-500-01', description: 'After build execution, detect differences between generated docs//specs/ and committed files', verificationMethod: 'test' },
      { id: 'FR-500-02', description: 'Fail CI when differences are found', verificationMethod: 'test' },
      { id: 'FR-500-03', description: 'Output message prompting to "regenerate and commit"', verificationMethod: 'test' },
      { id: 'FR-500-04', description: 'Manual editing of artifacts is prohibited (detected by drift)', verificationMethod: 'review' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-011', description: 'Satisfies drift detection use case' },
    ],
  },
];

// ============================================================================
// Functional Requirements - 8.7 External SSOT Consistency Check
// ============================================================================

const externalCheckRequirements: Requirement[] = [
  // ---------------------------------------------------------------------------
  // FR-600: External SSOT Consistency Check (Parent)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-600',
    name: 'External SSOT Consistency Check',
    description: 'Verify consistency between TS models (external SSOT references) and external SSOT (OpenAPI, DDL, IaC, etc.)',
    type: 'functional',
    priority: 'must',
    category: 'check',
    acceptanceCriteria: [
      { id: 'FR-600-01', description: 'Existence check (referenced items exist in external artifacts)', verificationMethod: 'test' },
      { id: 'FR-600-02', description: 'Type check (expected type/class/category matches)', verificationMethod: 'test' },
      { id: 'FR-600-03', description: 'Constraint check (non-functional/guardrails are satisfied)', verificationMethod: 'test' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-006', description: 'Satisfies external SSOT consistency check use case' },
      { type: 'satisfies', target: 'UC-012', description: 'Satisfies contract consistency check use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-601: Three Categories of Consistency Check
  // ---------------------------------------------------------------------------
  {
    id: 'FR-601',
    name: 'Three Categories of Consistency Check',
    description: 'All external SSOT consistency checks are uniformly composed of existence, type, and constraint categories',
    type: 'functional',
    priority: 'must',
    category: 'check',
    parentId: 'FR-600',
    acceptanceCriteria: [
      { id: 'FR-601-01', description: 'Existence: Referenced items exist in external artifacts', verificationMethod: 'test' },
      { id: 'FR-601-02', description: 'Type: Expected type/class/category matches', verificationMethod: 'test' },
      { id: 'FR-601-03', description: 'Constraints: Non-functional/guardrails are satisfied', verificationMethod: 'test' },
    ],
    notes: `| Category | Content | Examples |
|----------|---------|----------|
| **Existence** | Referenced items exist in external artifacts | operationId existence, table existence |
| **Type** | Expected type/class/category matches | resourceType match, columnType match |
| **Constraints** | Non-functional/guardrails are satisfied | Encryption required, PII classification |`,
    relations: [
      { type: 'satisfies', target: 'UC-006', description: 'Satisfies external SSOT consistency check use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-602: Check Command
  // ---------------------------------------------------------------------------
  {
    id: 'FR-602',
    name: 'Check Command',
    description: 'Provide CLI command to execute external SSOT consistency check',
    type: 'functional',
    priority: 'must',
    category: 'check',
    parentId: 'FR-600',
    rationale: 'Since consistency checks are implemented per model, filter by model name',
    acceptanceCriteria: [
      { id: 'FR-602-01', description: 'speckeeper check runs external SSOT consistency check for all models', verificationMethod: 'test' },
      { id: 'FR-602-02', description: 'speckeeper check --model <model-name> checks only specific model', verificationMethod: 'test' },
      { id: 'FR-602-03', description: 'Model name is the model ID defined in design/_models/', verificationMethod: 'review' },
      { id: 'FR-602-04', description: 'Only models with externalChecker are targeted', verificationMethod: 'test' },
    ],
    examples: [
      {
        language: 'bash',
        code: `# External SSOT consistency check for all models
speckeeper check

# Check specific model only
speckeeper check --model api-ref      # APIRef consistency only
speckeeper check --model table-ref    # TableRef consistency only
speckeeper check --model iac-ref      # IaCRef consistency only
speckeeper check --model batch-ref    # BatchRef consistency only

# Specify multiple models
speckeeper check --model api-ref --model table-ref`,
        description: 'Check command examples',
      },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-006', description: 'Satisfies external SSOT consistency check use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-603: External Checker
  // ---------------------------------------------------------------------------
  {
    id: 'FR-603',
    name: 'External Checker',
    description: 'Each model can define externalChecker to implement consistency check with external SSOT',
    type: 'functional',
    priority: 'must',
    category: 'check',
    parentId: 'FR-600',
    rationale: 'Clarify model responsibilities by including external SSOT consistency check logic in model definition',
    acceptanceCriteria: [
      { id: 'FR-603-01', description: 'Can set externalChecker in Model definition', verificationMethod: 'test' },
      { id: 'FR-603-02', description: 'externalChecker includes target file reading and check logic', verificationMethod: 'test' },
      { id: 'FR-603-03', description: 'Check results include success, errors, warnings', verificationMethod: 'test' },
      { id: 'FR-603-04', description: 'speckeeper check command auto-detects and runs models with externalChecker', verificationMethod: 'test' },
    ],
    notes: `**External Checker Structure**

| Property | Description |
|----------|-------------|
| \`sourcePath\` | Function that returns the target file path |
| \`check\` | Check logic body |`,
    examples: [
      {
        language: 'typescript',
        code: `// design/_models/api-ref.ts
externalChecker: ExternalChecker<APIRef> = {
  sourcePath: (spec) => spec.source.path,
  check: (spec, openApiDoc) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // operationId existence check
    if (!findOperationId(openApiDoc, spec.operationId)) {
      errors.push(\`operationId '\${spec.operationId}' not found\`);
    }
    
    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  },
};`,
        description: 'External checker definition example',
      },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-006', description: 'Satisfies external SSOT consistency check use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-604: Coverage Verification (Cross-model)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-604',
    name: 'Coverage Verification',
    description: 'Use Model class coverageChecker to verify cross-model coverage',
    type: 'functional',
    priority: 'should',
    category: 'check',
    parentId: 'FR-600',
    rationale: 'To verify cross-model consistency (coverage) and prevent gaps',
    acceptanceCriteria: [
      { id: 'FR-604-01', description: 'Execute coverage verification with speckeeper check --coverage', verificationMethod: 'test' },
      { id: 'FR-604-02', description: 'Define coverageChecker interface in Model class', verificationMethod: 'test' },
      { id: 'FR-604-03', description: 'Auto-detect and execute models with coverageChecker', verificationMethod: 'test' },
      { id: 'FR-604-04', description: 'Calculate and display coverage rate (%)', verificationMethod: 'test' },
      { id: 'FR-604-05', description: 'List uncovered items', verificationMethod: 'test' },
    ],
    examples: [
      {
        language: 'bash',
        code: `# Coverage verification
speckeeper check --coverage

# Output example
Test Coverage Report
─────────────────────────────────────
Total testable criteria:  70
Covered by TestRef:       70
Not covered:              0

Coverage: 100%`,
        description: 'Coverage verification command execution example',
      },
    ],
    notes: `**coverageChecker Design**

| Property | Description |
|----------|-------------|
| \`targetModel\` | Target model ID for coverage ('requirement', etc.) |
| \`description\` | Coverage check description |
| \`check\` | Coverage check function (receives registry of all models) |

**Example: TestRef model coverageChecker**

Verifies that acceptanceCriteria with \`verificationMethod: 'test'\` specific to design/
are covered by TestRef.testCasePatterns.
Coverage logic is defined in each project's design/.`,
    relations: [
      { type: 'refines', target: 'FR-600', description: 'Concretization of external SSOT consistency check (coverage)' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-605: Model-Integrated Check Architecture (from specs/002)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-605',
    name: 'Model-Integrated Check Architecture',
    description: 'External SSOT and test verification logic is integrated into _models/ definitions, eliminating the separate _checkers/ directory',
    type: 'functional',
    priority: 'must',
    category: 'check',
    parentId: 'FR-600',
    rationale: 'To consolidate check logic with model definitions, reducing management overhead and ensuring model-check consistency',
    acceptanceCriteria: [
      { id: 'FR-605-01', description: 'Scaffold does not generate _checkers/ directory', verificationMethod: 'test' },
      { id: 'FR-605-02', description: 'Verification logic is included in _models/ model definitions', verificationMethod: 'test' },
      { id: 'FR-605-03', description: 'speckeeper check external-ssot uses verification logic from _models/ model definitions only', verificationMethod: 'test' },
      { id: 'FR-605-04', description: 'speckeeper check external-ssot does not reference _checkers/ directory', verificationMethod: 'test' },
      { id: 'FR-605-05', description: 'Checker template functions (src/scaffold/templates/checkers/) are removed; checker logic moves to core DSL (src/core/dsl/)', verificationMethod: 'test' },
    ],
    relations: [
      { type: 'refines', target: 'FR-600', description: 'Refines check architecture by integrating into models' },
      { type: 'refines', target: 'FR-603', description: 'Refines external checker by model integration' },
    ],
  },
];

// ============================================================================
// Functional Requirements - 8.8 Change Impact Analysis
// ============================================================================

const impactRequirements: Requirement[] = [
  // ---------------------------------------------------------------------------
  // FR-700: Change Impact Analysis (Parent)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-700',
    name: 'Change Impact Analysis',
    description: 'Analyze and list impact scope when IDs change',
    type: 'functional',
    priority: 'should',
    category: 'impact',
    rationale: 'To understand the impact of changes in advance and support safe refactoring',
    acceptanceCriteria: [
      { id: 'FR-700-01', description: 'Analyze and list impact scope with speckeeper impact {ID}', verificationMethod: 'test' },
      { id: 'FR-700-02', description: 'Define relations between models and track associations', verificationMethod: 'test' },
      { id: 'FR-700-03', description: 'Reference depth (--depth) can be specified', verificationMethod: 'test' },
      { id: 'FR-700-04', description: 'Display impacted specs, components, and documents', verificationMethod: 'test' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-010', description: 'Satisfies design consistency check use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-701: Inter-model Relations
  // ---------------------------------------------------------------------------
  {
    id: 'FR-701',
    name: 'Inter-model Relations',
    description: 'Define relations between models to enable impact scope tracking',
    type: 'functional',
    priority: 'should',
    category: 'impact',
    parentId: 'FR-700',
    rationale: 'Explicitly defining relations between models improves change impact analysis accuracy',
    acceptanceCriteria: [
      { id: 'FR-701-01', description: 'Can define relations via relations property in model definition', verificationMethod: 'test' },
      { id: 'FR-701-02', description: 'Provides standard relation types', verificationMethod: 'review' },
      { id: 'FR-701-03', description: 'Relations are used as input for impact analysis', verificationMethod: 'test' },
      { id: 'FR-701-04', description: 'Define source/target model level constraints per relation type', verificationMethod: 'test' },
      { id: 'FR-701-05', description: 'Level violations and circular references can be detected by lint', verificationMethod: 'test' },
    ],
    notes: `**Model Level Definition**

Models are classified into the following levels by abstraction (L0 is most abstract):

| Level | Perspective | Model Examples | Description |
|-------|-------------|----------------|-------------|
| L0 (Business+Domain) | Why / Problem space | UseCase, Actor, Term, Goal | Outcomes/values to achieve, business flows, terminology, business rules |
| L1 (Requirements) | What | Requirement, Constraint | Functional/non-functional requirements, constraints, acceptance criteria |
| L2 (Design) | How (Policy) | Component, Entity, ProcessFlow | Architecture, structure, domain model, policies |
| L3 (Detailed Design/Implementation) | How to build | Screen, APIRef, TableRef, IaCRef | Concrete screen/API/DB definitions, external SSOT references |

\`\`\`
Abstract ◄───────────────────────────────────────────────────► Concrete
   L0                L1              L2                L3
Business+Domain → Requirements → Design (Policy) → Detailed Design/Implementation
   (Why)           (What)           (How)           (How to build)
\`\`\`

**Relation Types and Level Constraints**

| Type | Source(A) | Target(B) | Level Constraint | Description |
|------|-----------|-----------|------------------|-------------|
| \`implements\` | L2,L3 | L1 | A.level > B.level | Design/implementation implements requirements |
| \`satisfies\` | L1,L2,L3 | L0,L1 | A.level >= B.level | Design satisfies business/requirements |
| \`refines\` | L1,L2,L3 | L0,L1 | A.level > B.level | Requirements refine business, design refines requirements |
| \`verifies\` | any | L0,L1 | - | Tests verify business/requirements |
| \`dependsOn\` | any | any | A.level >= B.level | Same level or concrete→abstract |
| \`uses\` | any | any | - | Runtime reference (no level constraint) |
| \`includes\` | any | any | same level | Inclusion within same level |
| \`traces\` | any | any | - | Bidirectional tracking (no level constraint) |
| \`relatedTo\` | any | any | - | General relation (no level constraint) |

**Prohibited Relation Patterns (Lint Error)**

| Pattern | Reason | Example |
|---------|--------|---------|
| Abstract→Concrete \`implements\` | Wrong direction | Requirement → Screen ❌ |
| Abstract→Concrete \`satisfies\` | Wrong direction | UseCase → Component ❌ |
| Abstract→Concrete \`refines\` | Wrong direction | UseCase → Screen ❌ |
| Circular reference | Infinite loop | A→B→C→A ❌ |
| Self-reference | Meaningless | A→A ❌ |

**Circular Reference Detection Rules**

Circular references are detected under the following conditions:

1. **Direct cycle**: A implements B, B implements A
2. **Indirect cycle**: A→B→C→A (any combination of relation types)
3. **Level violation cycle**: Concrete→Abstract→Concrete (level returns)

\`\`\`
Cycle patterns to detect:
┌─────────────────────────────────────────────────┐
│ Allowed: L0 ← L1 ← L2 ← L3 (one direction only)│
│                                                 │
│ Prohibited: L0 ← L1 ← L2 → L1 (level returns) │
│             └───────────────────┘               │
│                   cycle                         │
└─────────────────────────────────────────────────┘
\`\`\`

**Impact Propagation Direction**

| Type | Direction | Description |
|------|-----------|-------------|
| \`implements\` | A change→Check B | Verify requirement satisfaction on implementation change |
| \`satisfies\` | B change→Update A | Update design on business/requirement change |
| \`refines\` | B change→Update A | Update detail on parent change |
| \`verifies\` | B change→Update A | Update tests on business/requirement change |
| \`dependsOn\` | B change→A impacted | Dependent impacted by dependency change |
| \`uses\` | B change→A impacted | User impacted by used change |
| \`includes\` | B change→A impacted | Whole impacted by part change |
| \`traces\` | Bidirectional | Detect tracked element changes |
| \`relatedTo\` | Bidirectional | Detect related element changes |

**Typical Relations Between Levels**

\`\`\`
L0 (Business+Domain)      L1 (Requirements)    L2 (Design)          L3 (Detailed Design/Impl)
┌──────────┐             ┌──────────┐        ┌──────────┐        ┌──────────┐
│ UseCase  │◄────────────│Requirement│◄───────│Component │◄───────│  Screen  │
│          │   refines   │          │implements          │dependsOn│          │
└──────────┘             └──────────┘        └──────────┘        └──────────┘
     ▲                        ▲                   ▲                   │
     │traces                  │satisfies          │uses               │uses
     │                        │                   │                   ▼
┌──────────┐             ┌──────────┐        ┌──────────┐        ┌──────────┐
│  Actor   │             │Constraint │       │  Entity  │        │ APIRef   │
│  Term    │             │          │        │ProcessFlow│       │ TableRef │
│  Goal    │             │          │        │          │        │          │
└──────────┘             └──────────┘        └──────────┘        └──────────┘
   Why /                     What               How                How to
   Problem space                              (Policy)             build
\`\`\``,
    seeAlso: [
      { label: 'Relation implementation', href: '../src/core/relation.ts' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-001', description: 'Satisfies requirement definition use case' },
      { type: 'satisfies', target: 'UC-002', description: 'Satisfies architecture definition use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-702: Verified-By / Verifies Relation Types (from specs/002)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-702',
    name: 'Verified-By / Verifies Relation Types',
    description: 'Add verifiedBy relation type (spec→test code) and redefine verifies (test code→implementation code) for semantic accuracy',
    type: 'functional',
    priority: 'must',
    category: 'impact',
    parentId: 'FR-701',
    rationale: 'To express spec-test-implementation relationships with semantically accurate relation names instead of overloading implements',
    acceptanceCriteria: [
      { id: 'FR-702-01', description: 'verifiedBy is added as RelationType with edge category "check" (spec→test code direction)', verificationMethod: 'test' },
      { id: 'FR-702-02', description: 'verifies is redefined as "test code tests implementation code" (test→implementation direction)', verificationMethod: 'test' },
      { id: 'FR-702-03', description: 'verifiedBy between speckeeper→speckeeper nodes produces a warning', verificationMethod: 'test' },
      { id: 'FR-702-04', description: 'Same source node can have both implements and verifiedBy edges, each verified independently', verificationMethod: 'test' },
      { id: 'FR-702-05', description: 'verifies (typically external→external) is recognized for traceability but not a checker generation target', verificationMethod: 'test' },
    ],
    relations: [
      { type: 'refines', target: 'FR-701', description: 'Refines inter-model relation types with verifiedBy/verifies' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-703: Edge Type-Specific Relation Schema (from specs/002)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-703',
    name: 'Edge Type-Specific Relation Schema',
    description: 'implements and verifiedBy relations have edge-type-specific schemas (ImplementsRelationSchema, VerifiedByRelationSchema) with additional properties beyond target ID',
    type: 'functional',
    priority: 'must',
    category: 'impact',
    parentId: 'FR-701',
    rationale: 'To define structured relation data (path, target type, etc.) per edge type instead of using generic relation schema',
    acceptanceCriteria: [
      { id: 'FR-703-01', description: 'implements and verifiedBy have edge-type-specific schemas with additional properties (path, target type, etc.)', verificationMethod: 'test' },
      { id: 'FR-703-02', description: 'Scaffold generates checker binding guidance comments when implements/verifiedBy edges are detected', verificationMethod: 'test' },
      { id: 'FR-703-03', description: 'Edge-type-specific relation schemas are provided by core; no manual definition needed in model definitions', verificationMethod: 'test' },
    ],
    relations: [
      { type: 'refines', target: 'FR-701', description: 'Refines relation schema with edge-type-specific structures' },
    ],
  },
];

// ============================================================================
// Functional Requirements - 8.9 Artifact Export
// ============================================================================

const exportRequirements: Requirement[] = [
  {
    id: 'FR-800',
    name: 'Artifact Export (optional)',
    description: 'Output aggregated JSON for machine processing',
    type: 'functional',
    priority: 'could',
    category: 'export',
    acceptanceCriteria: [
      { id: 'FR-800-01', description: 'Can output aggregated JSON for machine processing (specs/index.json)', verificationMethod: 'test' },
      { id: 'FR-800-02', description: 'Can be used for future tool integration (dashboards, requirement lists, progress visualization)', verificationMethod: 'review' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-002', description: 'Satisfies architecture definition use case' },
    ],
  },
];

// ============================================================================
// Functional Requirements - 8.10 CLI Test Infrastructure (from specs/001)
// ============================================================================

const testRequirements: Requirement[] = [
  // ---------------------------------------------------------------------------
  // FR-900: CLI Test Infrastructure (Parent)
  // ---------------------------------------------------------------------------
  {
    id: 'FR-900',
    name: 'CLI Test Infrastructure',
    description: 'Ensure all CLI commands have comprehensive test coverage with traceability to specifications',
    type: 'functional',
    priority: 'must',
    category: 'test',
    acceptanceCriteria: [
      { id: 'FR-900-01', description: 'All child requirements (FR-901~FR-904) are satisfied', verificationMethod: 'review' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-010', description: 'Satisfies design consistency check use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-901: CLI Command Test Coverage
  // ---------------------------------------------------------------------------
  {
    id: 'FR-901',
    name: 'CLI Command Test Coverage',
    description: 'Each CLI command (lint, check, build, impact, drift, new) has a corresponding test file in test/cli/ with requirement ID references',
    type: 'functional',
    priority: 'must',
    category: 'test',
    parentId: 'FR-900',
    rationale: 'To prevent regression bugs in CLI commands that directly affect all users and CI pipelines',
    acceptanceCriteria: [
      { id: 'FR-901-01', description: 'Test files exist in test/cli/ for each CLI command (lint, check, build, impact, drift, new)', verificationMethod: 'test' },
      { id: 'FR-901-02', description: 'describe/it block names contain corresponding requirement IDs (FR-xxx)', verificationMethod: 'test' },
      { id: 'FR-901-03', description: 'CLI module statement coverage reaches 60% or above (from 0%)', verificationMethod: 'test' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-010', description: 'Satisfies design consistency check use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-902: Test-Specification Traceability
  // ---------------------------------------------------------------------------
  {
    id: 'FR-902',
    name: 'Test-Specification Traceability',
    description: 'TestRef definitions in design/test-refs.ts provide bidirectional traceability between tests and specifications',
    type: 'functional',
    priority: 'must',
    category: 'test',
    parentId: 'FR-900',
    rationale: 'To ensure all acceptance criteria are covered by test cases and maintain spec-test traceability',
    acceptanceCriteria: [
      { id: 'FR-902-01', description: 'TestRef definitions (TEST-020~025) exist in design/test-refs.ts for each CLI test file', verificationMethod: 'test' },
      { id: 'FR-902-02', description: 'TestRefs are linked to corresponding command IDs via implementsCommand', verificationMethod: 'test' },
      { id: 'FR-902-03', description: 'speckeeper check test succeeds for all TestRefs', verificationMethod: 'test' },
      { id: 'FR-902-04', description: 'speckeeper check test --coverage achieves 100% for target acceptance criteria', verificationMethod: 'test' },
    ],
    relations: [
      { type: 'refines', target: 'FR-604', description: 'Refines coverage verification for CLI tests' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-903: CLI Definition-Implementation Consistency
  // ---------------------------------------------------------------------------
  {
    id: 'FR-903',
    name: 'CLI Definition-Implementation Consistency',
    description: 'CLI command definitions in design/cli-commands.ts match actual implementation in src/cli/index.ts',
    type: 'functional',
    priority: 'must',
    category: 'test',
    parentId: 'FR-900',
    rationale: 'To ensure specification and implementation stay synchronized (e.g., no missing --config parameters)',
    acceptanceCriteria: [
      { id: 'FR-903-01', description: 'All command definitions in design/cli-commands.ts match implementation (parameters, subcommands, exit codes)', verificationMethod: 'test' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-010', description: 'Satisfies design consistency check use case' },
    ],
  },

  // ---------------------------------------------------------------------------
  // FR-904: CLI Backward Compatibility
  // ---------------------------------------------------------------------------
  {
    id: 'FR-904',
    name: 'CLI Backward Compatibility',
    description: 'Existing public APIs and CLI behavior are not changed by test additions',
    type: 'functional',
    priority: 'must',
    category: 'test',
    parentId: 'FR-900',
    rationale: 'To ensure test strengthening does not introduce regressions',
    acceptanceCriteria: [
      { id: 'FR-904-01', description: 'All existing tests continue to pass (no regression)', verificationMethod: 'test' },
      { id: 'FR-904-02', description: 'No changes to existing public API or CLI behavior', verificationMethod: 'review' },
    ],
    relations: [
      { type: 'satisfies', target: 'UC-010', description: 'Satisfies design consistency check use case' },
    ],
  },
];

// ============================================================================
// Functional Requirements - All
// ============================================================================

export const functionalRequirements: Requirement[] = [
  ...commonRequirements,
  ...modelRequirements,
  ...buildRequirements,
  ...lintRequirements,
  ...driftRequirements,
  ...externalCheckRequirements,
  ...impactRequirements,
  ...exportRequirements,
  ...testRequirements,
];

// ============================================================================
// Non-Functional Requirements
// ============================================================================

export const nonFunctionalRequirements: Requirement[] = [
  // ---------------------------------------------------------------------------
  // Execution Time (performance)
  // ---------------------------------------------------------------------------
  {
    id: 'NFR-001',
    name: 'Command Execution Time',
    description: 'lint/build/drift within 1 minute for typical requirement scale (~500 items), check within 2 minutes (depends on file count)',
    type: 'non-functional',
    priority: 'should',
    category: 'performance',
    acceptanceCriteria: [
      { id: 'NFR-001-01', description: 'lint/build/drift within 60 seconds for 500 requirements scale', verificationMethod: 'test' },
      { id: 'NFR-001-02', description: 'check within 120 seconds for 1000 files scale', verificationMethod: 'test' },
      { id: 'NFR-001-03', description: 'build within 5 seconds for 1000 requirements, 100 entities, 50 screens', verificationMethod: 'test' },
    ],
  },

  // ---------------------------------------------------------------------------
  // Portability
  // ---------------------------------------------------------------------------
  {
    id: 'NFR-002',
    name: 'Node.js Compatibility',
    description: 'Works on Node.js (LTS)',
    type: 'non-functional',
    priority: 'must',
    category: 'portability',
    acceptanceCriteria: [
      { id: 'NFR-002-01', description: 'Verified on Node.js 18 LTS', verificationMethod: 'test' },
      { id: 'NFR-002-02', description: 'Verified on Node.js 20 LTS', verificationMethod: 'test' },
      { id: 'NFR-002-03', description: 'Verified on Node.js 22 LTS', verificationMethod: 'test' },
    ],
  },
  {
    id: 'NFR-003',
    name: 'Multi-OS Support',
    description: 'Avoid OS dependencies and work on Linux/macOS/Windows',
    type: 'non-functional',
    priority: 'must',
    category: 'portability',
    acceptanceCriteria: [
      { id: 'NFR-003-01', description: 'Verified on Linux (Ubuntu)', verificationMethod: 'test' },
      { id: 'NFR-003-02', description: 'Verified on macOS', verificationMethod: 'test' },
      { id: 'NFR-003-03', description: 'Verified on Windows (PowerShell)', verificationMethod: 'test' },
      { id: 'NFR-003-04', description: 'Eliminate OS-dependent code such as path separators', verificationMethod: 'review' },
    ],
  },

  // ---------------------------------------------------------------------------
  // Modifiability/Extensibility
  // ---------------------------------------------------------------------------
  {
    id: 'NFR-004',
    name: 'User-defined Models',
    description: 'Users can define custom models by inheriting from Model base class',
    type: 'non-functional',
    priority: 'must',
    category: 'extensibility',
    acceptanceCriteria: [
      { id: 'NFR-004-01', description: 'Can define new models by inheriting from Model base class', verificationMethod: 'test' },
      { id: 'NFR-004-02', description: 'Can define model-specific schema, lint rules, and renderers', verificationMethod: 'test' },
      { id: 'NFR-004-03', description: 'Models registered in speckeeper.config.ts become targets of lint/build/check', verificationMethod: 'test' },
    ],
  },
  {
    id: 'NFR-005',
    name: 'Input Format Diversity',
    description: 'Allow YAML/JSON input to lower participation barriers for non-developers',
    type: 'non-functional',
    priority: 'should',
    category: 'extensibility',
    acceptanceCriteria: [
      { id: 'NFR-005-01', description: 'Support TypeScript DSL input', verificationMethod: 'test' },
      { id: 'NFR-005-02', description: 'Support YAML format input', verificationMethod: 'demo' },
      { id: 'NFR-005-03', description: 'Support JSON format input', verificationMethod: 'demo' },
    ],
  },
  {
    id: 'NFR-006',
    name: 'Rule Extensibility',
    description: 'Allow adding lint and check rules via plugin mechanism',
    type: 'non-functional',
    priority: 'should',
    category: 'extensibility',
    acceptanceCriteria: [
      { id: 'NFR-006-01', description: 'Custom lint rules can be added', verificationMethod: 'demo' },
      { id: 'NFR-006-02', description: 'Custom check rules (external SSOT verification) can be added', verificationMethod: 'demo' },
      { id: 'NFR-006-03', description: 'Rules are defined under Model._models/', verificationMethod: 'review' },
    ],
  },

  // ---------------------------------------------------------------------------
  // Transparency
  // ---------------------------------------------------------------------------
  {
    id: 'NFR-007',
    name: 'Error Message Clarity',
    description: 'Output errors showing requirement ID, file, and field name, providing messages that clearly show "why it failed"',
    type: 'non-functional',
    priority: 'must',
    category: 'transparency',
    acceptanceCriteria: [
      { id: 'NFR-007-01', description: 'Errors include requirement ID/specification ID', verificationMethod: 'test' },
      { id: 'NFR-007-02', description: 'Errors include file path and line number (when possible)', verificationMethod: 'test' },
      { id: 'NFR-007-03', description: 'Errors include problematic field name', verificationMethod: 'test' },
      { id: 'NFR-007-04', description: 'Provide hints for fixes', verificationMethod: 'review' },
    ],
  },

  // ---------------------------------------------------------------------------
  // Compatibility
  // ---------------------------------------------------------------------------
  {
    id: 'NFR-008',
    name: 'TypeScript Compatibility',
    description: 'Type checking passes on TypeScript 5.0+',
    type: 'non-functional',
    priority: 'must',
    category: 'compatibility',
    acceptanceCriteria: [
      { id: 'NFR-008-01', description: 'Compiles successfully on TypeScript 5.0', verificationMethod: 'test' },
      { id: 'NFR-008-02', description: 'No type errors in strict mode', verificationMethod: 'test' },
    ],
  },
  {
    id: 'NFR-009',
    name: 'ESM Support',
    description: 'Provided in ES Modules format',
    type: 'non-functional',
    priority: 'must',
    category: 'compatibility',
    acceptanceCriteria: [
      { id: 'NFR-009-01', description: 'Can be imported via import statement', verificationMethod: 'test' },
      { id: 'NFR-009-02', description: 'Tree-shaking works', verificationMethod: 'inspection' },
    ],
  },

  // ---------------------------------------------------------------------------
  // Deployability
  // ---------------------------------------------------------------------------
  {
    id: 'NFR-010',
    name: 'npm Distribution',
    description: 'Can be distributed as npm package',
    type: 'non-functional',
    priority: 'must',
    category: 'deployability',
    acceptanceCriteria: [
      { id: 'NFR-010-01', description: 'Can publish package via npm publish', verificationMethod: 'demo' },
      { id: 'NFR-010-02', description: 'Can install via npm install speckeeper', verificationMethod: 'demo' },
    ],
  },
];

// ============================================================================
// Constraints
// ============================================================================

export const constraints: Requirement[] = [
  {
    id: 'CR-001',
    name: 'Minimize External Dependencies',
    description: 'Limit external dependencies to stable libraries like Zod, Commander, Chalk',
    type: 'constraint',
    priority: 'should',
    category: 'technical',
    acceptanceCriteria: [
      { id: 'CR-001-01', description: 'Keep dependency package count under 20', verificationMethod: 'inspection' },
      { id: 'CR-001-02', description: 'Use only packages with stable major versions', verificationMethod: 'review' },
    ],
  },
  {
    id: 'CR-002',
    name: 'Zero-config Startup',
    description: 'Basic functionality works without config file',
    type: 'constraint',
    priority: 'should',
    category: 'usability',
    acceptanceCriteria: [
      { id: 'CR-002-01', description: 'build/lint/drift works without speckeeper.config.ts', verificationMethod: 'test' },
      { id: 'CR-002-02', description: 'Default settings cover typical use cases', verificationMethod: 'review' },
    ],
  },
  {
    id: 'CR-003',
    name: 'No Implementation Code Generation',
    description: 'speckeeper does not generate implementation code. API contracts and DB connection code are handled by external tools',
    type: 'constraint',
    priority: 'must',
    category: 'scope',
    acceptanceCriteria: [
      { id: 'CR-003-01', description: 'speckeeper does not generate or modify code under src/', verificationMethod: 'review' },
      { id: 'CR-003-02', description: 'API contracts (TypeScript types, routes, clients) generated by external tools from OpenAPI', verificationMethod: 'review' },
      { id: 'CR-003-03', description: 'DB connections (Entity types, repositories) generated by ORM/DDL tools from DDL/schema', verificationMethod: 'review' },
      { id: 'CR-003-04', description: 'speckeeper only handles requirement definition and external SSOT consistency checks', verificationMethod: 'review' },
    ],
  },
  {
    id: 'CR-004',
    name: 'Respect External SSOT',
    description: 'Treat API specs, DB definitions, IaC definitions as external SSOT, speckeeper only references and verifies',
    type: 'constraint',
    priority: 'must',
    category: 'scope',
    acceptanceCriteria: [
      { id: 'CR-004-01', description: 'Do not directly generate or modify OpenAPI files', verificationMethod: 'review' },
      { id: 'CR-004-02', description: 'Do not directly generate or modify DDL/Prisma schemas', verificationMethod: 'review' },
      { id: 'CR-004-03', description: 'Do not directly generate or modify CloudFormation/Terraform', verificationMethod: 'review' },
      { id: 'CR-004-04', description: 'Principle is to fix speckeeper side when consistency check fails', verificationMethod: 'review' },
    ],
  },
];

// ============================================================================
// All Requirements
// ============================================================================

export const allRequirements: Requirement[] = [
  ...functionalRequirements,
  ...nonFunctionalRequirements,
  ...constraints,
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get parent requirement and its children
 */
export function getRequirementWithChildren(parentId: string): {
  parent: Requirement | undefined;
  children: Requirement[];
} {
  const parent = allRequirements.find(r => r.id === parentId);
  const children = allRequirements.filter(r => r.parentId === parentId);
  return { parent, children };
}

/**
 * Get requirements grouped by category
 */
export function getRequirementsByCategory(): Map<string, Requirement[]> {
  const byCategory = new Map<string, Requirement[]>();
  for (const req of functionalRequirements) {
    const cat = req.category || 'other';
    const list = byCategory.get(cat) || [];
    list.push(req);
    byCategory.set(cat, list);
  }
  return byCategory;
}

/**
 * Get top-level requirements (no parentId)
 */
export function getTopLevelRequirements(): Requirement[] {
  return functionalRequirements.filter(r => !r.parentId);
}

export default defineSpecs(
  [FunctionalRequirementModel.instance, functionalRequirements],
  [NonFunctionalRequirementModel.instance, nonFunctionalRequirements],
  [ConstraintModel.instance, constraints],
);
