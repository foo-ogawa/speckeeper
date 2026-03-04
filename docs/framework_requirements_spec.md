# Requirements Specification for Framework Managing Requirements and Design in TypeScript with Markdown Generation (Draft)

Created: 2026-02-03  
Version: 0.1

---

## 1. Background and Purpose

To maximize consistency and review quality in requirements definition, architecture design, and high-level design (upstream), upstream artifacts are managed with **TypeScript models as SSOT**, and review documents/diagrams are **automatically generated from TS**. Additionally, artifacts managed by existing tools/formats (OpenAPI, DDL, etc.) are treated as **external SSOT**, and **consistency checks** are performed with TS models.

Specifically:

- **Requirements definition** is maintained as structured data in TypeScript, generating Markdown
- **Logical architecture** is modeled in TypeScript, generating **Mermaid C4**
- **Conceptual model** (main entities/relations) is modeled in TypeScript, generating **Mermaid erDiagram**
- **Screen specifications** (screen list/transitions/forms/states) are modeled in TypeScript, generating **Mermaid flowchart/stateDiagram**
- **API specifications** (OpenAPI), **DB definitions** (DDL), etc. are directly managed as external SSOT, with **consistency checks** against TS models

Design artifacts (API specifications, screen specifications, DB schemas, etc.) and requirements are linked by ID, establishing a state where **artifact existence and consistency** can be mechanically checked.

---

## 2. Goals (Desired State)

- Requirements definition and design core can be managed with **TypeScript** as the source of truth (Single Source of Truth)
- **Logical architecture** can be modeled in TypeScript, generating **Mermaid C4 diagrams**
- **Conceptual model** (Entity/Relation/key attributes) can be modeled in TypeScript, generating **Mermaid erDiagram**
- **Screen specifications** (screen list/transitions/forms/states) can be modeled in TypeScript, generating **Mermaid flowchart/stateDiagram**
- Generated Markdown/Mermaid is **always reproducible from TS**, and CI fails if manual edits are mixed in
- **Consistency can be automatically checked** between **external SSOT** (OpenAPI, DDL, IaC, etc.) and TS models
- Traceability from requirements → design artifacts (HLD: API specs/logical architecture/conceptual model/screen specs, LLD: schemas, etc.) can be reliably linked by ID
- **TBD allowance/prohibition** gates can be enforced according to phase (REQ/HLD/LLD/OPS)
- Requirements in areas prone to omission, such as monitoring requirements (CloudWatch) and data model requirements, can be **made mandatory through types** and inspected
- Object types for modeling targets (monitoring, conceptual model, screen specifications, security, etc.) are **extensible by designers**
- **Existing artifact formats** (OpenAPI, DDL, Terraform, etc.) can be leveraged, coexisting with the ecosystem

---

## 3. Non-Goals (Not Covered by This Framework)

- Automatic "creation" of requirements (text generation) is not the primary purpose (input is done by humans)
- Formal verification of all logic specifications (model checking with TLA+/Alloy, etc.) is not a mandatory requirement (future extension is possible)
- Completely replacing requirements management tools (Jama/DOORS, etc.)
  - However, **export to ReqIF, etc.** will be considered in the future (for audit, baseline, collaboration with external partners)
- Complete management of review/approval workflows and audit trails (substituted by PR-based operations)

---

## 4. Terms and Definitions

<!--@embedoc:model_data model="term" format="spec-terms" include="terms"-->
- **TS-SSOT**: A policy where TypeScript is the source of truth and generated artifacts are regeneratable derivatives
- **External SSOT（External SSOT）**: Artifacts managed by existing tools/formats (OpenAPI, DDL, IaC, etc.). This framework does not generate them but checks consistency against them
- **External SSOT Reference（External SSOT Reference）**: Minimal interface for referencing external SSOT from TS models (ID, path, correspondence, etc.)
- **Model（Model）**: A unit of design information defined in TypeScript. Inherits from Model base class and has schema, lint rules, renderers, etc.
- **Design Artifact（Artifact）**: Design artifacts to satisfy requirements such as monitoring, Runbook, Dashboard, data schema, etc.
- **Concretization Slot（Concretization slot）**: Items to be filled in subsequent phases (allows TBD while having a deadline phase)
- **ID Linkage**: A mechanism that ensures componentId/entityId/requirementId from TS models appear in external SSOT, generated artifacts, implementation, and IaC to connect design and implementation
- **Drift（drift）**: A state where docs//specs/ that should have been generated from TS have differences due to manual edits, etc.
- **Reconciliation（Reconciliation）**: Checks to bridge gaps between design and external SSOT/implementation (design consistency, external SSOT consistency, implementation existence verification)
- **User-defined Model（User-defined Model）**: Project-specific models defined by users inheriting from the Model base class. The standard way to use speckeeper
<!--@embedoc:end-->

---

## 5. Stakeholders

