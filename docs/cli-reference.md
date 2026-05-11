# speckeeper CLI

TypeScript-first specification validation framework — validate design consistency, external SSOT integrity, and traceability with type-safe TypeScript DSL. Supports design lint, external source checks (OpenAPI, DDL, annotations), drift detection, impact analysis, and scaffolding from Mermaid flowcharts.

**Version:** 0.9.4

## Table of Contents

- [speckeeper](#speckeeper)
  - [init](#speckeeper-init)
  - [build](#speckeeper-build)
  - [lint](#speckeeper-lint)
  - [drift](#speckeeper-drift)
  - [check](#speckeeper-check)
  - [new](#speckeeper-new)
  - [impact](#speckeeper-impact)
  - [scaffold](#speckeeper-scaffold)
  - [audit-requirements](#speckeeper-audit-requirements)
  - [propose-trace-links](#speckeeper-propose-trace-links)
  - [explain-impact](#speckeeper-explain-impact)
  - [propose-acceptance-criteria](#speckeeper-propose-acceptance-criteria)

---

## speckeeper

Requirements and design management framework with TypeScript DSL.

### Global Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--version` | -V | No |  | Print version and exit. |
| `--help` | -h | No |  | Show help and exit. |

### init

Initialize a new speckeeper project with starter templates.

Copies starter template files (speckeeper.config.ts, design/ directory structure) into the current project. Provides a minimal working setup with generic models and example specs.

**Usage:**

```
speckeeper init
```
```
speckeeper init --force
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--force` | -f | No | `false` | Overwrite existing files. |

#### Exit Codes

**Exit 0:** Project initialized successfully.

- **stdout:** format=`text`

**Exit 1:** Initialization failed (files already exist without --force).

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  riskLevel: medium
  requiresConfirmation: false
  idempotent: false
  sideEffects: 
    - file_write
  safeDryRunOption: Omit --force to fail safely when files already exist.
```

---

### build

Generate docs/ and specs/ from TypeScript models.

Loads the design TypeScript models and generates machine-readable specs/ output and optionally human-readable docs/ output. Supports markdown, JSON, or both formats. Can watch for file changes and auto-regenerate.

**Usage:**

```
speckeeper build
```
```
speckeeper build --format json --output ./out
```
```
speckeeper build --watch --verbose
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--output` | -o | No | `"."` | Base output directory path. |
| `--format` | -f | No | `"both"` | Output format: markdown, json, both. |
| `--watch` | -w | No | `false` | Watch for changes and auto-regenerate. |
| `--verbose` | -v | No | `false` | Show detailed output. |

#### Exit Codes

**Exit 0:** Build completed successfully.

- **stdout:** format=`text`

**Exit 1:** Build failed (config error, model loading error, or generation error).

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  riskLevel: low
  requiresConfirmation: false
  idempotent: true
  sideEffects: 
    - file_write
  sideEffectNote: When --watch is used, the process runs indefinitely and is unsuitable for non-interactive agent invocation.
  safeDryRunOption: Omit --watch for a single-pass build.
```

---

### lint

Check design integrity (ID duplicates, references, layer violations, etc.).

Validates design models for structural integrity. Checks include ID uniqueness, ID naming conventions, reference integrity, circular dependency detection, phase gate enforcement, and custom model-specific lint rules. Optionally auto-fixes issues.

**Usage:**

```
speckeeper lint
```
```
speckeeper lint --strict --format github
```
```
speckeeper lint --phase HLD --fix
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--phase` | -p | No |  | Phase gate to check against: REQ, HLD, LLD, OPS. |
| `--strict` | -s | No | `false` | Treat warnings as errors. |
| `--fix` |  | No | `false` | Attempt to fix auto-fixable issues. |
| `--format` | -f | No | `"text"` | Output format: text, json, github. |

#### Exit Codes

**Exit 0:** No lint issues found (or all issues auto-fixed).

- **stdout:** format=`{options.format}`

**Exit 1:** Lint issues found (errors or warnings with --strict).

- **stdout:** format=`{options.format}`

#### Extensions

```yaml
x-agent: 
  riskLevel: low
  requiresConfirmation: false
  idempotent: true
  sideEffects: 
    - file_write
  sideEffectNote: file_write applies only when --fix is provided. Without --fix the command is read-only.
  safeDryRunOption: Omit --fix to run in read-only mode.
```

---

### drift

Check if generated files have been manually edited.

Compares generated files against their expected content to detect manual edits (drift). Useful for CI pipelines to ensure generated docs/ files stay in sync with model definitions. Can auto-update drifted files.

**Usage:**

```
speckeeper drift
```
```
speckeeper drift --fail-on-drift
```
```
speckeeper drift --update --format diff
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--update` | -u | No | `false` | Auto-update if differences are found. |
| `--format` | -f | No | `"text"` | Output format: text, json, diff. |
| `--fail-on-drift` |  | No | `false` | Exit with code 1 if drift is detected (for CI). |

#### Exit Codes

**Exit 0:** No drift detected (or drift auto-updated with --update).

- **stdout:** format=`{options.format}`

**Exit 1:** Drift detected (with --fail-on-drift), or update failed.

- **stdout:** format=`{options.format}`

#### Extensions

```yaml
x-agent: 
  riskLevel: medium
  requiresConfirmation: false
  idempotent: true
  sideEffects: 
    - file_write
  sideEffectNote: file_write applies only when --update is provided. Without --update the command is read-only.
  safeDryRunOption: Omit --update to run in read-only mode.
```

---

### check

Check external SSOT conformance (including custom models).

Validates specifications against actual implementation artifacts using a global source scan. Performs existence checks (is the spec ID found in configured sources?), optional structural checks (via deep validation), and optional type checks. Sources include OpenAPI, DDL, annotations, and custom scanners. Supports filtering by check type and test coverage reporting.

**Usage:**

```
speckeeper check
```
```
speckeeper check external-ssot --verbose
```
```
speckeeper check test --coverage
```
```
speckeeper check openapi --strict
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `type` | No | Type of check to run. Filters sources by type. When omitted, checks all configured sources. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--strict` |  | No | `false` | Treat warnings as errors. |
| `--verbose` | -v | No | `false` | Show detailed output (e.g. list unmatched specs). |
| `--coverage` |  | No | `false` | Check if all testable acceptance criteria are covered by TestRefs. |

#### Exit Codes

**Exit 0:** All checks passed (all specs found in sources, deep validation passed).

- **stdout:** format=`text`

**Exit 1:** Check failures found (missing specs, structural mismatches, or coverage gaps).

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  riskLevel: low
  requiresConfirmation: false
  idempotent: true
  sideEffects: 

```

---

### new

Create a new element with auto-generated ID.

Generates a new design element file with a unique auto-generated ID based on the model's ID prefix and existing elements. Supports all built-in model types and uses templates for file generation.

**Usage:**

```
speckeeper new requirement --name "User Authentication"
```
```
speckeeper new entity --kind functional
```
```
speckeeper new usecase --template custom-template.ts
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `type` | Yes | Element type to create: requirement, usecase, entity, component, screen, flow, error-case, term. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--kind` | -k | No |  | Sub-kind (e.g. functional, non-functional for requirements). |
| `--name` | -n | No |  | Name of the element. |
| `--output` | -o | No |  | Output directory path. |
| `--template` | -t | No |  | Path to template file. |
| `--dry-run` |  | No | `false` | Preview generated file content and ID without writing to disk. |

#### Exit Codes

**Exit 0:** Element file created (or previewed with --dry-run) with auto-generated ID.

- **stdout:** format=`text`

**Exit 1:** Creation failed (invalid type, template error, or write error).

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  riskLevel: low
  requiresConfirmation: false
  idempotent: false
  sideEffects: 
    - file_write
  safeDryRunOption: --dry-run
```

---

### impact

Analyze impact of changes to an ID.

Performs change impact analysis by traversing the relation graph starting from the specified spec ID. Shows upstream (dependants) and/or downstream (dependencies) elements up to the configured depth. Supports text, JSON, and Mermaid diagram output.

**Usage:**

```
speckeeper impact FR-001
```
```
speckeeper impact ENT-ORDER --direction upstream --depth 5
```
```
speckeeper impact COMP-AUTH --format mermaid
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `id` | Yes | Spec ID to analyze (e.g. REQ-001, ENT-ORDER, COMP-AUTH). |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--depth` | -d | No | `3` | Analysis depth (reference tracking level). |
| `--direction` |  | No | `"both"` | Analysis direction: upstream, downstream, both. |
| `--format` | -f | No | `"text"` | Output format: text, json, mermaid. |

#### Exit Codes

**Exit 0:** Impact analysis completed and displayed.

- **stdout:** format=`{options.format}`

**Exit 1:** Analysis failed (ID not found or config error).

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  riskLevel: low
  requiresConfirmation: false
  idempotent: true
  sideEffects: 

```

---

### scaffold

Generate _models/ from a Mermaid flowchart definition.

Parses a Mermaid flowchart from a Markdown file and generates TypeScript model classes, spec data files, and an index file in the design directory. Uses class-based artifact resolution to determine model types from Mermaid node classes.

**Usage:**

```
speckeeper scaffold --source requirements.md
```
```
speckeeper scaffold --source flow.md --output design/ --force
```
```
speckeeper scaffold --source arch.md --dry-run
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--source` | -s | Yes |  | Path to Markdown file containing Mermaid flowchart. |
| `--output` | -o | No | `"design/"` | Output directory. |
| `--force` | -f | No | `false` | Overwrite existing files. |
| `--dry-run` |  | No | `false` | Preview generated files without writing. |

#### Exit Codes

**Exit 0:** Model files generated (or previewed with --dry-run) successfully.

- **stdout:** format=`text`

**Exit 1:** Scaffold failed (source file not found, invalid Mermaid syntax, or write error).

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  riskLevel: medium
  requiresConfirmation: false
  idempotent: false
  sideEffects: 
    - file_write
  sideEffectNote: --force overwrites existing TypeScript model source files.
  safeDryRunOption: --dry-run
```

---

### audit-requirements

Run LLM-based requirement quality audit.

Performs semantic analysis of design specs using LLM to identify quality issues that static lint cannot detect. Evaluates verifiability, ambiguity, granularity, terminology consistency, and design-mixing. Requires agent-contracts-runtime as an optional peer dependency.

**Usage:**

```
speckeeper audit-requirements
```
```
speckeeper audit-requirements --adapter gemini --dry-run
```
```
speckeeper audit-requirements --report-format json --output audit.json
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--adapter` | -a | No |  | SDK adapter to use for LLM execution. |
| `--model` |  | No |  | LLM model override. |
| `--dry-run` | -n | No | `false` | Output the constructed prompt without calling LLM. |
| `--show-prompt` |  | No | `false` | Display the constructed LLM prompt on stderr. |
| `--fail-on` |  | No | `"error"` | Minimum severity that causes a non-zero exit. |
| `--output` | -o | No |  | Write result to a file instead of stdout. |
| `--report-format` |  | No | `"json"` | Output format for the audit report. |

#### Exit Codes

**Exit 0:** Audit completed, no blocking findings.

- **stdout:** format=`{options.report-format}`

**Exit 1:** Unexpected error.

- **stderr:** format=`text`

**Exit 2:** Configuration or input error.

- **stderr:** format=`text`

**Exit 10:** Completed with blocking findings.

- **stdout:** format=`{options.report-format}`

**Exit 11:** Runtime dependency missing (agent-contracts-runtime).

- **stderr:** format=`text`

**Exit 12:** LLM provider or adapter error.

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  riskLevel: low
  requiresConfirmation: false
  idempotent: true
  sideEffects: 
    - network
    - file_write
  sideEffectNote: Network calls to LLM provider when adapter is not mock. Filesystem write when --output is specified.
  safeDryRunOption: --dry-run
  expectedDurationMs: 120000
  retryableExitCodes: 
    - 12
```

---

### propose-trace-links

LLM-based traceability link proposal.

Analyzes spec definitions and external source scan results to propose candidate traceability links between specs and implementation artifacts. Each link includes a confidence score and rationale.

**Usage:**

```
speckeeper propose-trace-links
```
```
speckeeper propose-trace-links --adapter claude --report-format json
```
```
speckeeper propose-trace-links --dry-run
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--adapter` | -a | No |  | SDK adapter to use for LLM execution. |
| `--model` |  | No |  | LLM model override. |
| `--dry-run` | -n | No | `false` | Output the constructed prompt without calling LLM. |
| `--show-prompt` |  | No | `false` | Display the constructed LLM prompt on stderr. |
| `--fail-on` |  | No | `"error"` | Minimum severity that causes a non-zero exit. |
| `--output` | -o | No |  | Write result to a file instead of stdout. |
| `--report-format` |  | No | `"json"` | Output format for the report. |

#### Exit Codes

**Exit 0:** Proposal completed, no blocking findings.

- **stdout:** format=`{options.report-format}`

**Exit 1:** Unexpected error.

- **stderr:** format=`text`

**Exit 2:** Configuration or input error.

- **stderr:** format=`text`

**Exit 10:** Completed with blocking findings.

- **stdout:** format=`{options.report-format}`

**Exit 11:** Runtime dependency missing (agent-contracts-runtime).

- **stderr:** format=`text`

**Exit 12:** LLM provider or adapter error.

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  riskLevel: low
  requiresConfirmation: false
  idempotent: true
  sideEffects: 
    - network
    - file_write
  sideEffectNote: Network calls to LLM provider when adapter is not mock. Filesystem write when --output is specified.
  safeDryRunOption: --dry-run
  expectedDurationMs: 120000
  retryableExitCodes: 
    - 12
```

---

### explain-impact

LLM-based explanation of impact analysis output.

Reads JSON output from speckeeper impact on stdin and generates a human-readable explanation suitable for PM/executive audiences. Includes affected artifact categorization, test considerations, and release risk assessment.

**Usage:**

```
speckeeper impact FR-001 --format json | speckeeper explain-impact
```
```
speckeeper impact ENT-ORDER --format json | speckeeper explain-impact --adapter claude
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--adapter` | -a | No |  | SDK adapter to use for LLM execution. |
| `--model` |  | No |  | LLM model override. |
| `--dry-run` | -n | No | `false` | Output the constructed prompt without calling LLM. |
| `--show-prompt` |  | No | `false` | Display the constructed LLM prompt on stderr. |
| `--fail-on` |  | No | `"error"` | Minimum severity that causes a non-zero exit. |
| `--output` | -o | No |  | Write result to a file instead of stdout. |
| `--report-format` |  | No | `"json"` | Output format for the report. |

#### Exit Codes

**Exit 0:** Explanation completed successfully.

- **stdout:** format=`{options.report-format}`

**Exit 1:** Unexpected error.

- **stderr:** format=`text`

**Exit 2:** Configuration or input error.

- **stderr:** format=`text`

**Exit 3:** No input on stdin.

- **stderr:** format=`text`

**Exit 10:** Completed with blocking findings.

- **stdout:** format=`{options.report-format}`

**Exit 11:** Runtime dependency missing (agent-contracts-runtime).

- **stderr:** format=`text`

**Exit 12:** LLM provider or adapter error.

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  riskLevel: low
  requiresConfirmation: false
  idempotent: true
  sideEffects: 
    - network
    - file_write
  sideEffectNote: Network calls to LLM provider when adapter is not mock. Filesystem write when --output is specified.
  safeDryRunOption: --dry-run
  expectedDurationMs: 120000
  retryableExitCodes: 
    - 12
```

---

### propose-acceptance-criteria

LLM-based acceptance criteria proposal.

Analyzes design specs and proposes testable acceptance criteria for each target spec. Optionally takes spec IDs as arguments to scope the proposal. Criteria are proposed in Given/When/Then or verification format.

**Usage:**

```
speckeeper propose-acceptance-criteria
```
```
speckeeper propose-acceptance-criteria FR-001 FR-002
```
```
speckeeper propose-acceptance-criteria --adapter gemini --dry-run
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `specIds` *(variadic)* | No | Spec IDs to propose criteria for. Defaults to all specs if omitted. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--adapter` | -a | No |  | SDK adapter to use for LLM execution. |
| `--model` |  | No |  | LLM model override. |
| `--dry-run` | -n | No | `false` | Output the constructed prompt without calling LLM. |
| `--show-prompt` |  | No | `false` | Display the constructed LLM prompt on stderr. |
| `--fail-on` |  | No | `"error"` | Minimum severity that causes a non-zero exit. |
| `--output` | -o | No |  | Write result to a file instead of stdout. |
| `--report-format` |  | No | `"json"` | Output format for the report. |

#### Exit Codes

**Exit 0:** Proposal completed, no blocking findings.

- **stdout:** format=`{options.report-format}`

**Exit 1:** Unexpected error.

- **stderr:** format=`text`

**Exit 2:** Configuration or input error.

- **stderr:** format=`text`

**Exit 10:** Completed with blocking findings.

- **stdout:** format=`{options.report-format}`

**Exit 11:** Runtime dependency missing (agent-contracts-runtime).

- **stderr:** format=`text`

**Exit 12:** LLM provider or adapter error.

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  riskLevel: low
  requiresConfirmation: false
  idempotent: true
  sideEffects: 
    - network
    - file_write
  sideEffectNote: Network calls to LLM provider when adapter is not mock. Filesystem write when --output is specified.
  safeDryRunOption: --dry-run
  expectedDurationMs: 120000
  retryableExitCodes: 
    - 12
```

---
