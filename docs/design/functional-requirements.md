# Requirements

## Functional Requirements

| ID | Name | Priority | Category |
|----|------|----------|----------|
| FR-100 | Common Requirements (All Models) | must | common |
| FR-101 | ID Management | must | common |
| FR-102 | Phase Management | must | common |
| FR-104 | Model Definition | must | common |
| FR-105 | Project Initialization | should | common |
| FR-106 | Artifact Class-Based Scaffold | must | common |
| FR-107 | Core-Provided Model Factories | must | common |
| FR-200 | External SSOT Reference | must | model |
| FR-201 | External SSOT Path Configuration | must | model |
| FR-300 | Generation (build) | must | build |
| FR-301 | Rendering Feature for External Programs | must | build |
| FR-302 | Machine-readable Artifacts (specs/) | must | build |
| FR-400 | Lint/Validation | must | lint |
| FR-401 | Common Lint Items | must | lint |
| FR-402 | Custom Lint Rules | must | lint |
| FR-500 | Drift Check | must | drift |
| FR-600 | External SSOT Consistency Check | must | check |
| FR-601 | Three Categories of Consistency Check | must | check |
| FR-602 | Check Command | must | check |
| FR-603 | External Checker | must | check |
| FR-604 | Coverage Verification | should | check |
| FR-605 | Model-Integrated Check Architecture | must | check |
| FR-700 | Change Impact Analysis | should | impact |
| FR-701 | Inter-model Relations | should | impact |
| FR-702 | Verified-By / Verifies Relation Types | must | impact |
| FR-703 | Edge Type-Specific Relation Schema | must | impact |
| FR-800 | Artifact Export (optional) | could | export |
| FR-1000 | External Checker Implementation | must | check |
| FR-1001 | OpenAPI YAML/JSON Parsing | must | check |
| FR-1002 | OpenAPI Spec ID Verification | must | check |
| FR-1003 | OpenAPI Missing Spec ID Warning | must | check |
| FR-1004 | OpenAPI Method Check | should | check |
| FR-1005 | OpenAPI Parameter/Response Check | should | check |
| FR-1006 | OpenAPI Mismatch Warnings | must | check |
| FR-1007 | OpenAPI File Not Found Error | must | check |
| FR-1008 | OpenAPI Parse Failure Error | must | check |
| FR-1009 | SQL DDL Parsing | must | check |
| FR-1010 | SQL Table Existence Check | must | check |
| FR-1011 | SQL Column Existence Check | must | check |
| FR-1012 | SQL Type Consistency Check | should | check |
| FR-1013 | SQL Checker Warnings | must | check |
| FR-1014 | SQL File Not Found Error | must | check |
| FR-1015 | SQL Parse Failure Graceful Degradation | must | check |
| FR-1016 | Checker Pattern Consistency | must | check |
| FR-1017 | Source Path Fallback | must | check |
| FR-1018 | Minimal New Dependencies | must | check |
| FR-1019 | Checker Documentation Accuracy | must | check |

---

## FR-100: Common Requirements (All Models)

**Type**: functional | **Priority**: must | **Category**: common

Defines common requirements that apply to all models.

### Acceptance Criteria

- **FR-100-01**: All child requirements (FR-101, FR-102, FR-104) are satisfied [review]

---

## FR-101: ID Management

**Type**: functional | **Priority**: must | **Category**: common

All model elements have a unique `id` and provide ID-based reference and consistency checking

### Rationale

To prevent ID duplication, ensure reference integrity, and maintain traceability

### Acceptance Criteria

- **FR-101-01**: All model elements have a unique id [test]
- **FR-101-02**: id follows conventions (e.g., REQ-OBS-001, ENT-ORDER, COMP-API) [test]
- **FR-101-03**: References are expressed by ID and reference integrity checking is provided [test]
- **FR-101-04**: ID changes detect all reference locations via reference integrity check (lint) [test]

---

## FR-102: Phase Management

**Type**: functional | **Priority**: must | **Category**: common

Set phase (REQ/HLD/LLD/OPS) on models and verify phase gates

### Rationale

To ensure no items requiring resolution in subsequent phases remain

### Acceptance Criteria

- **FR-102-01**: Phase can be handled as REQ | HLD | LLD | OPS [test]
- **FR-102-02**: Can set phase in model definition and verify phase gate [test]
- **FR-102-03**: TBD is allowed/prohibited at specified phase [test]

---

## FR-104: Model Definition

**Type**: functional | **Priority**: must | **Category**: common