<!--@embedoc:model_data model="actor" format="list" include="human"-->
- 👤 **Requirements Engineer**: PO/PM/Business representative. Defines requirements and acceptance criteria in TS models and generates documentation
- 👤 **Design Engineer**: Architect/Development lead. Defines logical architecture and concept models in TS models and generates C4/ER diagrams
- 👤 **Implementation Engineer**: App/Infrastructure developer. Defines screen specifications and process flows, checks consistency with external SSOT
- 👤 **Operations Engineer**: SRE/Operations staff. Manages observability requirements, Runbook and monitoring configuration consistency
- 👤 **Reviewer**: Quality/Security staff. Performs design reviews and verifies consistency check results
<!--@embedoc:end-->

---

## 6. Expected Workflow (Standard)

### 6.1 Overall Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│ 1) SSOT (design/ TypeScript models)                              │
│    - requirements.ts  : Requirements (requests/acceptance criteria/TBD slots) │
│    - architecture.ts  : Logical architecture (component/boundary/layer) │
│    - concept-model.ts : Conceptual model (entity/relation + rules) │
│    - usecases.ts      : Use cases/actors                         │
│    - glossary.ts      : Glossary/abbreviations                   │
│    - artifacts.ts     : Artifacts/directory structure            │
│    - cli-commands.ts  : CLI command specifications               │
│    - test-refs.ts     : Test definitions/requirement linkage     │
│    - _models/         : Model definitions (schema/Lint/output)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ npm run ci
┌─────────────────────────────────────────────────────────────────┐
│ 2) CI Pipeline (3 phases)                                        │
├─────────────────────────────────────────────────────────────────┤
│ Phase 1: ci:validate (Validation)                                │
│   ① tsc --noEmit        : Type checking                          │
│   ② eslint src/         : Source code quality                    │
│   ③ eslint design/      : Design file quality                    │
│   ④ tsup                : Build (dist/ generation)               │
│   ⑤ speckeeper lint        : Model consistency (references/ID/phase gates) │
│   ⑥ vitest run          : Unit tests (288 cases)                 │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2: ci:generate (Generation)                                │
│   ⑦ embedoc build       : docs/ marker update                    │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3: ci:verify (Reconciliation)                              │
│   ⑧ speckeeper check external-ssot : External SSOT consistency       │
│   ⑨ speckeeper check test          : Test-requirement linkage        │
│   ⑩ speckeeper check test --coverage : Coverage verification         │
│      - TestRef → Requirement (acceptanceCriteria)                │
│      - Requirement → UseCase (satisfies)                         │
│      - Component → Requirement (implements)                      │
│      - Entity → Artifact (documents)                             │
└─────────────────────────────────────────────────────────────────┘
           ↓ Reference                        ↓ Consistency check
┌────────────────────────────────┐  ┌────────────────────────────────┐
│ 3a) Generated artifacts (docs/)│  │ 3b) External SSOT               │
│   - Markdown (updated by embedoc) │  │   - OpenAPI (YAML/JSON)        │
│   - Mermaid diagrams           │  │   - DDL / Prisma               │
│   → Manual edits outside markers │  │   - CloudFormation / Terraform │
└────────────────────────────────┘  └────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4) Implementation (src/)                                         │
│    - Implement by referencing external SSOT (OpenAPI/DDL, etc.)  │
│    - Link via TestRef which requirement/command corresponds to   │
│    - Declare which requirement is implemented via relations      │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Phase-based Work

<!--@embedoc:model_data model="usecase" format="phase-workflow"-->
1. **REQ Phase**
   - Write requirements in TypeScript
   - Generate Markdown/Mermaid via `build` (review on PR by viewing docs/)
   - Verify requirement consistency, required fields, reference integrity, and phase gate via `lint`

2. **HLD Phase**
   - Write logical architecture (`design/architecture.ts`) in TypeScript
   - Generate Markdown/Mermaid via `build` (review on PR by viewing docs/)
   - Verify architecture consistency (layer violations, boundary crossings, etc.) via `lint`
   - Write screen specifications (`design/screens.ts`) in TypeScript
   - Verify screen consistency via `lint`

3. **LLD Phase**
   - Write concept model (`design/concept-model.ts`) in TypeScript
   - Generate Markdown/Mermaid via `build` (review on PR by viewing docs/)
   - Write form details (`design/screens/forms/`) in TypeScript

4. **Implementation Phase**
   - Verify requirement-external SSOT consistency via `check external-ssot`
   - Check change impact scope via `impact`

5. **OPS Phase**
   - Finalize runbook URLs, etc. and pass the final gate

6. **CI (Always)**
   - Verify ID uniqueness, reference integrity, and layer dependency direction via `lint`
   - Detect manual edits to artifacts via `drift`
   - Verify implementation-contract consistency via `check contract`
<!--@embedoc:end-->

---

## 7. Main Artifacts (Repository Artifacts)

### 7.1 Directory Structure

