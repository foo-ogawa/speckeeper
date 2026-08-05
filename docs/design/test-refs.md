# Test Reference List

| ID | Description | Framework | Requirements Count |
|----|-------------|-----------|-------------------|
| TEST-003 | Config file loading utility verification test | vitest | 1 |
| TEST-004 | File writing utility verification test | vitest | 1 |
| TEST-018 | Model level configuration feature verification test | vitest | 1 |
| TEST-019 | Project initialization feature verification test | vitest | 1 |
| TEST-020 | Lint command verification test | vitest | 3 |
| TEST-021 | Check command verification test | vitest | 4 |
| TEST-022 | Build command verification test | vitest | 2 |
| TEST-023 | Impact command verification test | vitest | 1 |
| TEST-024 | Drift command verification test | vitest | 1 |
| TEST-025 | New command verification test | vitest | 1 |
| TEST-026 | Scaffold integration verification test (mermaid parsing, class-based generation) | vitest | 1 |
| TEST-027 | Global scanner and coverage checker verification test (OpenAPI, SQL DDL, relation coverage) | vitest | 15 |
| TEST-028 | Core lint rule factory verification test | vitest | 5 |
| TEST-029 | Core markdown exporter factory verification test | vitest | 1 |
| TEST-030 | Core schema and edge-type relation schema verification test | vitest | 3 |
| TEST-031 | YAML/JSON spec loader verification test | vitest | 3 |
| TEST-032 | CLI config loading verification test | vitest | 4 |
| TEST-033 | Insight provider verification test (spec relations to external edges) | vitest | 2 |
| TEST-034 | Edge vocabulary verification test (verifiedBy / verifies categories) | vitest | 1 |
| TEST-035 | Scaffold template registry verification test (base template resolution) | vitest | 1 |
| TEST-036 | Scaffold model generator verification test (no checker generation) | vitest | 3 |
| TEST-037 | Audit report formatting verification test | vitest | 1 |
| TEST-038 | Impact explanation context builder verification test | vitest | 1 |
| TEST-039 | Model renderer verification test | vitest | 3 |
| TEST-040 | Relation level constraint and cycle detection verification test | vitest | 2 |
| TEST-041 | Convert command verification test | vitest | 1 |
| TEST-042 | Model-declared externalChecker and coverageChecker verification test | vitest | 2 |
| TEST-043 | Machine-readable build artifact verification test (Entity JSON Schema, reference resolution graph) | vitest | 3 |
| TEST-044 | Model-declared lint rule verification test | vitest | 1 |
| TEST-045 | Check command source filtering verification test | vitest | 1 |
| TEST-050 | Scan diagnostic severity and opt-in deep validation verification test | vitest | 7 |
| TEST-051 | Absent spec ID warning verification test | vitest | 3 |
| TEST-070 | Common lint item verification test | vitest | 3 |
| TEST-071 | Core-provided test verification logic test | vitest | 1 |
| TEST-072 | External SSOT reference interface test | vitest | 1 |
| TEST-073 | External SSOT constraint check test | vitest | 2 |
| TEST-074 | External SSOT path configuration test | vitest | 1 |
| TEST-060 | Model-integrated external SSOT check verification test (declared checkers and source path resolution) | vitest | 2 |
| TEST-061 | CLI test traceability verification test (command coverage, TestRef linkage, definition consistency) | vitest | 3 |
| TEST-062 | Repository invariant verification test (retired checker locations, TypeScript settings, suite wiring) | vitest | 3 |
| TEST-063 | Insights command verification test (ExternalInsight JSON export) | vitest | 2 |
| TEST-064 | Drift verification test over the machine-readable artifacts (specs/) | vitest | 1 |

---

## TEST-003: Config file loading utility verification test

### Test Source

- **Path**: `test/utils/config-loader.test.ts`
- **Framework**: vitest
- **Result JSON**: `test-results/all.json`

### Verified Requirements

- CR-002

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| CR-002-01 | `default config|no config file` | Default config test |

---

## TEST-004: File writing utility verification test

### Test Source

- **Path**: `test/utils/file-writer.test.ts`
- **Framework**: vitest
- **Result JSON**: `test-results/all.json`

### Verified Requirements

- FR-300

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-300-01 | `write.*file|file.*writ` | File output test |

---

## TEST-018: Model level configuration feature verification test

### Test Source

