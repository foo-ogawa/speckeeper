# Requirements

## Non-Functional Requirements

| ID | Name | Priority | Category |
|----|------|----------|----------|
| NFR-001 | Command Execution Time | should | performance |
| NFR-002 | Node.js Compatibility | must | portability |
| NFR-003 | Multi-OS Support | must | portability |
| NFR-004 | User-defined Models | must | extensibility |
| NFR-005 | Input Format Diversity | should | extensibility |
| NFR-006 | Rule Extensibility | should | extensibility |
| NFR-007 | Error Message Clarity | must | transparency |
| NFR-008 | TypeScript Compatibility | must | compatibility |
| NFR-009 | ESM Support | must | compatibility |
| NFR-010 | npm Distribution | must | deployability |
| NFR-011 | CLI Test Infrastructure | must | testability |
| NFR-012 | CLI Command Test Coverage | must | testability |
| NFR-013 | Test-Specification Traceability | must | testability |
| NFR-014 | CLI Definition-Implementation Consistency | must | testability |
| NFR-015 | CLI Backward Compatibility | must | testability |

---

## NFR-001: Command Execution Time

**Type**: non-functional | **Priority**: should | **Category**: performance

lint/build/drift within 1 minute for typical requirement scale (~500 items), check within 2 minutes (depends on file count)

### Acceptance Criteria

- **NFR-001-01**: lint/build/drift within 60 seconds for 500 requirements scale [test]
- **NFR-001-02**: check within 120 seconds for 1000 files scale [test]
- **NFR-001-03**: build within 5 seconds for 1000 requirements, 100 entities, 50 screens [test]

---

## NFR-002: Node.js Compatibility

**Type**: non-functional | **Priority**: must | **Category**: portability

Works on Node.js (LTS)

### Acceptance Criteria

- **NFR-002-01**: Verified on Node.js 18 LTS [test]
- **NFR-002-02**: Verified on Node.js 20 LTS [test]
- **NFR-002-03**: Verified on Node.js 22 LTS [test]

---

## NFR-003: Multi-OS Support

**Type**: non-functional | **Priority**: must | **Category**: portability

Avoid OS dependencies and work on Linux/macOS/Windows

### Acceptance Criteria

- **NFR-003-01**: Verified on Linux (Ubuntu) [test]
- **NFR-003-02**: Verified on macOS [test]
- **NFR-003-03**: Verified on Windows (PowerShell) [test]
- **NFR-003-04**: Eliminate OS-dependent code such as path separators [review]

---

## NFR-004: User-defined Models

**Type**: non-functional | **Priority**: must | **Category**: extensibility

Users can define custom models by inheriting from Model base class

### Acceptance Criteria

- **NFR-004-01**: Can define new models by inheriting from Model base class [test]
- **NFR-004-02**: Can define model-specific schema, lint rules, and renderers [test]
- **NFR-004-03**: Models registered in speckeeper.config.ts become targets of lint/build/check [test]

---

## NFR-005: Input Format Diversity

**Type**: non-functional | **Priority**: should | **Category**: extensibility

Allow YAML/JSON input to lower participation barriers for non-developers

### Acceptance Criteria

- **NFR-005-01**: Support TypeScript DSL input [test]
- **NFR-005-02**: Support YAML format input [demo]
- **NFR-005-03**: Support JSON format input [demo]

---

## NFR-006: Rule Extensibility

**Type**: non-functional | **Priority**: should | **Category**: extensibility

Allow adding lint and check rules via plugin mechanism

### Acceptance Criteria

- **NFR-006-01**: Custom lint rules can be added [demo]
- **NFR-006-02**: Custom check rules (external SSOT verification) can be added [demo]
- **NFR-006-03**: Rules are defined under Model._models/ [review]

---

## NFR-007: Error Message Clarity

**Type**: non-functional | **Priority**: must | **Category**: transparency