Define and register project-specific models in TypeScript

### Rationale

To define project-specific models (Requirement, Entity, Screen, Runbook, etc.) in a unified way

### Acceptance Criteria

- **FR-104-01**: Can define models by inheriting from Model base class [test]
- **FR-104-02**: Can define runtime validation with Zod schema [test]
- **FR-104-03**: Can define model-specific lint rules [test]
- **FR-104-04**: Can define model-specific renderers (text output functions) [test]
- **FR-104-05**: Can define external SSOT consistency checkers (optional) [test]
- **FR-104-06**: Can register as models: [...] in speckeeper.config.ts [demo]
- **FR-104-07**: Registered models become targets of lint/build/drift/check [test]
- **FR-104-08**: Can set modelLevel on models to enable relation constraint verification [test]
- **FR-104-09**: Can get model level (L0/L1/L2/L3) via Model.level property [test]

---

## FR-105: Project Initialization

**Type**: functional | **Priority**: should | **Category**: common

Initialize a new speckeeper project with starter templates and basic model definitions

### Rationale

To provide a quick start experience for new users by generating project structure, configuration, and basic model definitions

### Acceptance Criteria

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

---

## FR-106: Artifact Class-Based Scaffold

**Type**: functional | **Priority**: must | **Category**: common

Scaffold generates model files from a common base template based on artifact class specified in mermaid flowchart, replacing fixed node-to-template mappings

### Rationale

To eliminate fixed template mappings (NODE_ALIAS, TEMPLATE_META, CHECKER_ALIAS) and enable flexible artifact type addition via class specification

### Acceptance Criteria

- **FR-106-01**: Scaffold recognizes artifact class on mermaid flowchart nodes and generates model files from a common base template [test]
- **FR-106-02**: Artifact class is used for: (1) aggregating same-class nodes into one model file, (2) deriving model/file names from class name, (3) selecting checker bindings for external nodes [test]
- **FR-106-03**: Multiple nodes with same artifact class are aggregated into a single model file [test]
- **FR-106-04**: Nodes without artifact class are generated with base template using node ID as model name [test]
- **FR-106-05**: Model name is PascalCase of node ID/class name, file name is kebab-case (e.g., class "requirement" → Model "Requirement", file "requirement.ts") [test]
- **FR-106-06**: NODE_ALIAS (fixed node ID to template mapping) is removed [test]
- **FR-106-07**: TEMPLATE_META (fixed template name to level/type/filename registry) is removed [test]
- **FR-106-08**: CHECKER_ALIAS (fixed external node ID to checker template mapping) is removed [test]
- **FR-106-09**: Fixed model template functions (requirement.ts, usecase.ts, term.ts, etc.) are removed; only base template remains [test]

---

## FR-107: Core-Provided Model Factories

**Type**: functional | **Priority**: must | **Category**: common

speckeeper core provides generic lint rule, exporter, schema, test checker, and coverage checker factories to simplify model definitions

### Rationale

To reduce model definition verbosity by extracting common patterns into reusable core-provided factories

### Acceptance Criteria

- **FR-107-01**: Core provides generic lint rule factories: field required check, array min length check, ID format check, child element ID format check [test]
- **FR-107-02**: Core provides generic exporter factories: markdown single exporter (declarative title/metadata/section), markdown index exporter (declarative table columns) [test]
- **FR-107-03**: Core provides common schema base (id, name, description, relations) that models extend with custom fields [test]
- **FR-107-04**: Core provides test verification common logic (test file search, spec ID reference check, test result parsing) usable by specifying test file path only [test]
- **FR-107-05**: Core provides relation-based coverage checker common logic (coverage calculation against all IDs of target model) [test]
- **FR-107-06**: All core-provided factories are optional; custom logic can coexist with core factories [test]

---

## FR-200: External SSOT Reference

**Type**: functional | **Priority**: must | **Category**: model

Can define references to external SSOT (OpenAPI, DDL, IaC, etc.)

### Rationale

To manage API specifications and DB definitions with external tools while ensuring model consistency

### Acceptance Criteria

- **FR-200-01**: Provides basic interfaces for APIRef/TableRef/IaCRef/BatchRef [test]
- **FR-200-02**: Can set file path and identifier for referenced target [test]
- **FR-200-03**: Can associate with related components and entities [test]

---

## FR-201: External SSOT Path Configuration

**Type**: functional | **Priority**: must | **Category**: model

External SSOT file paths (OpenAPI, DDL, test code, etc.) are configured in speckeeper.config.ts, not in mermaid flowcharts