- **Path**: `test/core/model-level.test.ts`
- **Framework**: vitest
- **Result JSON**: `test-results/all.json`

### Verified Requirements

- FR-104

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-104-08 | `FR-104-08.*modelLevel configuration` | modelLevel setting test |
| FR-104-09 | `FR-104-09.*level.*property` | level property retrieval test |

---

## TEST-019: Project initialization feature verification test

### Test Source

- **Path**: `test/cli/init.test.ts`
- **Framework**: vitest
- **Result JSON**: `test-results/all.json`

### Verified Requirements

- FR-105

### Implemented Command

- CMD-INIT

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-105-01 | `FR-105-01.*creates design/` | Design directory creation test |
| FR-105-02 | `FR-105-02.*speckeeper.config.ts` | Config file generation test |
| FR-105-03 | `FR-105-03.*package.json` | Package.json generation test |
| FR-105-04 | `FR-105-04.*tsconfig.json` | tsconfig.json generation test |
| FR-105-05 | `FR-105-05.*model definitions` | Model definitions generation test |
| FR-105-06 | `FR-105-06.*sample specification` | Sample specification generation test |
| FR-105-07 | `FR-105-07.*speckeeper lint` | Generated project lint test |
| FR-105-08 | `FR-105-08.*typecheck` | Generated project typecheck test |
| FR-105-09 | `FR-105-09.*--force` | Force overwrite test |
| FR-105-10 | `FR-105-10.*skips package.json` | Skip existing package.json test |

---

## TEST-020: Lint command verification test

### Test Source

- **Path**: `test/cli/lint.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-400
- FR-401
- FR-402

### Implemented Command

- CMD-LINT

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-400-01 | `FR-400-01 verifies ID uniqueness across models and fails the run` | The lint command runs the common lint items over the whole design |
| FR-401-01 | `FR-401-01.*lintAll.*exits.*code 1` | Error-severity results trigger exit(1) |
| FR-401-03 | `FR-401-03.*exits.*code 1.*error message` | Ref-exists error triggers exit and output |
| FR-402-01 | `FR-402-01.*lintAll.*outputs warning` | Warnings output without exit |
| FR-402-03 | `FR-402-03.*rule ID, message, and target ID` | Lint output carries the rule ID, message, and target ID |

---

## TEST-021: Check command verification test

### Test Source

- **Path**: `test/cli/check.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-104
- FR-602
- FR-603
- FR-604

### Implemented Command

- CMD-CHECK

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-104-05 | `FR-104-05.*only models with externalChecker` | externalChecker is optional per model |
| FR-602-01 | `FR-602-01.*check.*consistency` | Check runs external SSOT check |
| FR-602-04 | `FR-602-04.*skips.*without external` | Skips models without external source |
| FR-603-03 | `FR-603-03.*exits.*code 1.*outputs.*error` | Outputs error/warning messages and exits |
| FR-603-04 | `FR-602-01.*check runs external SSOT consistency check for all models` | Models carrying an externalChecker are detected and run |
| FR-604-01 | `runs coverage checks when --coverage option is specified` | --coverage runs the coverage verification |
| FR-604-03 | `runs coverage checks when --coverage option is specified` | Models carrying a coverageChecker are detected and run |

---

## TEST-022: Build command verification test

### Test Source

- **Path**: `test/cli/build.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-300
- FR-301

### Implemented Command

- CMD-BUILD

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-300-01 | `FR-300-01.*exporter\.single.*batchWriteFiles` | Calls exporter and passes to batchWriteFiles |
| FR-301-05 | `FR-301-05.*exporter\.single.*identical arguments` | Same arguments on repeated builds |

---

## TEST-023: Impact command verification test

### Test Source

- **Path**: `test/cli/impact.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-700

### Implemented Command

- CMD-IMPACT

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-700-01 | `FR-700-01.*target info.*analysis phase` | Reaches analysis phase for valid ID |
| FR-700-03 | `FR-700-03.*depth value.*--depth` | Outputs depth from --depth option |
| FR-700-04 | `FR-700-04.*impacted specs, components, and documents` | Output lists the impacted specs with their model type and depth |

---

## TEST-024: Drift command verification test

### Test Source

