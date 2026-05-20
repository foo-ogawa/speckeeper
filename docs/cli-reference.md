# speckeeper CLI

TypeScript-first specification validation framework — validate design consistency, external SSOT integrity, and traceability with type-safe TypeScript DSL. Supports design lint, external source checks (OpenAPI, DDL, annotations), drift detection, impact analysis, and scaffolding from Mermaid flowcharts.

**Version:** 0.13.0

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
  - [convert](#speckeeper-convert)
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

### Environment Variables

| Variable | Description |
|---|---|
| `CURSOR_API_KEY` | API key for Cursor SDK adapter. |
| `GEMINI_API_KEY` | API key for Gemini adapter. |
| `OPENAI_API_KEY` | API key for OpenAI adapter. |
| `ANTHROPIC_API_KEY` | API key for Anthropic/Claude adapter. |

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
```
speckeeper init --format yaml
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--force` | -F | No | `false` | Overwrite existing files. |
| `--format` |  | No | `"ts"` | Spec data format: ts (default) or yaml. |

#### Exit Codes

**Exit 0:** Project initialized successfully.

- **stdout:** format=`text`

**Exit 1:** Initialization failed (files already exist without --force).

- **stderr:** format=`text`

---

### build

Generate docs/ and specs/ from TypeScript models.

Loads the design TypeScript models and generates machine-readable specs/ output and optionally human-readable docs/ output. Supports markdown, JSON, or both formats.

**Usage:**

```
speckeeper build
```
```
speckeeper build --format json --output ./out
```
```
speckeeper build --verbose
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

---

### lint

Check design integrity (ID duplicates, references, layer violations, etc.).

Validates design models for structural integrity. Checks include ID uniqueness, ID naming conventions, reference integrity, circular dependency detection, phase gate enforcement, and custom model-specific lint rules.

**Usage:**

```
speckeeper lint
```
```
speckeeper lint --strict --format github
```
```
speckeeper lint --phase HLD
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--phase` | -p | No |  | Phase gate to check against: REQ, HLD, LLD, OPS. |
| `--strict` | -s | No | `false` | Treat warnings as errors. |
| `--fix` |  | No | `false` | Attempt to fix auto-fixable issues (not yet implemented). |
| `--format` | -f | No | `"text"` | Output format: text, json, github. |

#### Exit Codes

**Exit 0:** No lint issues found.

- **stdout:** format=`{options.format}`

**Exit 1:** Lint issues found (errors or warnings with --strict).

- **stdout:** format=`{options.format}`

#### Extensions

```yaml
x-agent: 
  idempotent: true
```

---

### drift

Check if generated files have been manually edited.

Compares generated files against their expected content to detect manual edits (drift). Useful for CI pipelines to ensure generated docs/ files stay in sync with model definitions.

**Usage:**

```
speckeeper drift
```
```
speckeeper drift --fail-on-drift
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--update` | -u | No | `false` | Auto-update if differences are found (not yet implemented). |
| `--format` | -f | No | `"text"` | Output format: text, json, diff. |
| `--fail-on-drift` |  | No | `false` | Exit with code 1 if drift is detected (for CI). |

#### Exit Codes

**Exit 0:** No drift detected.

- **stdout:** format=`{options.format}`

**Exit 1:** Drift detected (with --fail-on-drift).

- **stdout:** format=`{options.format}`

#### Extensions

```yaml
x-agent: 
  idempotent: true
```

---

### check

Check external SSOT conformance (including custom models).

Validates specifications against actual implementation artifacts using a global source scan. Performs existence checks, optional structural checks (via deep validation), and optional type checks. Sources include OpenAPI, DDL, annotations, and custom scanners.

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

#### Arguments

| Name | Required | Description |
|---|---|---|
| `type` | No | Type of check to run. Filters sources by type. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--strict` |  | No | `false` | Treat warnings as errors. |
| `--verbose` | -v | No | `false` | Show detailed output. |
| `--coverage` |  | No | `false` | Check if all testable acceptance criteria are covered by TestRefs. |

#### Exit Codes

**Exit 0:** All checks passed.

- **stdout:** format=`text`

**Exit 1:** Check failures found.

- **stdout:** format=`text`

#### Extensions

```yaml
x-agent: 
  idempotent: true
```

---

### new

Create a new element with auto-generated ID.

Generates a new design element file with a unique auto-generated ID based on the model's ID prefix and existing elements.

**Usage:**

```
speckeeper new requirement --name "User Authentication"
```
```
speckeeper new entity
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `type` | Yes | Element type to create. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--kind` | -k | No |  | Sub-kind (e.g. functional, non-functional for requirements). |
| `--name` | -n | No |  | Name of the element. |
| `--output` | -o | No |  | Output directory path. |
| `--template` | -t | No |  | Path to template file. |
| `--dry-run` |  | No | `false` | Preview generated file content without writing. |

#### Exit Codes

**Exit 0:** Element file created (or previewed with --dry-run).

- **stdout:** format=`text`

**Exit 1:** Creation failed.

- **stderr:** format=`text`

---

### impact

Analyze impact of changes to an ID.

Performs change impact analysis by traversing the relation graph starting from the specified spec ID.

**Usage:**

```
speckeeper impact FR-001
```
```
speckeeper impact ENT-ORDER --depth 5
```
```
speckeeper impact COMP-AUTH --format mermaid
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `id` | Yes | Spec ID to analyze (e.g. REQ-001, ENT-ORDER). |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--depth` | -d | No | `3` | Analysis depth (reference tracking level). |
| `--direction` |  | No | `"both"` | Analysis direction: upstream, downstream, both. |
| `--format` | -f | No | `"text"` | Output format: text, json, mermaid. |

#### Exit Codes

**Exit 0:** Impact analysis completed.

- **stdout:** format=`{options.format}`

**Exit 1:** Analysis failed (ID not found or config error).

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  idempotent: true
```

---

### scaffold

Generate _models/ from a Mermaid flowchart definition.

Parses a Mermaid flowchart from a Markdown file and generates TypeScript model classes, spec data files, and an index file.

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
```
speckeeper scaffold --source arch.md --format yaml
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--source` | -s | Yes |  | Path to Markdown file containing Mermaid flowchart. |
| `--output` | -o | No | `"design/"` | Output directory. |
| `--force` | -F | No | `false` | Overwrite existing files. |
| `--dry-run` |  | No | `false` | Preview generated files without writing. |
| `--format` |  | No | `"ts"` | Spec data format: ts (default) or yaml. |

#### Exit Codes

**Exit 0:** Model files generated (or previewed with --dry-run).

- **stdout:** format=`text`

**Exit 1:** Scaffold failed.

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  recommended_before_use: 
    - Run with --dry-run first to preview generated files
```

---

### convert

Convert a TS spec data file to YAML format.

Reads a TypeScript spec data file that exports a SpecModule via defineSpecs(), extracts model IDs and spec data, and writes the equivalent YAML file. Supports --dry-run for preview.

**Usage:**

```
speckeeper convert design/glossary.ts
```
```
speckeeper convert design/requirements.ts --output reqs.yaml
```
```
speckeeper convert design/glossary.ts --dry-run
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `file` | Yes | Path to TS spec data file. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--output` | -o | No |  | Output file path (default: same name with .yaml extension). |
| `--dry-run` | -n | No | `false` | Preview conversion without writing. |

#### Exit Codes

**Exit 0:** Conversion completed (or previewed with --dry-run).

- **stdout:** format=`text`

**Exit 1:** Conversion failed (file not found, invalid module, or write error).

- **stderr:** format=`text`

---

### audit-requirements

Run LLM-based requirement quality audit.

Performs semantic analysis of design specs using LLM to identify quality issues that static lint cannot detect.

**Usage:**

```
speckeeper audit-requirements
```
```
speckeeper audit-requirements --adapter gemini --show-prompt
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
  recommended_before_use: 
    - Run with --show-prompt first to preview the prompt
  retryableExitCodes: 
    - 12
```

---

### propose-trace-links

LLM-based traceability link proposal.

Analyzes spec definitions and external source scan results to propose candidate traceability links.

**Usage:**

```
speckeeper propose-trace-links
```
```
speckeeper propose-trace-links --adapter claude --report-format json
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No |  | Path to config file. |
| `--adapter` | -a | No |  | SDK adapter to use for LLM execution. |
| `--model` |  | No |  | LLM model override. |
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
  recommended_before_use: 
    - Run with --show-prompt first to preview the prompt
  retryableExitCodes: 
    - 12
```

---

### explain-impact

LLM-based explanation of impact analysis output.

Reads JSON output from speckeeper impact on stdin and generates a human-readable explanation.

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
| `--adapter` | -a | No |  | SDK adapter to use for LLM execution. |
| `--model` |  | No |  | LLM model override. |
| `--fail-on` |  | No | `"error"` | Minimum severity that causes a non-zero exit. |
| `--output` | -o | No |  | Write result to a file instead of stdout. |
| `--report-format` |  | No | `"json"` | Output format for the report. |

#### Exit Codes

**Exit 0:** Explanation completed successfully.

- **stdout:** format=`{options.report-format}`

**Exit 1:** Unexpected error.

- **stderr:** format=`text`

**Exit 2:** No input on stdin.

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
  recommended_before_use: 
    - Run with --show-prompt first to preview the prompt
  retryableExitCodes: 
    - 12
```

---

### propose-acceptance-criteria

LLM-based acceptance criteria proposal.

Analyzes design specs and proposes testable acceptance criteria.

**Usage:**

```
speckeeper propose-acceptance-criteria
```
```
speckeeper propose-acceptance-criteria FR-001 FR-002
```
```
speckeeper propose-acceptance-criteria --adapter gemini --show-prompt
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
  recommended_before_use: 
    - Run with --show-prompt first to preview the prompt
  retryableExitCodes: 
    - 12
```

---