### Rationale

To centralize runtime configuration (file paths) in config file, keeping mermaid flowcharts as scaffold-only artifacts

### Acceptance Criteria

- **FR-201-01**: External SSOT file paths are defined in speckeeper.config.ts via ExternalSsotPaths [test]
- **FR-201-02**: Mermaid flowchart is scaffold-only and does not contain runtime configuration such as file paths [review]

---

## FR-300: Generation (build)

**Type**: functional | **Priority**: must | **Category**: build

Generate "human-readable artifacts (docs/)" and "machine-readable artifacts (specs/)" from TS models

### Acceptance Criteria

- **FR-300-01**: Can output human-readable artifacts (docs/) [test]
- **FR-300-02**: Can output machine-readable artifacts (specs/) [test]
- **FR-300-03**: Manual editing of artifacts is prohibited (subject to drift check) [review]

---

## FR-301: Rendering Feature for External Programs

**Type**: functional | **Priority**: must | **Category**: build

Models provide text rendering functionality callable from external programs

### Rationale

To make model rendering functionality available to external programs (template engines, document generation tools, etc.)

### Acceptance Criteria

- **FR-301-01**: Can define rendering functions in Model class via renderers property [test]
- **FR-301-02**: Rendering can be invoked via common interface from external programs [test]
- **FR-301-03**: Rendering results switch internally based on model class [test]
- **FR-301-04**: Output format can be specified via format parameter [test]
- **FR-301-05**: Regeneration produces identical content (idempotency) [test]

---

## FR-302: Machine-readable Artifacts (specs/)

**Type**: functional | **Priority**: must | **Category**: build

Generate JSON Schema and requirement definitions from concept model entities

### Rationale

For use as contract definitions with external systems, validation, and input for lint/check/impact analysis

### Acceptance Criteria

- **FR-302-01**: Entity attributes are mapped to JSON Schema properties [test]
- **FR-302-02**: Can output reference resolution graph (specs/index.json) [test]

---

## FR-400: Lint/Validation

**Type**: functional | **Priority**: must | **Category**: lint

Provides lint functionality to verify model consistency

### Acceptance Criteria

- **FR-400-01**: Can verify common lint items [test]
- **FR-400-02**: Can define and execute model-specific custom lint rules [test]

---

## FR-401: Common Lint Items

**Type**: functional | **Priority**: must | **Category**: lint

Verify common lint items that apply to all models

### Rationale

ID duplication and reference inconsistencies break traceability

### Acceptance Criteria

- **FR-401-01**: Verify IDs are not duplicated within the same type [test]
- **FR-401-02**: Verify IDs follow conventions [test]
- **FR-401-03**: Verify referenced targets exist [test]
- **FR-401-04**: Verify no circular references exist [test]
- **FR-401-05**: Verify no TBDs remain at specified phase [test]
- **FR-401-06**: Detect orphan elements (entities without relations, etc.) [test]

---

## FR-402: Custom Lint Rules

**Type**: functional | **Priority**: must | **Category**: lint

Each model can define lintRules to verify model-specific constraints

### Rationale

To verify model-specific constraints (layer violations, required attributes, etc.)

### Acceptance Criteria

- **FR-402-01**: Can set lintRules in Model definition [test]
- **FR-402-02**: Can set severity (error/warning/info) [test]
- **FR-402-03**: Lint results include rule ID, message, and target ID [test]

---

## FR-500: Drift Check

**Type**: functional | **Priority**: must | **Category**: drift

Detect if artifacts (docs/, specs/) have been manually edited

### Rationale

To detect divergence between TS models and artifacts and maintain SSOT principle

### Acceptance Criteria

- **FR-500-01**: After build execution, detect differences between generated docs//specs/ and committed files [test]
- **FR-500-02**: Fail CI when differences are found [test]
- **FR-500-03**: Output message prompting to "regenerate and commit" [test]
- **FR-500-04**: Manual editing of artifacts is prohibited (detected by drift) [review]

---

## FR-600: External SSOT Consistency Check

**Type**: functional | **Priority**: must | **Category**: check

Verify consistency between TS models (external SSOT references) and external SSOT (OpenAPI, DDL, IaC, etc.)

### Acceptance Criteria

- **FR-600-01**: Existence check (referenced items exist in external artifacts) [test]
- **FR-600-02**: Type check (expected type/class/category matches) [test]
- **FR-600-03**: Constraint check (non-functional/guardrails are satisfied) [test]

---

## FR-601: Three Categories of Consistency Check