- **Path**: `test/cli/drift.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-500

### Implemented Command

- CMD-DRIFT

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-500-01 | `FR-500-01.*No drift detected.*content match` | No drift when content matches |
| FR-500-02 | `FR-500-02.*exits.*code 1.*failOnDrift` | Exits with code 1 on failOnDrift |
| FR-500-03 | `FR-500-03.*prompting to regenerate and commit` | Drift output prompts to regenerate and commit |

---

## TEST-025: New command verification test

### Test Source

- **Path**: `test/cli/new.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-104

### Implemented Command

- CMD-NEW

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-104-01 | `FR-104-01.*available model types header` | Outputs model types header when type omitted |

---

## TEST-026: Scaffold integration verification test (mermaid parsing, class-based generation)

### Test Source

- **Path**: `test/scaffold/integration.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-106

### Implemented Command

- CMD-SCAFFOLD

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-106-01 | `base template.*core factory|generated models.*base template` | Artifact class generates from base template |
| FR-106-03 | `SR.*FR.*NFR.*map to requirement.*de-duplicated` | Same-class node aggregation into single model file |
| FR-106-05 | `de-duplicated model files.*spec data` | Model file generation with naming conventions |

---

## TEST-027: Global scanner and coverage checker verification test (OpenAPI, SQL DDL, relation coverage)

### Test Source

- **Path**: `test/core/dsl/checkers.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-107
- FR-600
- FR-601
- FR-604
- FR-1001
- FR-1002
- FR-1004
- FR-1005
- FR-1006
- FR-1009
- FR-1011
- FR-1012
- FR-1013
- FR-1015
- FR-1016

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-107-05 | `computes coverage from relations` | Relation-based coverage checker factory |
| FR-600-01 | `scans OpenAPI source and returns matches` | Existence check against an external artifact |
| FR-600-02 | `warns on parameter type mismatch` | Type check against an external artifact |
| FR-601-01 | `scans DDL source and returns matches` | Existence category of the consistency check |
| FR-601-02 | `warns on narrower type` | Type category of the consistency check |
| FR-604-04 | `computes coverage from relations` | Coverage rate calculation |
| FR-604-05 | `computes coverage from relations` | Uncovered items are listed |
| FR-1001-01 | `scans OpenAPI source and returns matches` | YAML OpenAPI file is parsed |
| FR-1001-02 | `parses JSON format OpenAPI file` | JSON OpenAPI file is parsed |
| FR-1002-01 | `finds spec ID via operationId` | Spec ID resolved through operationId |
| FR-1002-02 | `finds spec ID via path segment` | Spec ID resolved through a path segment |
| FR-1002-03 | `finds spec ID via schema name` | Spec ID resolved through a schema name |
| FR-1002-04 | `finds spec ID via x-spec-id extension` | Spec ID resolved through the x-spec-id extension |
| FR-1004-02 | `warns on method mismatch` | HTTP method mismatch warning |
| FR-1005-03 | `compares response property types by containment` | Type comparison uses containment |
| FR-1006-01 | `warns on method mismatch` | Warning for a wrong HTTP method |
| FR-1006-02 | `warns when parameter is missing` | Warning for a missing request parameter |
| FR-1006-03 | `warns when response property is missing` | Warning for a missing response property |
| FR-1006-04 | `warns on parameter type mismatch` | Warning for a type mismatch |
| FR-1009-01 | `finds existing table` | DDL parsed with node-sql-parser |
| FR-1009-02 | `finds existing columns` | Table and column names are extracted |
| FR-1011-01 | `warns when column is missing` | Warning for a missing column |
| FR-1012-01 | `leaves the type check off unless checkTypes opts in` | Type check is opt-in through checkTypes |
| FR-1012-02 | `accepts wider type` | Wider DDL type is accepted |
| FR-1012-03 | `warns on narrower type` | Narrower DDL type warns |
| FR-1013-02 | `warns when column is missing` | Missing column warning |
| FR-1013-03 | `warns on narrower type` | Type mismatch warning |
| FR-1015-01 | `falls back to regex parsing when node-sql-parser rejects the file` | Regex fallback runs when the SQL parser fails |
| FR-1016-01 | `scans OpenAPI source and returns matches` | OpenAPI checker runs file, parse, verify |
| FR-1016-02 | `scans DDL source and returns matches` | SQL checker runs file, parse, verify |

---

## TEST-028: Core lint rule factory verification test

### Test Source