<!--@embedoc:model_data model="artifact" format="directory-tree"-->
```
design/  # TypeScript (source of truth) = upstream SSOT (requirement/design models)
├── _models/  # Model definitions (schemas, lint rules, exporters)
├── requirements.ts  # Requirement definitions
├── usecases.ts  # Use case and actor definitions
├── architecture.ts  # Logical architecture (C4 System/Container)
├── concept-model.ts  # Concept model (Entity/Relation)
├── glossary.ts  # Glossary
├── artifacts.ts  # Artifact and directory structure definitions
└── cli-commands.ts  # CLI command specifications

docs/  # Human-readable documents (auto-updated via embedoc)
├── framework_requirements_spec.md  # Framework requirements specification (sections auto-updated via embedoc)
├── model-design.md  # Model design guide
├── model-guide.md  # Model definition guide
├── model_entity_catalog.md  # Model and entity catalog
└── framework_evaluation.md  # Framework evaluation

specs/  # Machine-readable artifacts (JSON Schema for consistency checking)
├── schemas/  # JSON Schema
│   └── entities/  # Entity JSON Schema (E-001.json, etc.)
└── index.json  # Aggregated data (reference graph for all models)

src/  # Application implementation code (not managed by speckeeper)
```
<!--@embedoc:end-->

> **Note**: See constraint requirement CR-003. speckeeper does not generate implementation code.

### 7.2 Artifact Classification

<!--@embedoc:model_data model="artifact" format="table"-->
| Category | Location | Purpose | Drift target |
| --- | --- | --- | --- |
| **SSOT** | `design/` | TypeScript models (source of truth) = requirement/design definitions | - |
| **Human-readable artifacts** | `docs/` | Markdown/Mermaid (for review) | Yes |
| **Machine-readable artifacts** | `specs/` | JSON/JSON Schema for consistency checking | Yes |
| **Implementation code** | `src/` | Application implementation (not managed by speckeeper) | - |
<!--@embedoc:end-->

> **Note**: speckeeper does not generate implementation code. Implementation code is generated from external SSOT by micro-contracts (API contracts) or ORM (DB connections).

### 7.3 CI Definition

<!--@embedoc:model_data model="cli-command" format="ci-list"-->
- Execute the following in GitHub Actions (or equivalent)
  - `lint` (Design consistency)
  - `build` (Generate docs/specs)
  - `drift` (Detect manual edits to artifacts)
  - `check external-ssot` (External SSOT consistency check)
  - `check contract` (Contract consistency, can be omitted when using external SSOT)
<!--@embedoc:end-->

---

## 8. Functional Requirements

This chapter defines the **common system functionality** that the speckeeper framework (`src/`) should implement.

> **Note**: For specific field definitions and usage examples of individual models (Requirement, Entity, Screen, etc.),
> see **[Model Definition Examples](model-guide.md)**.

<!--@embedoc:model_data model="requirement" format="spec-chapter"-->
### 8.1 Common Requirements (All Models)

Defines common requirements that apply to all models.

#### FR-101: ID Management

All model elements have a unique `id` and provide ID-based reference and consistency checking

- **FR-101-01**: All model elements have a unique id [test]
- **FR-101-02**: id follows conventions (e.g., REQ-OBS-001, ENT-ORDER, COMP-API) [test]
- **FR-101-03**: References are expressed by ID and reference integrity checking is provided [test]
- **FR-101-04**: ID changes detect all reference locations via reference integrity check (lint) [test]

**Impact of ID Changes**
- ID changes detect all reference locations via reference integrity check (lint)
- **Change Impact Analysis CLI**: `speckeeper impact {ID}` lists the impact scope

#### FR-102: Phase Management

Set phase (REQ/HLD/LLD/OPS) on models and verify phase gates

- **FR-102-01**: Phase can be handled as REQ | HLD | LLD | OPS [test]
- **FR-102-02**: Can set phase in model definition and verify phase gate [test]
- **FR-102-03**: TBD is allowed/prohibited at specified phase [test]

#### FR-104: Model Definition

Define and register project-specific models in TypeScript

- **FR-104-01**: Can define models by inheriting from Model base class [test]
- **FR-104-02**: Can define runtime validation with Zod schema [test]
- **FR-104-03**: Can define model-specific lint rules [test]
- **FR-104-04**: Can define model-specific renderers (text output functions) [test]
- **FR-104-05**: Can define external SSOT consistency checkers (optional) [test]
- **FR-104-06**: Can register as models: [...] in speckeeper.config.ts [demo]
- **FR-104-07**: Registered models become targets of lint/build/drift/check [test]
- **FR-104-08**: Can set modelLevel on models to enable relation constraint verification [test]
- **FR-104-09**: Can get model level (L0/L1/L2/L3) via Model.level property [test]

**Model Definition Components**

| Element | Required | Description |
|---------|----------|-------------|
| `id` | ✓ | Unique identifier for the model |
| `name` | ✓ | Model name (for display) |
| `idPrefix` | ✓ | ID prefix (e.g., `REQ-`, `ENT-`) |
| `schema` | ✓ | Zod schema |
| `modelLevel` | | Model level (L0/L1/L2/L3) - Used for relation constraint verification |
| `lintRules` | | Model-specific lint rules |
| `renderers` | | Renderers (text output functions) |
| `externalChecker` | | External SSOT consistency checker |

**Defined Models (design/_models/)**