**Type**: functional | **Priority**: must | **Category**: check

All external SSOT consistency checks are uniformly composed of existence, type, and constraint categories

### Acceptance Criteria

- **FR-601-01**: Existence: Referenced items exist in external artifacts [test]
- **FR-601-02**: Type: Expected type/class/category matches [test]
- **FR-601-03**: Constraints: Non-functional/guardrails are satisfied [test]

---

## FR-602: Check Command

**Type**: functional | **Priority**: must | **Category**: check

Provide CLI command to execute external SSOT consistency check

### Rationale

Since consistency checks are implemented per model, filter by model name

### Acceptance Criteria

- **FR-602-01**: speckeeper check runs external SSOT consistency check for all models [test]
- **FR-602-02**: speckeeper check --model <model-name> checks only specific model [test]
- **FR-602-03**: Model name is the model ID defined in design/_models/ [review]
- **FR-602-04**: Only models with externalChecker are targeted [test]

---

## FR-603: External Checker

**Type**: functional | **Priority**: must | **Category**: check

Each model can define externalChecker to implement consistency check with external SSOT

### Rationale

Clarify model responsibilities by including external SSOT consistency check logic in model definition

### Acceptance Criteria

- **FR-603-01**: Can set externalChecker in Model definition [test]
- **FR-603-02**: externalChecker includes target file reading and check logic [test]
- **FR-603-03**: Check results include success, errors, warnings [test]
- **FR-603-04**: speckeeper check command auto-detects and runs models with externalChecker [test]

---

## FR-604: Coverage Verification

**Type**: functional | **Priority**: should | **Category**: check

Use Model class coverageChecker to verify cross-model coverage

### Rationale

To verify cross-model consistency (coverage) and prevent gaps

### Acceptance Criteria

- **FR-604-01**: Execute coverage verification with speckeeper check --coverage [test]
- **FR-604-02**: Define coverageChecker interface in Model class [test]
- **FR-604-03**: Auto-detect and execute models with coverageChecker [test]
- **FR-604-04**: Calculate and display coverage rate (%) [test]
- **FR-604-05**: List uncovered items [test]

---

## FR-605: Model-Integrated Check Architecture

**Type**: functional | **Priority**: must | **Category**: check

External SSOT and test verification logic is integrated into _models/ definitions, eliminating the separate _checkers/ directory

### Rationale

To consolidate check logic with model definitions, reducing management overhead and ensuring model-check consistency

### Acceptance Criteria

- **FR-605-01**: Scaffold does not generate _checkers/ directory [test]
- **FR-605-02**: Verification logic is included in _models/ model definitions [test]
- **FR-605-03**: speckeeper check external-ssot uses verification logic from _models/ model definitions only [test]
- **FR-605-04**: speckeeper check external-ssot does not reference _checkers/ directory [test]
- **FR-605-05**: Checker template functions (src/scaffold/templates/checkers/) are removed; checker logic moves to core DSL (src/core/dsl/) [test]

---

## FR-700: Change Impact Analysis

**Type**: functional | **Priority**: should | **Category**: impact

Analyze and list impact scope when IDs change

### Rationale

To understand the impact of changes in advance and support safe refactoring

### Acceptance Criteria

- **FR-700-01**: Analyze and list impact scope with speckeeper impact {ID} [test]
- **FR-700-02**: Define relations between models and track associations [test]
- **FR-700-03**: Reference depth (--depth) can be specified [test]
- **FR-700-04**: Display impacted specs, components, and documents [test]

---

## FR-701: Inter-model Relations

**Type**: functional | **Priority**: should | **Category**: impact

Define relations between models to enable impact scope tracking

### Rationale

Explicitly defining relations between models improves change impact analysis accuracy

### Acceptance Criteria

- **FR-701-01**: Can define relations via relations property in model definition [test]
- **FR-701-02**: Provides standard relation types [review]
- **FR-701-03**: Relations are used as input for impact analysis [test]
- **FR-701-04**: Define source/target model level constraints per relation type [test]
- **FR-701-05**: Level violations and circular references can be detected by lint [test]

---

## FR-702: Verified-By / Verifies Relation Types

**Type**: functional | **Priority**: must | **Category**: impact

Add verifiedBy relation type (spec→test code) and redefine verifies (test code→implementation code) for semantic accuracy

### Rationale

To express spec-test-implementation relationships with semantically accurate relation names instead of overloading implements

### Acceptance Criteria