- **Path**: `test/core/dsl/lint-rules.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-101
- FR-107
- FR-400
- FR-401
- FR-402

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-101-02 | `supports custom pattern` | ID convention is enforced by a configurable pattern |
| FR-107-01 | `combines factory and custom rules in one array` | Core provides the generic lint rule factories |
| FR-107-06 | `only custom rule triggers on spec that passes factory rules` | Custom rules coexist with the core factories |
| FR-400-02 | `factory and custom rules detect violations independently` | Model-specific custom lint rules execute |
| FR-401-02 | `returns true for invalid ID FR-1` | ID convention violation is detected |
| FR-402-02 | `uses provided severity` | Severity is settable on a custom rule |

---

## TEST-029: Core markdown exporter factory verification test

### Test Source

- **Path**: `test/core/dsl/exporters.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-107

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-107-02 | `generates single markdown with title, meta, and sections` | Core provides the declarative markdown exporter factories |

---

## TEST-030: Core schema and edge-type relation schema verification test

### Test Source

- **Path**: `test/core/dsl/schema.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-107
- FR-701
- FR-703

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-107-03 | `can be extended with additional fields` | Common schema base is extended by models |
| FR-701-01 | `accepts optional relations` | Relations are declared through the relations property |
| FR-703-01 | `parses valid implements relation` | Edge-type-specific schema carries additional properties |
| FR-703-03 | `parses valid verifiedBy relation` | Edge-type-specific schemas ship with core |

---

## TEST-031: YAML/JSON spec loader verification test

### Test Source

- **Path**: `test/core/yaml-loader.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-104
- NFR-004
- NFR-007

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-104-02 | `throws on schema validation failure with helpful message` | Runtime validation runs through the Zod schema |
| NFR-004-01 | `loads single-model YAML` | A model defined by inheriting the base class is usable |
| NFR-007-01 | `throws on schema validation failure with helpful message` | Error message carries the spec ID |
| NFR-007-02 | `NFR-007-02.*file path and the line number` | Parse error message carries the file path and the line number |
| NFR-007-03 | `throws on schema validation failure with helpful message` | Error message carries the offending field name |

---

## TEST-032: CLI config loading verification test

### Test Source

- **Path**: `test/cli/config-load.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-104
- NFR-004
- NFR-005
- NFR-009

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-104-07 | `loads the project scaffolded by init` | Registered models become lint targets |
| NFR-004-03 | `loads the project scaffolded by init` | Models registered in the config become command targets |
| NFR-005-01 | `loads the project scaffolded by init, whose config imports the design modules` | TypeScript DSL input is loaded |
| NFR-009-01 | `applies a config written with defineConfig imported from the package entry` | Package entry is consumed through an import statement |

---

## TEST-033: Insight provider verification test (spec relations to external edges)

### Test Source

- **Path**: `test/external/insight-provider.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-700
- FR-701

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-700-02 | `converts spec relations to ExternalEdge with spec_relation evidence` | Relations between models are tracked as associations |
| FR-701-03 | `filters edges by changedFiles` | Relations feed the impact analysis graph |

---

## TEST-034: Edge vocabulary verification test (verifiedBy / verifies categories)

### Test Source

- **Path**: `test/scaffold/edge-vocabulary.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-702

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-702-01 | `contains verifiedBy as check category` | verifiedBy is a check-category relation type |
| FR-702-03 | `warns when verifiedBy is speckeeper` | speckeeper to speckeeper verifiedBy warns |
| FR-702-04 | `FR-702-04 resolves both an implements and a verifiedBy edge of one source node` | One source node carries both edges and each is resolved on its own |
| FR-702-05 | `contains verifies as external category` | verifies is traceability only, not a checker target |

---

## TEST-035: Scaffold template registry verification test (base template resolution)

### Test Source

- **Path**: `test/scaffold/template-registry.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-106

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-106-04 | `uses base when no classes provided` | Classless node falls back to the base template |
| FR-106-06 | `resolves unknown class to base template` | No fixed node ID to template mapping remains |
| FR-106-07 | `resolves logical-entity class to base with correct names` | Level, name and filename are derived, not registered |
| FR-106-09 | `resolves any class to base template with correct name derivation` | Only the base template remains |

---

## TEST-036: Scaffold model generator verification test (no checker generation)

### Test Source