The following models are defined in this project:

| Model | ID Prefix | Purpose |
|-------|-----------|---------|
| Requirement | `REQ-` | Requirement definition |
| UseCase | `UC-` | Use case |
| Term | `TERM-` | Term definition |
| Architecture | `COMP-`/`LAYER-` | Architecture |
| ConceptModel | `ENT-`/`REL-` | Concept model |
| Screen | `SCR-` | Screen definition |
| ProcessFlow | `FLOW-` | Process flow |
| APIRef | `API-` | API reference (external SSOT) |
| TableRef | `TBL-` | Table reference (external SSOT) |
| IaCRef | `IAC-` | IaC reference (external SSOT) |
| BatchRef | `BATCH-` | Batch reference (external SSOT) |

**Runbook model definition example**

```typescript
// Model definition example
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
      render: (specs, ctx) => specs.map(s => `# ${s.title}\n${s.symptoms.join('\n')}`).join('\n'),
    },
  ];
}
```

> [Model definition examples](model-guide.md)

#### FR-105: Project Initialization

Initialize a new speckeeper project with starter templates and basic model definitions

- **FR-105-01**: speckeeper init creates design/ directory structure [test]
- **FR-105-02**: speckeeper init generates speckeeper.config.ts with default settings [test]
- **FR-105-03**: speckeeper init generates package.json with type: module and dependencies [test]
- **FR-105-04**: speckeeper init generates tsconfig.json for TypeScript support [test]
- **FR-105-05**: speckeeper init generates basic model definitions in design/_models/ [test]
- **FR-105-06**: speckeeper init generates sample specification files [test]
- **FR-105-07**: Generated project passes speckeeper lint without errors [test]
- **FR-105-08**: Generated project passes typecheck without errors [test]
- **FR-105-09**: speckeeper init --force overwrites existing files [test]
- **FR-105-10**: speckeeper init skips package.json if it already exists (without --force) [test]

**Generated Files**

| Path | Description |
|------|-------------|
| `design/` | Design directory root |
| `design/_models/` | Model definitions directory |
| `design/_models/requirement.ts` | Requirement model |
| `design/_models/usecase.ts` | UseCase and Actor models |
| `design/_models/entity.ts` | Entity model |
| `design/_models/component.ts` | Component model |
| `design/_models/term.ts` | Term model |
| `design/_models/index.ts` | Model exports |
| `design/index.ts` | Design entry point |
| `design/requirements.ts` | Sample requirements |
| `speckeeper.config.ts` | Configuration file |
| `package.json` | Package manifest (if not exists) |
| `tsconfig.json` | TypeScript configuration |

**Project initialization examples**

```bash
# Initialize a new project
npx speckeeper init

# Force overwrite existing files
npx speckeeper init --force
```

### 8.2 External SSOT Reference

Can define references to external SSOT (OpenAPI, DDL, IaC, etc.)

#### FR-201: External SSOT Path Configuration

External SSOT file paths (OpenAPI, DDL, test code, etc.) are configured in speckeeper.config.ts, not in mermaid flowcharts

- **FR-201-01**: External SSOT file paths are defined in speckeeper.config.ts via ExternalSsotPaths [test]
- **FR-201-02**: Mermaid flowchart is scaffold-only and does not contain runtime configuration such as file paths [review]

### 8.3 Generation (build)

Generate "human-readable artifacts (docs/)" and "machine-readable artifacts (specs/)" from TS models

#### FR-301: Rendering Feature for External Programs

Models provide text rendering functionality callable from external programs

- **FR-301-01**: Can define rendering functions in Model class via renderers property [test]
- **FR-301-02**: Rendering can be invoked via common interface from external programs [test]
- **FR-301-03**: Rendering results switch internally based on model class [test]
- **FR-301-04**: Output format can be specified via format parameter [test]
- **FR-301-05**: Regeneration produces identical content (idempotency) [test]

**Design Policy**

- speckeeper itself does not directly generate documents (docs/)
- External programs (template engines, etc.) invoke model rendering functionality to generate documents
- Model-specific rendering logic is consolidated in `design/_models/`
- Common rendering interface (`Renderer`) is provided

**Rendering Interface**

| Method | Description |
|--------|-------------|
| `model.render(format, specs, ctx)` | Render in specified format |
| `model.hasRenderer(format)` | Check if format is available |
| `model.getAvailableFormats()` | List available formats |

**RenderContext**

| Property | Description |
|----------|-------------|
| `params` | Parameters (filter conditions, etc.) |
| `markdown.table()` | Markdown table generation helper |

**Rendering functionality definition and invocation example**

```typescript
// Model renderers definition example
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
    render: (specs, _ctx) => specs.map(s => `- ${s.id}: ${s.name}`).join('\n'),
  },
];

// Invocation example from external program
import { myModel } from '../design/_models/my-model.ts';