- **FR-702-01**: verifiedBy is added as RelationType with edge category "check" (spec→test code direction) [test]
- **FR-702-02**: verifies is redefined as "test code tests implementation code" (test→implementation direction) [test]
- **FR-702-03**: verifiedBy between speckeeper→speckeeper nodes produces a warning [test]
- **FR-702-04**: Same source node can have both implements and verifiedBy edges, each verified independently [test]
- **FR-702-05**: verifies (typically external→external) is recognized for traceability but not a checker generation target [test]

---

## FR-703: Edge Type-Specific Relation Schema

**Type**: functional | **Priority**: must | **Category**: impact

implements and verifiedBy relations have edge-type-specific schemas (ImplementsRelationSchema, VerifiedByRelationSchema) with additional properties beyond target ID

### Rationale

To define structured relation data (path, target type, etc.) per edge type instead of using generic relation schema

### Acceptance Criteria

- **FR-703-01**: implements and verifiedBy have edge-type-specific schemas with additional properties (path, target type, etc.) [test]
- **FR-703-02**: Scaffold generates checker binding guidance comments when implements/verifiedBy edges are detected [test]
- **FR-703-03**: Edge-type-specific relation schemas are provided by core; no manual definition needed in model definitions [test]

---

## FR-800: Artifact Export (optional)

**Type**: functional | **Priority**: could | **Category**: export

Output aggregated JSON for machine processing

### Acceptance Criteria

- **FR-800-01**: Can output aggregated JSON for machine processing (specs/index.json) [test]
- **FR-800-02**: Can be used for future tool integration (dashboards, requirement lists, progress visualization) [review]

---

## FR-1000: External Checker Implementation

**Type**: functional | **Priority**: must | **Category**: check

Implement actual validation logic for externalOpenAPIChecker and externalSqlSchemaChecker, replacing stubs with real file parsing and verification

### Acceptance Criteria

- **FR-1000-01**: All child requirements (FR-1001~FR-1019) are satisfied [review]

---

## FR-1001: OpenAPI YAML/JSON Parsing

**Type**: functional | **Priority**: must | **Category**: check

externalOpenAPIChecker MUST parse YAML and JSON format OpenAPI files

### Acceptance Criteria

- **FR-1001-01**: YAML format OpenAPI files are parsed successfully [test]
- **FR-1001-02**: JSON format OpenAPI files are parsed successfully [test]

---

## FR-1002: OpenAPI Spec ID Verification

**Type**: functional | **Priority**: must | **Category**: check

externalOpenAPIChecker MUST verify spec IDs via operationId, path segments, schema names, and x-spec-id extensions

### Acceptance Criteria

- **FR-1002-01**: Spec ID found via operationId [test]
- **FR-1002-02**: Spec ID found via exact path segment match [test]
- **FR-1002-03**: Spec ID found via schema name [test]
- **FR-1002-04**: Spec ID found via x-spec-id extension [test]

---

## FR-1003: OpenAPI Missing Spec ID Warning

**Type**: functional | **Priority**: must | **Category**: check

externalOpenAPIChecker MUST report a warning for each spec ID not found in the OpenAPI document

### Acceptance Criteria

- **FR-1003-01**: Warning reported when spec ID is not found [test]

---

## FR-1004: OpenAPI Method Check

**Type**: functional | **Priority**: should | **Category**: check

externalOpenAPIChecker MAY optionally verify HTTP method exists for matched path (opt-in via config)

### Acceptance Criteria

- **FR-1004-01**: Method check is opt-in via mapper config [test]
- **FR-1004-02**: Warning reported for method mismatch [test]

---

## FR-1005: OpenAPI Parameter/Response Check

**Type**: functional | **Priority**: should | **Category**: check

externalOpenAPIChecker MAY optionally verify parameter names, response property names and types (opt-in via config)

### Acceptance Criteria

- **FR-1005-01**: Parameter check is opt-in via mapper config [test]
- **FR-1005-02**: Response property check is opt-in via mapper config [test]
- **FR-1005-03**: Type containment is used for type comparison [test]

---

## FR-1006: OpenAPI Mismatch Warnings

**Type**: functional | **Priority**: must | **Category**: check

externalOpenAPIChecker MUST report warnings for method/parameter/property/type mismatches

### Acceptance Criteria

- **FR-1006-01**: Warning for missing/wrong HTTP method [test]
- **FR-1006-02**: Warning for missing request parameter [test]
- **FR-1006-03**: Warning for missing response property [test]
- **FR-1006-04**: Warning for type mismatch [test]

---

## FR-1007: OpenAPI File Not Found Error