- **Path**: `test/scaffold/model-generator.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-106
- FR-605
- FR-703

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-106-02 | `deduplicates nodes with the same template class` | Same-class nodes aggregate into one model file |
| FR-106-08 | `does not generate externalChecker code` | No fixed external node to checker mapping remains |
| FR-605-01 | `emits no _checkers/ file for any edge category` | Scaffold generates no _checkers/ directory |
| FR-703-02 | `FR-703-02 names the implements target and points at the config binding` | A check edge produces checker binding guidance, not checker code |

---

## TEST-037: Audit report formatting verification test

### Test Source

- **Path**: `test/agents/formatter.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-1100

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-1100-02 | `formats findings with severity icons` | Report findings carry severity and affected spec ID |
| FR-1100-04 | `respects failOn=warning threshold` | failOn controls the exit code threshold |

---

## TEST-038: Impact explanation context builder verification test

### Test Source

- **Path**: `test/agents/context-builder.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-1102

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-1102-01 | `wraps stdin JSON in context` | Impact analysis JSON from stdin is read into the prompt context |

---

## TEST-039: Model renderer verification test

### Test Source

- **Path**: `test/core/model-render.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-104
- FR-301
- NFR-004

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-104-04 | `FR-104-04, NFR-004-02 lets each model class define its own output functions` | Model-specific renderers are declarable |
| FR-301-01 | `FR-301-01 exposes every renderer declared in the subclass` | Renderers are declared through the renderers property |
| FR-301-02 | `FR-301-02 renders through Model.render using the supplied RenderContext` | Rendering runs through the common Model.render interface |
| FR-301-03 | `FR-301-03 renders the same format differently per model class` | Rendering result depends on the model class |
| FR-301-04 | `FR-301-04 selects the renderer matching the requested format` | The format parameter selects the renderer |
| NFR-004-02 | `NFR-004-02 lets each model class define its own output functions` | Each model defines its own renderers |

---

## TEST-040: Relation level constraint and cycle detection verification test

### Test Source

- **Path**: `test/core/relation.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-401
- FR-701

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-401-04 | `FR-401-04 detects a cycle and names every node on the cycle path` | Circular references are detected |
| FR-701-04 | `FR-701-04 applies a different target-level constraint to each relation type` | Level constraints are defined per relation type |
| FR-701-05 | `FR-701-05 reports a level violation when source is not more concrete than target` | Level violations are detected |

---

## TEST-041: Convert command verification test

### Test Source

- **Path**: `test/cli/convert.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-1104

### Implemented Command

- CMD-CONVERT

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-1104-01 | `FR-1104-01 writes YAML carrying the model id and every spec of the module` | SpecModule file converts to equivalent YAML |
| FR-1104-02 | `FR-1104-02 writes next to the source file with the extension replaced` | Output defaults to the source filename with .yaml |
| FR-1104-03 | `FR-1104-03 writes to the path given by output and not to the default path` | output selects a custom output path |
| FR-1104-04 | `FR-1104-04 prints the YAML and leaves no output file behind` | dry-run previews without writing |

---

## TEST-042: Model-declared externalChecker and coverageChecker verification test

### Test Source

- **Path**: `test/core/model-checkers.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-603
- FR-604

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-603-01 | `FR-603-01 resolves the external source path from the declared checker` | externalChecker is settable in the model definition |
| FR-603-02 | `FR-603-02 returns the declared errors when the external data misses the spec` | Declared check logic runs against the target data |
| FR-604-02 | `FR-604-02 runs the declared checker against the model registry` | coverageChecker interface is defined on the model class |

---

## TEST-043: Machine-readable build artifact verification test (Entity JSON Schema, reference resolution graph)

### Test Source

- **Path**: `test/cli/build-specs.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-300
- FR-302
- FR-800

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-300-02 | `FR-300-02 writes every file under specsDir as machine-readable JSON` | Every artifact the build writes under specsDir parses as JSON |
| FR-302-01 | `FR-302-01.*maps entity attributes.*JSON Schema properties` | Entity attributes become JSON Schema properties under specs/schemas/entities/ |
| FR-302-02 | `FR-302-02.*reference resolution graph` | Reference resolution graph is written to specs/index.json |
| FR-800-01 | `FR-800-01.*aggregated JSON` | Aggregated JSON for machine processing is written on every build |

---

## TEST-044: Model-declared lint rule verification test

### Test Source