const table = myModel.render('table', specs, ctx);
const list = myModel.render('list', specs, ctx);
```

#### FR-302: Machine-readable Artifacts (specs/)

Generate JSON Schema and requirement definitions from concept model entities

- **FR-302-01**: Entity attributes are mapped to JSON Schema properties [test]
- **FR-302-02**: Can output reference resolution graph (specs/index.json) [test]

| Output | Content |
|--------|---------|
| `specs/schemas/entities/` | JSON Schema (concept Entity common vocabulary) |
| `specs/index.json` | Reference resolution graph (ID list and reference relations for all models) |

> **Note**: speckeeper **does not generate implementation code**.
> Implementation code is generated by external tools from external SSOT:
> - API contract → External tools (generated from OpenAPI)
> - DB connection → ORM/DDL tools (generated from DDL/Prisma)

### 8.4 Lint/Validation

Provides lint functionality to verify model consistency

#### FR-401: Common Lint Items

Verify common lint items that apply to all models

- **FR-401-01**: Verify IDs are not duplicated within the same type [test]
- **FR-401-02**: Verify IDs follow conventions [test]
- **FR-401-03**: Verify referenced targets exist [test]
- **FR-401-04**: Verify no circular references exist [test]
- **FR-401-05**: Verify no TBDs remain at specified phase [test]
- **FR-401-06**: Detect orphan elements (entities without relations, etc.) [test]

| Check Item | Description |
|------------|-------------|
| ID Uniqueness | IDs are not duplicated within the same type |
| ID Format | IDs follow conventions |
| Reference Integrity | Referenced targets exist |
| Circular Reference | No circular references |
| Phase Gate | No TBDs remain at specified phase |
| Orphan Elements | Detect entities without relations, etc. |

#### FR-402: Custom Lint Rules

Each model can define lintRules to verify model-specific constraints

- **FR-402-01**: Can set lintRules in Model definition [test]
- **FR-402-02**: Can set severity (error/warning/info) [test]
- **FR-402-03**: Lint results include rule ID, message, and target ID [test]

**Custom lint rule definition example**

```typescript
lintRules: LintRule<T>[] = [
  {
    id: 'rule-id',
    severity: 'error' | 'warning' | 'info',
    message: 'Error message',
    check: (spec) => /* true if problem exists */,
  },
];
```

### 8.5 Drift Check

Detect if artifacts (docs/, specs/) have been manually edited

- **FR-500-01**: After build execution, detect differences between generated docs//specs/ and committed files [test]
- **FR-500-02**: Fail CI when differences are found [test]
- **FR-500-03**: Output message prompting to "regenerate and commit" [test]
- **FR-500-04**: Manual editing of artifacts is prohibited (detected by drift) [review]

### 8.6 External SSOT Consistency Check

Verify consistency between TS models (external SSOT references) and external SSOT (OpenAPI, DDL, IaC, etc.)

#### FR-601: Three Categories of Consistency Check

All external SSOT consistency checks are uniformly composed of existence, type, and constraint categories

- **FR-601-01**: Existence: Referenced items exist in external artifacts [test]
- **FR-601-02**: Type: Expected type/class/category matches [test]
- **FR-601-03**: Constraints: Non-functional/guardrails are satisfied [test]

| Category | Content | Examples |
|----------|---------|----------|
| **Existence** | Referenced items exist in external artifacts | operationId existence, table existence |
| **Type** | Expected type/class/category matches | resourceType match, columnType match |
| **Constraints** | Non-functional/guardrails are satisfied | Encryption required, PII classification |

#### FR-602: Check Command

Provide CLI command to execute external SSOT consistency check

- **FR-602-01**: speckeeper check runs external SSOT consistency check for all models [test]
- **FR-602-02**: speckeeper check --model <model-name> checks only specific model [test]
- **FR-602-03**: Model name is the model ID defined in design/_models/ [review]
- **FR-602-04**: Only models with externalChecker are targeted [test]

**Check command examples**

```bash
# External SSOT consistency check for all models
speckeeper check

# Check specific model only
speckeeper check --model api-ref      # APIRef consistency only
speckeeper check --model table-ref    # TableRef consistency only
speckeeper check --model iac-ref      # IaCRef consistency only
speckeeper check --model batch-ref    # BatchRef consistency only

