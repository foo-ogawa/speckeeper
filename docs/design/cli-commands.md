# CLI Commands

| Command | Description |
|---------|-------------|
| build | Generate human-readable (docs/) and machine-readable (specs/) artifacts from TS models |
| lint | Validate TS model consistency and integrity |
| drift | Detect differences between generated docs/specs/ and committed files |
| check | Check consistency with external SSOT (OpenAPI/DDL/IaC) |
| init | Initialize a new speckeeper project with starter templates |
| new | Create a new element with auto-generated ID |
| scaffold | Generate _models/ from a mermaid flowchart definition |
| impact | Analyze the change impact scope of a specified ID |

---

## CMD-BUILD: build

Generate human-readable (docs/) and machine-readable (specs/) artifacts from TS models

### Usage

```bash
speckeeper build [options]
```

### Parameters

| Name | Kind | Type | Required | Default | Description |
|------|------|------|----------|---------|-------------|
| -c, --config | option | path |  | - | Path to config file |
| -o, --output | option | path |  | . | Output directory base path |
| -f, --format | option | enum |  | both | Output format |
| -w, --watch | option | boolean |  | false | Watch file changes and auto-regenerate |
| -v, --verbose | option | boolean |  | false | Show detailed output |

### Examples

```bash
speckeeper build
speckeeper build --output ./dist
speckeeper build --format markdown
speckeeper build --watch
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Generation error |

---

## CMD-LINT: lint

Validate TS model consistency and integrity

### Usage

```bash
speckeeper lint [options]
```

### Parameters

| Name | Kind | Type | Required | Default | Description |
|------|------|------|----------|---------|-------------|
| -c, --config | option | path |  | - | Path to config file |
| -p, --phase | option | enum |  | - | Phase gate (prohibit TBD at specified phase) |
| -s, --strict | option | boolean |  | false | Strict mode (treat warnings as errors) |
| --fix | option | boolean |  | false | Fix auto-fixable issues |
| -f, --format | option | enum |  | text | Output format |

### Examples

```bash
speckeeper lint
speckeeper lint --phase LLD
speckeeper lint --strict
speckeeper lint --format json
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | No issues |
| 1 | Errors found |
| 2 | Warnings found (in strict mode) |

---

## CMD-DRIFT: drift

Detect differences between generated docs/specs/ and committed files

### Usage

```bash
speckeeper drift [options]
```

### Parameters

| Name | Kind | Type | Required | Default | Description |
|------|------|------|----------|---------|-------------|
| -c, --config | option | path |  | - | Path to config file |
| -u, --update | option | boolean |  | false | Auto-update if differences exist |
| -f, --format | option | enum |  | text | Output format |

### Examples

```bash
speckeeper drift
speckeeper drift --update
speckeeper drift --format diff
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | No differences |
| 1 | Differences found (manual edits detected) |

---

## CMD-CHECK: check

Check consistency with external SSOT (OpenAPI/DDL/IaC)

### Usage

```bash
speckeeper check <subcommand> [options]
```

### Parameters

| Name | Kind | Type | Required | Default | Description |
|------|------|------|----------|---------|-------------|
| <type> | argument | string |  | - | Type of check: external-ssot, openapi, ddl, iac, custom, all, test |
| -c, --config | option | path |  | - | Path to config file |
| --strict | option | boolean |  | false | Treat warnings as errors |
| -v, --verbose | option | boolean |  | false | Show detailed output |
| --coverage | option | boolean |  | false | Check if all testable acceptance criteria are covered by TestRefs |

### Subcommands

#### openapi

Check consistency with OpenAPI specification

#### ddl

Check consistency with DDL/Schema

#### iac

Check consistency with IaC (CloudFormation/Terraform)

#### external-ssot

Check consistency with all external SSOTs

#### test

Check consistency between test files and requirements

#### contract

Check consistency between implementation and contract (type definitions/schema)

### Examples

```bash
speckeeper check openapi
speckeeper check ddl
speckeeper check iac
speckeeper check external-ssot
speckeeper check contract
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Consistency OK |
| 1 | Consistency error |
| 2 | External SSOT file not found |

---

## CMD-INIT: init

Initialize a new speckeeper project with starter templates

### Usage

```bash
speckeeper init [options]
```

### Parameters

| Name | Kind | Type | Required | Default | Description |
|------|------|------|----------|---------|-------------|
| -f, --force | option | boolean |  | false | Overwrite existing files |

### Examples

```bash
speckeeper init
speckeeper init --force
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Initialization successful |
| 1 | Initialization error |

---

## CMD-NEW: new

Create a new element with auto-generated ID

### Usage

```bash
speckeeper new [options]
```

### Parameters

| Name | Kind | Type | Required | Default | Description |
|------|------|------|----------|---------|-------------|
| <type> | argument | string | ✓ | - | Type: requirement, usecase, entity, component, screen, flow, error-case, term |
| -k, --kind | option | string |  | - | Sub-kind (e.g., functional, non-functional for requirements) |
| -n, --name | option | string |  | - | Name of the element |
| -o, --output | option | path |  | - | Output directory path |
| -t, --template | option | path |  | - | Path to template file |

### Examples

```bash
speckeeper new requirement --kind functional --name "User Login"
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Element created |
| 1 | Creation error |

---

## CMD-SCAFFOLD: scaffold

Generate _models/ from a mermaid flowchart definition

### Usage

```bash
speckeeper scaffold [options]
```

### Parameters

| Name | Kind | Type | Required | Default | Description |
|------|------|------|----------|---------|-------------|
| -s, --source | option | path | ✓ | - | Path to Markdown file containing mermaid flowchart |
| -o, --output | option | path |  | design/ | Output directory |
| -f, --force | option | boolean |  | false | Overwrite existing files |
| --dry-run | option | boolean |  | false | Preview generated files without writing |

### Examples

```bash
speckeeper scaffold --source requirements.md
speckeeper scaffold -s spec.md --dry-run
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Scaffold successful |
| 1 | Scaffold error |

---

## CMD-IMPACT: impact

Analyze the change impact scope of a specified ID

### Usage

```bash
speckeeper impact [options]
```

### Parameters

| Name | Kind | Type | Required | Default | Description |
|------|------|------|----------|---------|-------------|
| <id> | argument | string | ✓ | - | ID to analyze |
| -c, --config | option | path |  | - | Path to config file |
| -d, --depth | option | number |  | 3 | Analysis depth (reference tracking level) |
| --direction | option | enum |  | both | Analysis direction |
| -f, --format | option | enum |  | text | Output format |

### Examples

```bash
speckeeper impact REQ-001
speckeeper impact ENT-ORDER --depth 5
speckeeper impact COMP-API --direction downstream
speckeeper impact UC-001 --format mermaid
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Analysis successful |
| 1 | Target ID not found |

---
