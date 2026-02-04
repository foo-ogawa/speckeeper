# speckeeper

[![npm version](https://badge.fury.io/js/speckeeper.svg)](https://www.npmjs.com/package/speckeeper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)

**TypeScript-first specification validation framework** — validate design consistency and external SSOT integrity with full traceability.

## Why speckeeper?

Requirements and design documents often drift from implementation. **speckeeper** treats specifications as **code** — type-safe, version-controlled, and continuously validated against your actual artifacts (tests, OpenAPI, DDL, IaC).

```
design/*.ts  ──────►  Validation & Consistency Checks
    │
    ├─► speckeeper lint    → Design integrity (IDs, references, phase gates)
    ├─► speckeeper check   → External SSOT validation (test coverage, etc.)
    └─► speckeeper impact  → Change impact analysis with traceability
```

## Features

- **TypeScript as SSOT** — Define requirements, architecture, and design in type-safe TypeScript
- **Design validation** — Lint rules for ID uniqueness, reference integrity, circular dependencies, and phase gates
- **External SSOT validation** — Check consistency with test files, and custom checkers for OpenAPI, DDL, etc.
- **Traceability** — Track relationships across model levels (L0-L3) with impact analysis
- **Custom models** — Extend with domain-specific models (Runbooks, Policies, etc.)
- **CI-ready** — Built-in lint, drift detection, and coverage checks

## Installation

```bash
npm install speckeeper

# Verify installation
npx speckeeper --help
```

## Quick Start

### 1. Initialize project

```bash
npx speckeeper init
```

This creates:
- `speckeeper.config.ts` — Configuration file
- `design/_models/` — Model definitions (Requirement, UseCase, Term, Entity, Component)
- `design/requirements.ts` — Sample specification file

The generated `speckeeper.config.ts`:

```typescript
import { defineConfig } from 'speckeeper';
import { allModels } from './design/_models/index';

export default defineConfig({
  projectName: 'my-project',
  models: allModels,
});
```

See [Model Definition Guide](./docs/model-guide.md) for customization details.

### 2. Define your specifications

Edit files in `design/` to add your specifications:

```typescript
// design/requirements.ts
import type { Requirement } from 'speckeeper';

export const requirements: Requirement[] = [
  {
    id: 'FR-001',
    name: 'User Authentication',
    type: 'functional',
    description: 'Users can authenticate using email and password',
    priority: 'must',
    acceptanceCriteria: [
      { id: 'FR-001-01', description: 'Valid credentials grant access', verificationMethod: 'test' },
      { id: 'FR-001-02', description: 'Invalid credentials show error', verificationMethod: 'test' },
    ],
  },
];
```

### 3. Run validation

```bash
# Validate design integrity
npx speckeeper lint

# Check test coverage against requirements
npx speckeeper check test --coverage

# Analyze change impact
npx speckeeper impact FR-001
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `speckeeper init` | Initialize a new project with starter templates |
| `speckeeper lint` | Validate design integrity (ID uniqueness, references, phase gates) |
| `speckeeper check` | Verify consistency with external SSOT |
| `speckeeper check test --coverage` | Verify test coverage for requirements |
| `speckeeper drift` | Detect manual edits to generated `specs/` files |
| `speckeeper impact <id>` | Analyze change impact for a specific element |

**Note**: `speckeeper build` generates machine-readable `specs/` output. For human-readable docs (`docs/`), use [embedoc](https://www.npmjs.com/package/embedoc) or similar tools with the model rendering API.

## Validation Features

### Design Integrity (lint)

```bash
$ npx speckeeper lint

speckeeper lint

  Design: design/
  Loaded: 17 files

  Running lint checks...

  ✓ No issues found
```

Checks include:
- **ID uniqueness** — No duplicate IDs within model types
- **ID conventions** — Enforce naming patterns (e.g., `FR-001`, `COMP-AUTH`)
- **Reference integrity** — All referenced IDs must exist
- **Circular dependency detection** — Prevent reference loops
- **Phase gates** — Ensure TBD items are resolved by target phase
- **Custom lint rules** — Define model-specific validation

### External SSOT Validation (check)

Validate your specifications against actual implementation artifacts.

**Built-in: Test Coverage Check**

Define test references that link to your requirements:

```typescript
// design/test-refs.ts
import type { TestRef } from 'speckeeper';

export const testRefs: TestRef[] = [
  {
    id: 'TEST-001',
    description: 'Authentication tests',
    source: { path: 'test/auth.test.ts', framework: 'vitest' },
    verifiesRequirements: ['FR-001'],
    testCasePatterns: [
      { acceptanceCriteriaId: 'FR-001-01', pattern: 'valid credentials' },
      { acceptanceCriteriaId: 'FR-001-02', pattern: 'invalid credentials' },
    ],
  },
];
```

```bash
$ npx speckeeper check test --coverage

speckeeper check

  Design: design/
  Type:   test

  ✓ All checks passed

  Coverage: TestRef → Requirement
    Coverage: 100% (34/34 acceptance criteria covered)
```

**Custom Checkers**

Implement `externalChecker` in model definitions to validate against any external source (OpenAPI, DDL, IaC, etc.). See [Model Definition Guide](./docs/model-guide.md) for details.

## Model Levels & Traceability

speckeeper organizes models by abstraction level:

| Level | Focus | Examples |
|-------|-------|----------|
| **L0** | Business + Domain (Why) | UseCase, Actor, Term |
| **L1** | Requirements (What) | Requirement, Constraint |
| **L2** | Design (How) | Component, Entity, Layer |
| **L3** | Implementation (Build) | Screen, APIRef, TableRef |

Relations between models enable **impact analysis**:

```bash
$ npx speckeeper impact FR-001

FR-001 (Requirement)
├── implements: COMP-AUTH (Component)
├── satisfies: UC-001 (UseCase)
└── verifies: TEST-001 (TestRef)
```

See [Model Entity Catalog](./docs/model_entity_catalog.md) for relation types and level constraints.

## Customizing Models

The starter templates provide basic models. You can customize them or add new domain-specific models:

```typescript
import { z } from 'zod';
import { Model } from 'speckeeper';

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

- **[Model Definition Guide](./docs/model-guide.md)** — Start here for model customization and API reference
- [Framework Requirements Specification](./docs/framework_requirements_spec.md) — Detailed feature specifications
- [Model Entity Catalog](./docs/model_entity_catalog.md) — Model hierarchy and relation types

## Compatibility

- Node.js >= 20.0.0
- TypeScript >= 5.0

## Contributing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Lint
npm run lint
npm run lint:design

# Full CI check
npm run ci
```

## License

MIT