# Specify multiple models
speckeeper check --model api-ref --model table-ref
```

#### FR-603: External Checker

Each model can define externalChecker to implement consistency check with external SSOT

- **FR-603-01**: Can set externalChecker in Model definition [test]
- **FR-603-02**: externalChecker includes target file reading and check logic [test]
- **FR-603-03**: Check results include success, errors, warnings [test]
- **FR-603-04**: speckeeper check command auto-detects and runs models with externalChecker [test]

**External Checker Structure**

| Property | Description |
|----------|-------------|
| `sourcePath` | Function that returns the target file path |
| `check` | Check logic body |

**External checker definition example**

```typescript
// design/_models/api-ref.ts
externalChecker: ExternalChecker<APIRef> = {
  sourcePath: (spec) => spec.source.path,
  check: (spec, openApiDoc) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // operationId existence check
    if (!findOperationId(openApiDoc, spec.operationId)) {
      errors.push(`operationId '${spec.operationId}' not found`);
    }
    
    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  },
};
```

#### FR-604: Coverage Verification

Use Model class coverageChecker to verify cross-model coverage

- **FR-604-01**: Execute coverage verification with speckeeper check --coverage [test]
- **FR-604-02**: Define coverageChecker interface in Model class [test]
- **FR-604-03**: Auto-detect and execute models with coverageChecker [test]
- **FR-604-04**: Calculate and display coverage rate (%) [test]
- **FR-604-05**: List uncovered items [test]

**coverageChecker Design**

| Property | Description |
|----------|-------------|
| `targetModel` | Target model ID for coverage ('requirement', etc.) |
| `description` | Coverage check description |
| `check` | Coverage check function (receives registry of all models) |

**Example: TestRef model coverageChecker**

Verifies that acceptanceCriteria with `verificationMethod: 'test'` specific to design/
are covered by TestRef.testCasePatterns.
Coverage logic is defined in each project's design/.

**Coverage verification command execution example**

```bash
# Coverage verification
speckeeper check --coverage

# Output example
Test Coverage Report
─────────────────────────────────────
Total testable criteria:  70
Covered by TestRef:       70
Not covered:              0

Coverage: 100%
```

#### FR-605: Model-Integrated Check Architecture

External SSOT and test verification logic is integrated into _models/ definitions, eliminating the separate _checkers/ directory

- **FR-605-01**: Scaffold does not generate _checkers/ directory [test]
- **FR-605-02**: Verification logic is included in _models/ model definitions [test]
- **FR-605-03**: speckeeper check external-ssot uses verification logic from _models/ model definitions only [test]
- **FR-605-04**: speckeeper check external-ssot does not reference _checkers/ directory [test]
- **FR-605-05**: Checker template functions (src/scaffold/templates/checkers/) are removed; checker logic moves to core DSL (src/core/dsl/) [test]

Implement actual validation logic for externalOpenAPIChecker and externalSqlSchemaChecker, replacing stubs with real file parsing and verification

#### FR-1001: OpenAPI YAML/JSON Parsing

externalOpenAPIChecker MUST parse YAML and JSON format OpenAPI files

- **FR-1001-01**: YAML format OpenAPI files are parsed successfully [test]
- **FR-1001-02**: JSON format OpenAPI files are parsed successfully [test]

#### FR-1002: OpenAPI Spec ID Verification

externalOpenAPIChecker MUST verify spec IDs via operationId, path segments, schema names, and x-spec-id extensions

- **FR-1002-01**: Spec ID found via operationId [test]
- **FR-1002-02**: Spec ID found via exact path segment match [test]
- **FR-1002-03**: Spec ID found via schema name [test]
- **FR-1002-04**: Spec ID found via x-spec-id extension [test]

#### FR-1003: OpenAPI Missing Spec ID Warning

externalOpenAPIChecker MUST report a warning for each spec ID not found in the OpenAPI document

- **FR-1003-01**: Warning reported when spec ID is not found [test]

#### FR-1004: OpenAPI Method Check

externalOpenAPIChecker MAY optionally verify HTTP method exists for matched path (opt-in via config)

- **FR-1004-01**: Method check is opt-in via mapper config [test]
- **FR-1004-02**: Warning reported for method mismatch [test]

#### FR-1005: OpenAPI Parameter/Response Check

externalOpenAPIChecker MAY optionally verify parameter names, response property names and types (opt-in via config)

- **FR-1005-01**: Parameter check is opt-in via mapper config [test]
- **FR-1005-02**: Response property check is opt-in via mapper config [test]
- **FR-1005-03**: Type containment is used for type comparison [test]

#### FR-1006: OpenAPI Mismatch Warnings

externalOpenAPIChecker MUST report warnings for method/parameter/property/type mismatches

- **FR-1006-01**: Warning for missing/wrong HTTP method [test]
- **FR-1006-02**: Warning for missing request parameter [test]
- **FR-1006-03**: Warning for missing response property [test]
- **FR-1006-04**: Warning for type mismatch [test]

#### FR-1007: OpenAPI File Not Found Error

externalOpenAPIChecker MUST report an error when the OpenAPI file does not exist

- **FR-1007-01**: Error reported with missing file path [test]

#### FR-1008: OpenAPI Parse Failure Error

externalOpenAPIChecker MUST report an error when the OpenAPI file cannot be parsed

- **FR-1008-01**: Error reported for invalid YAML [test]
- **FR-1008-02**: Error reported for empty file [test]

#### FR-1009: SQL DDL Parsing

externalSqlSchemaChecker MUST parse SQL DDL files and extract table definitions

- **FR-1009-01**: DDL parsed with node-sql-parser [test]
- **FR-1009-02**: Table names, column names, and column types extracted [test]

#### FR-1010: SQL Table Existence Check

externalSqlSchemaChecker MUST verify spec-referenced table names exist in parsed DDL

- **FR-1010-01**: Warning when referenced table is missing [test]

#### FR-1011: SQL Column Existence Check

externalSqlSchemaChecker MUST verify spec-referenced columns exist in DDL table

- **FR-1011-01**: Warning when referenced column is missing [test]
- **FR-1011-02**: Column check skipped when table is missing [test]

#### FR-1012: SQL Type Consistency Check

externalSqlSchemaChecker MAY optionally verify column type containment (opt-in via checkTypes)

- **FR-1012-01**: Type check is opt-in via checkTypes config [test]
- **FR-1012-02**: Wider DDL type accepted (SMALLINT→INT OK) [test]
- **FR-1012-03**: Narrower DDL type produces warning (INT→SMALLINT NG) [test]

#### FR-1013: SQL Checker Warnings

externalSqlSchemaChecker MUST report warnings for missing table, column, and type mismatches

- **FR-1013-01**: Warning for missing table [test]
- **FR-1013-02**: Warning for missing column [test]
- **FR-1013-03**: Warning for type mismatch [test]

#### FR-1014: SQL File Not Found Error

externalSqlSchemaChecker MUST report an error when the DDL file does not exist

- **FR-1014-01**: Error reported with missing file path [test]

#### FR-1015: SQL Parse Failure Graceful Degradation

externalSqlSchemaChecker MUST handle DDL parse failures gracefully with regex fallback

- **FR-1015-01**: Regex fallback used when parser fails [test]
- **FR-1015-02**: Warning emitted for parse fallback [test]

#### FR-1016: Checker Pattern Consistency

Both checkers follow the testChecker pattern: file existence check → content parsing → spec ID verification

- **FR-1016-01**: OpenAPI checker follows file→parse→verify pattern [test]
- **FR-1016-02**: SQL checker follows file→parse→verify pattern [test]

#### FR-1017: Source Path Fallback

Both checkers use sourcePath from checker config, falling back to hardcoded defaults

- **FR-1017-01**: Config sourcePath used when provided [test]
- **FR-1017-02**: Default path used when no config [test]

#### FR-1018: Minimal New Dependencies

Only node-sql-parser added as new runtime dependency (>100K weekly downloads)

- **FR-1018-01**: Only node-sql-parser added as new dependency [review]

#### FR-1019: Checker Documentation Accuracy

README and scaffold-mermaid-spec.md accurately describe all three built-in checkers as fully implemented

- **FR-1019-01**: README checker table describes validation levels [review]
- **FR-1019-02**: scaffold-mermaid-spec.md Section 7 describes validation levels [review]

### 8.7 Change Impact Analysis

Analyze and list impact scope when IDs change

#### FR-701: Inter-model Relations

Define relations between models to enable impact scope tracking

- **FR-701-01**: Can define relations via relations property in model definition [test]
- **FR-701-02**: Provides standard relation types [review]
- **FR-701-03**: Relations are used as input for impact analysis [test]
- **FR-701-04**: Define source/target model level constraints per relation type [test]
- **FR-701-05**: Level violations and circular references can be detected by lint [test]

**Model Level Definition**

Models are classified into the following levels by abstraction (L0 is most abstract):

| Level | Perspective | Model Examples | Description |
|-------|-------------|----------------|-------------|
| L0 (Business+Domain) | Why / Problem space | UseCase, Actor, Term, Goal | Outcomes/values to achieve, business flows, terminology, business rules |
| L1 (Requirements) | What | Requirement, Constraint | Functional/non-functional requirements, constraints, acceptance criteria |
| L2 (Design) | How (Policy) | Component, Entity, ProcessFlow | Architecture, structure, domain model, policies |
| L3 (Detailed Design/Implementation) | How to build | Screen, APIRef, TableRef, IaCRef | Concrete screen/API/DB definitions, external SSOT references |

```
Abstract ◄───────────────────────────────────────────────────► Concrete
   L0                L1              L2                L3