- **Path**: `test/core/model-lint.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-104

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-104-03 | `FR-104-03 runs the declared rules and reports the violated ones only` | Rules declared in the model definition run against the specs |

---

## TEST-045: Check command source filtering verification test

### Test Source

- **Path**: `test/cli/check-sources.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-602

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-602-02 | `FR-602-02 scans only the OpenAPI source when the type is openapi` | The type argument narrows the scanned sources to that type |

---

## TEST-050: Scan diagnostic severity and opt-in deep validation verification test

### Test Source

- **Path**: `test/core/dsl/checkers.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-1004
- FR-1005
- FR-1007
- FR-1008
- FR-1011
- FR-1014
- FR-1015

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-1004-01 | `leaves the method check off unless the mapper opts in` | A mapper without a method declaration runs no method check |
| FR-1005-01 | `leaves the parameter check off unless the mapper opts in` | A mapper without parameters runs no parameter check |
| FR-1005-02 | `leaves the response property check off unless the mapper opts in` | A mapper without response properties runs no property check |
| FR-1007-01 | `reports an error naming the missing OpenAPI file path` | A missing OpenAPI file is an error carrying the path |
| FR-1008-01 | `reports an error for an unparseable OpenAPI file` | Malformed OpenAPI YAML is an error |
| FR-1008-02 | `reports an error for an empty OpenAPI file` | An empty OpenAPI file is an error |
| FR-1011-02 | `skips the column check when the table is missing` | A missing table suppresses per-column warnings |
| FR-1014-01 | `reports an error naming the missing DDL file path` | A missing DDL file is an error carrying the path |
| FR-1015-02 | `emits a warning when DDL parsing falls back to regex` | The regex fallback reports the degradation as a warning |

---

## TEST-051: Absent spec ID warning verification test

### Test Source

- **Path**: `test/cli/check-sources.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-1003
- FR-1010
- FR-1013

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-1003-01 | `FR-1003-01 warns about an operation absent from the OpenAPI document` | A spec ID missing from the OpenAPI document warns by default |
| FR-1010-01 | `FR-1010-01, FR-1013-01 warns about a table absent from the DDL` | A spec-referenced table missing from the DDL warns by default |
| FR-1013-01 | `FR-1010-01, FR-1013-01 warns about a table absent from the DDL` | The missing table is reported as a warning |

---

## TEST-070: Common lint item verification test

### Test Source

- **Path**: `test/core/design-lint.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-101
- FR-102
- FR-401

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-101-01 | `FR-101-01 reports an id that more than one element declares` | An id declared by more than one element is an error |
| FR-101-03 | `FR-101-03 reports a relation whose target no model declares` | A relation target that resolves to nothing is an error |
| FR-101-04 | `FR-101-04 names every reference location left behind by an id change` | Every location still pointing at a changed id is reported |
| FR-102-01 | `FR-102-01 accepts REQ, HLD, LLD and OPS and orders them` | The phase vocabulary carries REQ, HLD, LLD and OPS in order |
| FR-102-02 | `FR-102-02 keeps the phase set on a model definition and verifies the gate against it` | A model definition carries a phase and the gate is verified |
| FR-102-03 | `FR-102-03 prohibits a TBD once the gate reaches its deadline phase` | A TBD is allowed before its deadline phase and prohibited at it |
| FR-401-05 | `FR-401-05 reports every slot left unresolved at the specified phase` | Every TBD still unresolved at the specified phase is reported |
| FR-401-06 | `FR-401-06 detects an element that takes part in no relation` | Orphan elements are detected |

---

## TEST-071: Core-provided test verification logic test

### Test Source

- **Path**: `test/core/dsl/test-verification.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-107

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-107-04 | `FR-107-04 finds the test files, checks spec ID references and parses results from the test file path` | Test file search, spec ID reference check and result parsing come from core |

---

## TEST-072: External SSOT reference interface test

### Test Source

- **Path**: `test/core/dsl/external-refs.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-200

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-200-01 | `FR-200-01 provides a .* interface that targets its external SSOT` | APIRef, TableRef, IaCRef and BatchRef interfaces are provided |
| FR-200-02 | `FR-200-02 carries the file path and the identifier of the referenced target` | A reference carries the path and identifier of its target |
| FR-200-03 | `FR-200-03 associates a reference with a component and an entity` | A reference associates with related components and entities |

---

## TEST-073: External SSOT constraint check test

### Test Source

- **Path**: `test/core/constraint-check.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-600
- FR-601

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-600-03 | `FR-600-03 fails the check when a non-functional constraint is not satisfied` | A violated guardrail fails the external SSOT check |
| FR-601-03 | `FR-601-03 reports every declared constraint that the external object violates` | The constraint category reports every violated constraint |

