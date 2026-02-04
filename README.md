# spects

[![npm version](https://badge.fury.io/js/spects.svg)](https://www.npmjs.com/package/spects)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

**TypeScript-first specification validation framework** — validate design consistency and external SSOT integrity with full traceability.

## Why spects?

Requirements and design documents often drift from implementation. **spects** treats specifications as **code** — type-safe, version-controlled, and continuously validated against your actual artifacts (OpenAPI, DDL, IaC, tests).

```
design/*.ts  ──────►  Validation & Consistency Checks
    │
    ├─► spects lint    → Design integrity (IDs, references, phase gates)
    ├─► spects check   → External SSOT validation (OpenAPI, DDL, etc.)
    └─► spects impact  → Change impact analysis with traceability
```

## Features

- **TypeScript as SSOT** — Define requirements, architecture, and design in type-safe TypeScript
- **Design validation** — Lint rules for ID uniqueness, reference integrity, circular dependencies, and phase gates
- **External SSOT validation** — Check consistency with OpenAPI, DDL, Terraform, test files, and more
- **Traceability** — Track relationships across model levels (L0-L3) with impact analysis
- **Custom models** — Extend with domain-specific models (Runbooks, Policies, etc.)
- **CI-ready** — Built-in lint, drift detection, and coverage checks

## Installation

```bash
npm install spects
```

## Quick Start

### 1. Initialize project

```bash
npx spects init
```

This creates:
- `spects.config.ts` — Configuration file
- `design/_models/` — Model definitions (Requirement, UseCase, Term, Entity, Component)
- `design/requirements.ts` — Sample specification file

### 2. Define your specifications

Edit files in `design/` to add your specifications:

```typescript
// design/requirements.ts
import type { Requirement } from 'spects';

export const requirements: Requirement[] = [
  {
    id: 'FR-001',
    name: 'User Authentication',
    type: 'functional',
    description: 'Users can authenticate using email and password',
    priority: 'high',
    acceptanceCriteria: [
      { id: 'FR-001-01', description: 'Valid credentials grant access' },
      { id: 'FR-001-02', description: 'Invalid credentials show error' },
    ],
  },
];
```

### 3. Run validation

```bash
# Validate design integrity
npx spects lint

# Check external SSOT consistency  
npx spects check

# Analyze change impact
npx spects impact FR-001
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `spects init` | Initialize a new project with starter templates |
| `spects lint` | Validate design integrity (ID uniqueness, references, phase gates) |
| `spects check` | Verify consistency with external SSOT (OpenAPI, DDL, etc.) |
| `spects check --coverage` | Verify cross-model coverage (e.g., TestRef → Requirements) |
| `spects drift` | Detect manual edits to generated files |
| `spects impact <id>` | Analyze change impact for a specific element |

## Validation Features

### Design Integrity (lint)

- **ID uniqueness** — No duplicate IDs within model types
- **ID conventions** — Enforce naming patterns (e.g., `FR-001`, `COMP-AUTH`)
- **Reference integrity** — All referenced IDs must exist
- **Circular dependency detection** — Prevent reference loops
- **Phase gates** — Ensure TBD items are resolved by target phase
- **Custom lint rules** — Define model-specific validation

### External SSOT Validation (check)

Validate your specifications against actual implementation artifacts:

```typescript
// design/api-refs.ts
export const apiRefs: APIRef[] = [
  {
    id: 'API-001',
    operationId: 'createUser',
    source: { path: './openapi.yaml' },
    relatedComponent: 'COMP-AUTH',
  },
];
```

```bash
# Validates operationId exists in OpenAPI spec
npx spects check --model api-ref
```

Built-in checks:
- **Test files** — Validate requirement coverage in tests

Custom checkers can be implemented via `externalChecker` in model definitions to validate against any external source (OpenAPI, DDL, IaC, etc.).

## Model Levels & Traceability

spects organizes models by abstraction level:

| Level | Focus | Examples |
|-------|-------|----------|
| **L0** | Business + Domain (Why) | UseCase, Actor, Term |
| **L1** | Requirements (What) | Requirement, Constraint |
| **L2** | Design (How) | Component, Entity, Layer |
| **L3** | Implementation (Build) | Screen, APIRef, TableRef |

Relations between models enable **impact analysis**:

```bash
$ npx spects impact FR-001

FR-001 (Requirement)
├── implements: COMP-AUTH (Component)
├── satisfies: UC-001 (UseCase)
└── verifies: TEST-001 (TestRef)
```

## Customizing Models

The starter templates provide basic models. You can customize them or add new domain-specific models:

```typescript
import { z } from 'zod';
import { Model } from 'spects';

const RunbookSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  steps: z.array(z.object({
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
}
```

## Documentation

- [Model Definition Guide](./docs/model-guide.md)
- [Framework Requirements Specification](./docs/framework_requirements_spec.md)
- [Model Entity Catalog](./docs/model_entity_catalog.md)

## Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.0

## License

MIT