Business+Domain → Requirements → Design (Policy) → Detailed Design/Implementation
   (Why)           (What)           (How)           (How to build)
```

**Relation Types and Level Constraints**

| Type | Source(A) | Target(B) | Level Constraint | Description |
|------|-----------|-----------|------------------|-------------|
| `implements` | L2,L3 | L1 | A.level > B.level | Design/implementation implements requirements |
| `satisfies` | L1,L2,L3 | L0,L1 | A.level >= B.level | Design satisfies business/requirements |
| `refines` | L1,L2,L3 | L0,L1 | A.level > B.level | Requirements refine business, design refines requirements |
| `verifies` | any | L0,L1 | - | Tests verify business/requirements |
| `dependsOn` | any | any | A.level >= B.level | Same level or concrete→abstract |
| `uses` | any | any | - | Runtime reference (no level constraint) |
| `includes` | any | any | same level | Inclusion within same level |
| `traces` | any | any | - | Bidirectional tracking (no level constraint) |
| `relatedTo` | any | any | - | General relation (no level constraint) |

**Prohibited Relation Patterns (Lint Error)**

| Pattern | Reason | Example |
|---------|--------|---------|
| Abstract→Concrete `implements` | Wrong direction | Requirement → Screen ❌ |
| Abstract→Concrete `satisfies` | Wrong direction | UseCase → Component ❌ |
| Abstract→Concrete `refines` | Wrong direction | UseCase → Screen ❌ |
| Circular reference | Infinite loop | A→B→C→A ❌ |
| Self-reference | Meaningless | A→A ❌ |

**Circular Reference Detection Rules**

Circular references are detected under the following conditions:

1. **Direct cycle**: A implements B, B implements A
2. **Indirect cycle**: A→B→C→A (any combination of relation types)
3. **Level violation cycle**: Concrete→Abstract→Concrete (level returns)

```
Cycle patterns to detect:
┌─────────────────────────────────────────────────┐
│ Allowed: L0 ← L1 ← L2 ← L3 (one direction only)│
│                                                 │
│ Prohibited: L0 ← L1 ← L2 → L1 (level returns) │
│             └───────────────────┘               │
│                   cycle                         │
└─────────────────────────────────────────────────┘
```

**Impact Propagation Direction**

| Type | Direction | Description |
|------|-----------|-------------|
| `implements` | A change→Check B | Verify requirement satisfaction on implementation change |
| `satisfies` | B change→Update A | Update design on business/requirement change |
| `refines` | B change→Update A | Update detail on parent change |
| `verifies` | B change→Update A | Update tests on business/requirement change |
| `dependsOn` | B change→A impacted | Dependent impacted by dependency change |
| `uses` | B change→A impacted | User impacted by used change |
| `includes` | B change→A impacted | Whole impacted by part change |
| `traces` | Bidirectional | Detect tracked element changes |
| `relatedTo` | Bidirectional | Detect related element changes |

**Typical Relations Between Levels**

```
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
```

> [Relation implementation](../src/core/relation.ts)

### 8.8 Artifact Export

Output aggregated JSON for machine processing

- **FR-800-01**: Can output aggregated JSON for machine processing (specs/index.json) [test]
- **FR-800-02**: Can be used for future tool integration (dashboards, requirement lists, progress visualization) [review]

<!--@embedoc:end-->

---

## 9. Non-Functional Requirements

<!--@embedoc:model_data model="requirement" format="nfr-chapter"-->
### 9.1 Execution Time

**NFR-001: Command Execution Time**

lint/build/drift within 1 minute for typical requirement scale (~500 items), check within 2 minutes (depends on file count)

- lint/build/drift within 60 seconds for 500 requirements scale
- check within 120 seconds for 1000 files scale
- build within 5 seconds for 1000 requirements, 100 entities, 50 screens

### 9.2 Portability

**NFR-002: Node.js Compatibility**

Works on Node.js (LTS)

- Verified on Node.js 18 LTS
- Verified on Node.js 20 LTS
- Verified on Node.js 22 LTS

**NFR-003: Multi-OS Support**

Avoid OS dependencies and work on Linux/macOS/Windows

- Verified on Linux (Ubuntu)
- Verified on macOS
- Verified on Windows (PowerShell)
- Eliminate OS-dependent code such as path separators

### 9.3 Modifiability (Extensibility)

**NFR-004: User-defined Models**

Users can define custom models by inheriting from Model base class

- Can define new models by inheriting from Model base class
- Can define model-specific schema, lint rules, and renderers
- Models registered in speckeeper.config.ts become targets of lint/build/check

**NFR-005: Input Format Diversity**

Allow YAML/JSON input to lower participation barriers for non-developers

- Support TypeScript DSL input
- Support YAML format input
- Support JSON format input

**NFR-006: Rule Extensibility**

Allow adding lint and check rules via plugin mechanism

- Custom lint rules can be added
- Custom check rules (external SSOT verification) can be added
- Rules are defined under Model._models/

### 9.4 Transparency

**NFR-007: Error Message Clarity**

Output errors showing requirement ID, file, and field name, providing messages that clearly show "why it failed"

- Errors include requirement ID/specification ID
- Errors include file path and line number (when possible)
- Errors include problematic field name
- Provide hints for fixes

### 9.5 Compatibility

**NFR-008: TypeScript Compatibility**

Type checking passes on TypeScript 5.0+

- Compiles successfully on TypeScript 5.0
- No type errors in strict mode

**NFR-009: ESM Support**

Provided in ES Modules format

- Can be imported via import statement
- Tree-shaking works

### 9.6 Deployability

**NFR-010: npm Distribution**

Can be distributed as npm package

- Can publish package via npm publish
- Can install via npm install speckeeper

<!--@embedoc:end-->

---

## 10. Security Requirements

- Secrets embedded in repository are prohibited
- External links such as Runbook URLs are allowed, but must not include authentication information
- Care must be taken to prevent sensitive information from appearing in CI logs (configure to avoid exposing template contents)

---

## 11. Acceptance Criteria

Refer to `acceptanceCriteria` defined in each requirement (FR-*, NFR-*, CR-*).

Verification of acceptance criteria is automated with `speckeeper check test --coverage`,
which confirms that acceptance criteria with `verificationMethod: test` are covered by `TestRef`.

```bash
# Check acceptance criteria coverage
npx speckeeper check test --coverage
```

---

End of Document