**Type**: functional | **Priority**: must | **Category**: check

externalOpenAPIChecker MUST report an error when the OpenAPI file does not exist

### Acceptance Criteria

- **FR-1007-01**: Error reported with missing file path [test]

---

## FR-1008: OpenAPI Parse Failure Error

**Type**: functional | **Priority**: must | **Category**: check

externalOpenAPIChecker MUST report an error when the OpenAPI file cannot be parsed

### Acceptance Criteria

- **FR-1008-01**: Error reported for invalid YAML [test]
- **FR-1008-02**: Error reported for empty file [test]

---

## FR-1009: SQL DDL Parsing

**Type**: functional | **Priority**: must | **Category**: check

externalSqlSchemaChecker MUST parse SQL DDL files and extract table definitions

### Acceptance Criteria

- **FR-1009-01**: DDL parsed with node-sql-parser [test]
- **FR-1009-02**: Table names, column names, and column types extracted [test]

---

## FR-1010: SQL Table Existence Check

**Type**: functional | **Priority**: must | **Category**: check

externalSqlSchemaChecker MUST verify spec-referenced table names exist in parsed DDL

### Acceptance Criteria

- **FR-1010-01**: Warning when referenced table is missing [test]

---

## FR-1011: SQL Column Existence Check

**Type**: functional | **Priority**: must | **Category**: check

externalSqlSchemaChecker MUST verify spec-referenced columns exist in DDL table

### Acceptance Criteria

- **FR-1011-01**: Warning when referenced column is missing [test]
- **FR-1011-02**: Column check skipped when table is missing [test]

---

## FR-1012: SQL Type Consistency Check

**Type**: functional | **Priority**: should | **Category**: check

externalSqlSchemaChecker MAY optionally verify column type containment (opt-in via checkTypes)

### Acceptance Criteria

- **FR-1012-01**: Type check is opt-in via checkTypes config [test]
- **FR-1012-02**: Wider DDL type accepted (SMALLINT→INT OK) [test]
- **FR-1012-03**: Narrower DDL type produces warning (INT→SMALLINT NG) [test]

---

## FR-1013: SQL Checker Warnings

**Type**: functional | **Priority**: must | **Category**: check

externalSqlSchemaChecker MUST report warnings for missing table, column, and type mismatches

### Acceptance Criteria

- **FR-1013-01**: Warning for missing table [test]
- **FR-1013-02**: Warning for missing column [test]
- **FR-1013-03**: Warning for type mismatch [test]

---

## FR-1014: SQL File Not Found Error

**Type**: functional | **Priority**: must | **Category**: check

externalSqlSchemaChecker MUST report an error when the DDL file does not exist

### Acceptance Criteria

- **FR-1014-01**: Error reported with missing file path [test]

---

## FR-1015: SQL Parse Failure Graceful Degradation

**Type**: functional | **Priority**: must | **Category**: check

externalSqlSchemaChecker MUST handle DDL parse failures gracefully with regex fallback

### Acceptance Criteria

- **FR-1015-01**: Regex fallback used when parser fails [test]
- **FR-1015-02**: Warning emitted for parse fallback [test]

---

## FR-1016: Checker Pattern Consistency

**Type**: functional | **Priority**: must | **Category**: check

Both checkers follow the testChecker pattern: file existence check → content parsing → spec ID verification

### Acceptance Criteria

- **FR-1016-01**: OpenAPI checker follows file→parse→verify pattern [test]
- **FR-1016-02**: SQL checker follows file→parse→verify pattern [test]

---

## FR-1017: Source Path Fallback

**Type**: functional | **Priority**: must | **Category**: check

Both checkers use sourcePath from checker config, falling back to hardcoded defaults

### Acceptance Criteria

- **FR-1017-01**: Config sourcePath used when provided [test]
- **FR-1017-02**: Default path used when no config [test]

---

## FR-1018: Minimal New Dependencies

**Type**: functional | **Priority**: must | **Category**: check

Only node-sql-parser added as new runtime dependency (>100K weekly downloads)

### Acceptance Criteria

- **FR-1018-01**: Only node-sql-parser added as new dependency [review]

---

## FR-1019: Checker Documentation Accuracy

**Type**: functional | **Priority**: must | **Category**: check

README and scaffold-mermaid-spec.md accurately describe all three built-in checkers as fully implemented

### Acceptance Criteria

- **FR-1019-01**: README checker table describes validation levels [review]
- **FR-1019-02**: scaffold-mermaid-spec.md Section 7 describes validation levels [review]