Output errors showing requirement ID, file, and field name, providing messages that clearly show "why it failed"

### Acceptance Criteria

- **NFR-007-01**: Errors include requirement ID/specification ID [test]
- **NFR-007-02**: Errors include file path and line number (when possible) [test]
- **NFR-007-03**: Errors include problematic field name [test]
- **NFR-007-04**: Provide hints for fixes [review]

---

## NFR-008: TypeScript Compatibility

**Type**: non-functional | **Priority**: must | **Category**: compatibility

Type checking passes on TypeScript 5.0+

### Acceptance Criteria

- **NFR-008-01**: Compiles successfully on TypeScript 5.0 [test]
- **NFR-008-02**: No type errors in strict mode [test]

---

## NFR-009: ESM Support

**Type**: non-functional | **Priority**: must | **Category**: compatibility

Provided in ES Modules format

### Acceptance Criteria

- **NFR-009-01**: Can be imported via import statement [test]
- **NFR-009-02**: Tree-shaking works [inspection]

---

## NFR-010: npm Distribution

**Type**: non-functional | **Priority**: must | **Category**: deployability

Can be distributed as npm package

### Acceptance Criteria

- **NFR-010-01**: Can publish package via npm publish [demo]
- **NFR-010-02**: Can install via npm install speckeeper [demo]

---

## NFR-011: CLI Test Infrastructure

**Type**: non-functional | **Priority**: must | **Category**: testability

All CLI commands have comprehensive test coverage with traceability to specifications

### Acceptance Criteria

- **NFR-011-01**: All child requirements (NFR-012~NFR-015) are satisfied [review]

---

## NFR-012: CLI Command Test Coverage

**Type**: non-functional | **Priority**: must | **Category**: testability

Each CLI command (lint, check, build, impact, drift, new) has a corresponding test file in test/cli/ with requirement ID references

### Rationale

To prevent regression bugs in CLI commands that directly affect all users and CI pipelines

### Acceptance Criteria

- **NFR-012-01**: Test files exist in test/cli/ for each CLI command (lint, check, build, impact, drift, new) [test]
- **NFR-012-02**: describe/it block names contain corresponding requirement IDs (FR-xxx) [test]
- **NFR-012-03**: CLI module statement coverage reaches 60% or above (from 0%) [test]

---

## NFR-013: Test-Specification Traceability

**Type**: non-functional | **Priority**: must | **Category**: testability

TestRef definitions in design/test-refs.ts provide bidirectional traceability between tests and specifications

### Rationale

To ensure all acceptance criteria are covered by test cases and maintain spec-test traceability

### Acceptance Criteria

- **NFR-013-01**: TestRef definitions (TEST-020~025) exist in design/test-refs.ts for each CLI test file [test]
- **NFR-013-02**: TestRefs are linked to corresponding command IDs via implementsCommand [test]
- **NFR-013-03**: speckeeper check test succeeds for all TestRefs [test]
- **NFR-013-04**: speckeeper check test --coverage achieves 100% for target acceptance criteria [test]

---

## NFR-014: CLI Definition-Implementation Consistency

**Type**: non-functional | **Priority**: must | **Category**: testability

CLI command definitions in design/cli-commands.ts match actual implementation in src/cli/index.ts

### Rationale

To ensure specification and implementation stay synchronized (e.g., no missing --config parameters)

### Acceptance Criteria

- **NFR-014-01**: All command definitions in design/cli-commands.ts match implementation (parameters, subcommands, exit codes) [test]

---

## NFR-015: CLI Backward Compatibility

**Type**: non-functional | **Priority**: must | **Category**: testability

Existing public APIs and CLI behavior are not changed by test additions

### Rationale

To ensure test strengthening does not introduce regressions

### Acceptance Criteria

- **NFR-015-01**: All existing tests continue to pass (no regression) [test]
- **NFR-015-02**: No changes to existing public API or CLI behavior [review]