---

## TEST-074: External SSOT path configuration test

### Test Source

- **Path**: `test/cli/external-ssot-paths.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-201

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-201-01 | `FR-201-01 resolves the external SSOT from the paths declared in the config` | External SSOT paths are read from the config |

---

## TEST-060: Model-integrated external SSOT check verification test (declared checkers and source path resolution)

### Test Source

- **Path**: `test/cli/check-external-ssot.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-605
- FR-1017

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-605-02 | `FR-605-02 the registered models declare the verification logic themselves` | The registered models carry the verification logic in their own definitions |
| FR-605-03 | `FR-605-03 check external-ssot reports exactly what the declared checkers report` | The check command reports only what the model-declared checkers produce |
| FR-1017-01 | `FR-1017-01 uses the path each spec configures` | A configured source path is the path the checker resolves |
| FR-1017-02 | `FR-1017-02 falls back to a hardcoded default when the spec configures no path` | Without a configured path the checker uses its hardcoded default |

---

## TEST-061: CLI test traceability verification test (command coverage, TestRef linkage, definition consistency)

### Test Source

- **Path**: `test/design/traceability.test.ts`
- **Framework**: vitest

### Verified Requirements

- NFR-012
- NFR-013
- NFR-014

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| NFR-012-01 | `NFR-012-01 each CLI command the requirement names has a test file in test/cli/` | Every scoped CLI command has a test file under test/cli/ |
| NFR-012-02 | `NFR-012-02 describe/it names in test/cli/ mention the requirements the TestRef declares` | CLI test suites name the requirements their TestRef declares |
| NFR-012-03 | `NFR-012-03 statement coverage of the CLI command modules reaches the required percentage` | Measured statement coverage of the CLI command modules meets the threshold |
| NFR-013-01 | `NFR-013-01 every test file in test/cli/ is declared by a TestRef` | No CLI test file is left undeclared in design/test-refs.yaml |
| NFR-013-02 | `NFR-013-02 TestRefs link to command IDs via implementsCommand` | TestRef linkage to command IDs resolves and covers every commands test file |
| NFR-013-03 | `NFR-013-03 the declared TestRef check succeeds for every TestRef` | The TestRef checker reports no error for any declared TestRef |
| NFR-014-01 | `NFR-014-01 every command definition matches the contract and the generated program` | Command definitions agree with cli-contract.yaml and the generated program |

---

## TEST-062: Repository invariant verification test (retired checker locations, TypeScript settings, suite wiring)

### Test Source

- **Path**: `test/design/repo-invariants.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-605
- NFR-008
- NFR-015

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-605-04 | `FR-605-04 no speckeeper source file references the retired checker directory` | No source file mentions the retired checker directory |
| FR-605-05 | `FR-605-05 the checker template directory is removed and the core DSL holds the logic` | The checker template directory is gone and the core DSL directory exists |
| NFR-008-01 | `NFR-008-01 the project compiles on the required TypeScript version` | The installed compiler meets the required version and the project compiles |
| NFR-008-02 | `NFR-008-02 the compilation the check runs is a strict-mode compilation` | The compiler settings the check uses enable strict mode |
| NFR-015-01 | `NFR-015-01 every test file on disk is collected by exactly one configured suite` | No existing test file drops out of the configured suites |

---

## TEST-063: Insights command verification test (ExternalInsight JSON export)

### Test Source

- **Path**: `test/cli/insights.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-701
- FR-800

### Implemented Command

- CMD-INSIGHTS

---

## TEST-064: Drift verification test over the machine-readable artifacts (specs/)

### Test Source

- **Path**: `test/cli/drift-specs.test.ts`
- **Framework**: vitest

### Verified Requirements

- FR-500

### Test Case Patterns

| Acceptance Criteria ID | Pattern | Description |
|------------------------|---------|-------------|
| FR-500-01 | `FR-500-01 detects a hand-edited entity JSON Schema under specs/` | A hand-edited machine-readable artifact is detected as drift |

---
