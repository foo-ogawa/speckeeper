# Model Definition Guide

In the speckeeper model system, you define project-specific models by extending the `Model` base class. All models under `design/_models/` (Requirement, Entity, Component, etc.) are defined within the project.

## Overview

Defining a model enables the following capabilities:

- Define project-specific spec entities (Requirement, Entity, UseCase, RetryPolicy, Runbook, etc.)
- Type-safe validation with Zod schemas
- Validation through custom lint rules
- Automatic documentation generation (Markdown, Mermaid diagrams)
- Consistency checking with external SSOT (OpenAPI, DDL, etc.)
- Traceability through model relations

## Architecture

The speckeeper model system is designed with the following structure:

```
┌─────────────────────────────────────────────────────────────────┐
│ Model (Model Class): design/_models/                            │
│ = Defines the "type" of specifications                          │
│                                                                  │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│ │ RequirementModel│  │ UseCaseModel    │  │ EntityModel     │  │
│ │ - schema        │  │ - schema        │  │ - schema        │  │
│ │ - lintRules     │  │ - lintRules     │  │ - lintRules     │  │
│ │ - exporters     │  │ - exporters     │  │ - exporters     │  │
│ │ - modelLevel    │  │ - modelLevel    │  │ - modelLevel    │  │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Spec (Spec Instance): design/                                   │
│ = Concrete specification data based on models                   │
│                                                                  │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│ │ FR-001          │  │ UC-001          │  │ E-001           │  │
│ │ FR-002          │  │ UC-002          │  │ E-010           │  │
│ │ ...             │  │ ...             │  │ ...             │  │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Model Definition Examples

Below are examples of models actually defined in the speckeeper project.

### CLICommand Model (with External SSOT Checker)

<!--@embedoc:code_snippet file="design/_models/cli-command.ts" start="300" end="419" lang="typescript" title="design/_models/cli-command.ts (excerpt)" no_source="true"-->
**design/_models/cli-command.ts (excerpt)**

```typescript
class CLICommandModel extends Model<typeof CLICommandSchema> {
  readonly id = 'cli-command';
  readonly name = 'CLICommand';
  readonly idPrefix = 'CMD';
  readonly schema = CLICommandSchema;
  readonly description = 'Defines CLI command specifications';
  protected modelLevel: ModelLevel = 'L3';

  protected lintRules: LintRule<CLICommand>[] = [
    {
      id: 'cmd-has-description',
      severity: 'error',
      message: 'Command must have a description (min 5 chars)',
      check: (spec) => !spec.description || spec.description.length < 5,
    },
    arrayMinLength<CLICommand>('examples', 1, 'warning'),
    {
      id: 'cmd-has-exit-codes',
      severity: 'info',
      message: 'Command should define exit codes',
      check: (spec) => spec.exitCodes.length === 0,
    },
  ];

  protected exporters: Exporter<CLICommand>[] = [
    {
      format: 'markdown',
      index: (specs) => {
        const lines: string[] = [];
        lines.push('# CLI Commands');
        lines.push('');
        lines.push('| Command | Description |');
        lines.push('|---------|-------------|');
        for (const spec of specs) {
          lines.push(`| ${spec.name} | ${spec.description} |`);
        }
        lines.push('');
        lines.push('---');
        lines.push('');

        for (const spec of specs) {
          lines.push(`## ${spec.id}: ${spec.name}`);
          lines.push('');
          lines.push(spec.description);
          lines.push('');

          lines.push('### Usage');
          lines.push('');
          lines.push('```bash');
          if (spec.subCommands.length > 0) {
            lines.push(`speckeeper ${spec.name} <subcommand> [options]`);
          } else {
            lines.push(`speckeeper ${spec.name} [options]`);
          }
          lines.push('```');
          lines.push('');

          if (spec.parameters.length > 0) {
            lines.push('### Parameters');
            lines.push('');
            lines.push('| Name | Kind | Type | Required | Default | Description |');
            lines.push('|------|------|------|----------|---------|-------------|');
            for (const p of spec.parameters) {
              const alias = p.alias ? `-${p.alias}, ` : '';
              const flag = p.kind === 'option' ? `${alias}--${p.name}` : `<${p.name}>`;
              const req = p.required ? '✓' : '';
              const def = p.default !== undefined ? String(p.default) : '-';
              const type = p.choices?.length ? `${p.type} (${p.choices.join(', ')})` : p.type;
              lines.push(`| ${flag} | ${p.kind} | ${type} | ${req} | ${def} | ${p.description} |`);
            }
            lines.push('');
          }

          if (spec.subCommands.length > 0) {
            lines.push('### Subcommands');
            lines.push('');
            for (const sub of spec.subCommands) {
              lines.push(`#### ${sub.name}`);
              lines.push('');
              lines.push(sub.description);
              lines.push('');
            }
          }

          if (spec.examples.length > 0) {
            lines.push('### Examples');
            lines.push('');
            lines.push('```bash');
            lines.push(spec.examples.join('\n'));
            lines.push('```');
            lines.push('');
          }

          if (spec.exitCodes.length > 0) {
            lines.push('### Exit Codes');
            lines.push('');
            lines.push('| Code | Description |');
            lines.push('|------|-------------|');
            for (const ec of spec.exitCodes) {
              lines.push(`| ${ec.code} | ${ec.description} |`);
            }
            lines.push('');
          }

          lines.push('---');
          lines.push('');
        }

        return lines.join('\n').replace(/\n---\n\n$/s, '\n');
      },
      outputFile: 'design/cli-commands.md',
    },
  ];

  protected externalChecker: ExternalChecker<CLICommand> = {
    targetType: 'typescript',
    sourcePath: () => PROGRAM_PATH,
    check: (spec): CheckResult =>
      checkCLICommand(spec, parseCommanderCLI(join(process.cwd(), PROGRAM_PATH))),
  };
```
<!--@embedoc:end-->

### Model Registration (design/_models/index.ts)

After adding a model, register it in the `allModels` array in `design/_models/index.ts`:

<!--@embedoc:code_snippet file="design/_models/index.ts" start="63" end="81" lang="typescript" title="design/_models/index.ts (excerpt)" no_source="true"-->
**design/_models/index.ts (excerpt)**

```typescript
export const allModels = [
  FunctionalRequirementModel.instance,
  NonFunctionalRequirementModel.instance,
  ConstraintModel.instance,
  UseCaseModel.instance,
  ActorModel.instance,
  TermModel.instance,
  EntityModel.instance,
  ActorComponentModel.instance,
  ExternalSystemModel.instance,
  ContainerModel.instance,
  BoundaryModel.instance,
  LayerModel.instance,
  RelationModel.instance,
  ArtifactModel.instance,
  DirectoryEntryModel.instance,
  CLICommandModel.instance,
  TestRefModel.instance,
];
```
<!--@embedoc:end-->

---

## Model Base Class

All models extend the `Model` base class from `src/core/model.ts`.

### Type Definitions

<!--@embedoc:code_snippet file="src/core/model.ts" start="27" end="84" lang="typescript" title="src/core/model.ts (Type Definitions)" no_source="true"-->
**src/core/model.ts (Type Definitions)**

```typescript
/**
 * Lint rule definition
 */
export interface LintRule<T> {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  check: (spec: T) => boolean; // true if there is an issue
}

/**
 * Lint result
 */
export interface LintResult {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  specId?: string;
}

/**
 * Exporter definition
 */
export interface Exporter<T> {
  format: 'markdown' | 'json' | 'mermaid';
  single?: (spec: T) => string;
  index?: (specs: T[]) => string;
  /** Subdirectory under docsDir (used with single + index/index.md) */
  outputDir?: string;
  /** Direct output file path relative to docsDir (used with index-only exporters) */
  outputFile?: string;
  filename?: (spec: T) => string;
}

/**
 * External checker definition
 */
export interface ExternalChecker<T> {
  targetType: string; // 'openapi' | 'ddl' | 'cli' etc.
  sourcePath: (spec: T) => string;
  check: (spec: T, externalData: unknown) => CheckResult;
}

/**
 * Check result
 */
export interface CheckResult {
  success: boolean;
  errors: { message: string; field?: string; specId?: string }[];
  warnings: { message: string; field?: string; specId?: string }[];
  /** Files where annotations matching this spec were found */
  matchedFiles?: Array<{
    specId: string;
    filePath: string;
    line: number;
    relationType: 'verifiedBy' | 'implements' | 'traces';
  }>;
}
```
<!--@embedoc:end-->

### Model Class

<!--@embedoc:code_snippet file="src/core/model.ts" start="228" end="272" lang="typescript" title="src/core/model.ts (Model Class Properties)" no_source="true"-->
**src/core/model.ts (Model Class Properties)**

```typescript
  /** Model ID ('requirement', 'usecase', etc.) */
  abstract readonly id: string;
  
  /** Model name ('Requirement', 'UseCase', etc.) */
  abstract readonly name: string;
  
  /** ID prefix ('REQ', 'UC', etc.) */
  abstract readonly idPrefix: string;
  
  /** Zod schema */
  abstract readonly schema: TSchema;
  
  /** Model description (optional) */
  readonly description?: string;
  
  /** External SSOT type (optional, e.g. 'OpenAPI', 'DDL/Prisma') */
  readonly externalSsotType?: string;
  
  /** Spec instance type */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get specType(): z.infer<TSchema> { return undefined as any; }
  
  /** Lint rules (override in subclass) */
  protected lintRules: LintRule<z.infer<TSchema>>[] = [];
  
  /** Exporters (override in subclass) */
  protected exporters: Exporter<z.infer<TSchema>>[] = [];
  
  /** External checker (optional) — deprecated, use deepValidation instead */
  protected externalChecker?: ExternalChecker<z.infer<TSchema>>;
  
  /** Deep validation rules keyed by source type (replaces externalChecker) */
  protected deepValidation?: DeepValidationConfig<z.infer<TSchema>>;
  
  /** Lookup key overrides per source type (when spec ID differs from external identifier) */
  protected lookupKeys?: LookupKeyConfig<z.infer<TSchema>>;
  
  /** Coverage checker (optional) */
  protected coverageChecker?: CoverageChecker<z.infer<TSchema>>;
  
  /** Model level (set in _models/) */
  protected modelLevel?: ModelLevel;
  
  /** Renderers (for embeds, override in subclass) */
  protected renderers: Renderer<z.infer<TSchema>>[] = [];
```
<!--@embedoc:end-->

### Model Level (ModelLevel)

Defines the abstraction level of a model:

| Level | Name | Description | Examples |
|-------|------|-------------|----------|
| `L0` | Business + Domain | Why / Problem space | UseCase, Actor, Term |
| `L1` | Requirements | What | Requirement, Constraint |
| `L2` | Design | How / Strategy | Component, Entity, Layer |
| `L3` | Detailed Design / Implementation | How to build | Screen, APIRef, TableRef |

### Relation Types

| Type | Direction Constraint | Description |
|------|----------------------|-------------|
| `implements` | spec→external | Spec is implemented as external artifact (OpenAPI, DDL) |
| `satisfies` | L1→L0 | Satisfies a use case |
| `refines` | Same level or lower | Refinement |
| `verifiedBy` | spec→test | Spec is verified by external test code |
| `verifies` | test→implementation | Test verifies implementation code (external, no checker generated) |
| `dependsOn` | None | Dependency |
| `relatedTo` | None | Association |

---

## Other Model Examples

### TestRef Model (with Coverage Checker)

An example implementing both an external SSOT checker and a coverage checker:

<!--@embedoc:code_snippet file="design/_models/test-ref.ts" lang="typescript" title="design/_models/test-ref.ts" no_source="true"-->
**design/_models/test-ref.ts**

```typescript
/**
 * Test Reference Model Definition
 *
 * Manages the association between test code and requirements/CLI commands.
 * Checks test code existence and requirement ID mentions as external SSOT verification.
 */
import { z } from 'zod';
import { Model, RelationSchema } from '../../src/core/model.ts';
import type { LintRule, Exporter, ExternalChecker, CheckResult, CoverageChecker, CoverageResult, ModelLevel } from '../../src/core/model.ts';
import { arrayMinLength, idFormat } from '../../src/core/dsl/index.ts';
import { REQUIREMENT_MODEL_IDS } from './requirement.ts';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';

// ============================================================================
// Schema Definition
// ============================================================================

/**
 * Test case pattern - Association between acceptance criteria ID and test case
 */
export const TestCasePatternSchema = z.object({
  /** Related acceptance criteria ID (e.g., FR-101-01) */
  acceptanceCriteriaId: z.string(),
  /** Test case name pattern (regex) */
  pattern: z.string(),
  /** Description (optional, can be derived from acceptance criteria) */
  description: z.string().optional(),
});

/**
 * Test source information
 */
export const TestSourceSchema = z.object({
  /** Test file path (glob pattern allowed) */
  path: z.string(),
  /** Test framework */
  framework: z.enum(['vitest', 'jest', 'mocha', 'playwright', 'cypress']),
  /** Test result JSON path (optional) */
  resultPath: z.string().optional(),
});

/**
 * TestRef Schema
 */
export const TestRefSchema = z.object({
  /** Unique ID */
  id: z.string(),
  /** Test suite description */
  description: z.string(),
  /** Test source */
  source: TestSourceSchema,
  /** Array of requirement IDs this test verifies */
  verifiesRequirements: z.array(z.string()).min(1),
  /** CLI command ID this test implements (optional) */
  implementsCommand: z.string().optional(),
  /** Association between requirement IDs and test case patterns */
  testCasePatterns: z.array(TestCasePatternSchema).optional(),
  /** Inter-model relation */
  relations: z.array(RelationSchema).optional(),
});

// ============================================================================
// Type Export
// ============================================================================

export type TestCasePattern = z.infer<typeof TestCasePatternSchema>;
export type TestSource = z.infer<typeof TestSourceSchema>;
export type TestRef = z.input<typeof TestRefSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check requirement ID mentions in test file content
 */
function checkRequirementMentions(
  filePath: string,
  requirementIds: string[],
): { found: string[]; missing: string[] } {
  const found: string[] = [];
  const missing: string[] = [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const reqId of requirementIds) {
      // Check if requirement ID is mentioned in describe, it, or test
      const patterns = [
        new RegExp(`describe\\s*\\(\\s*['"\`].*${reqId}`, 'm'),
        new RegExp(`it\\s*\\(\\s*['"\`].*${reqId}`, 'm'),
        new RegExp(`test\\s*\\(\\s*['"\`].*${reqId}`, 'm'),
      ];
      const mentioned = patterns.some((p) => p.test(content));
      if (mentioned) {
        found.push(reqId);
      } else {
        missing.push(reqId);
      }
    }
  } catch {
    // Treat all file read errors as missing
    missing.push(...requirementIds);
  }

  return { found, missing };
}

/**
 * Check test case pattern matches
 */
function checkTestCasePatterns(
  filePath: string,
  patterns: TestCasePattern[],
): { matched: TestCasePattern[]; unmatched: TestCasePattern[] } {
  const matched: TestCasePattern[] = [];
  const unmatched: TestCasePattern[] = [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const p of patterns) {
      const regex = new RegExp(p.pattern, 'm');
      if (regex.test(content)) {
        matched.push(p);
      } else {
        unmatched.push(p);
      }
    }
  } catch {
    unmatched.push(...patterns);
  }

  return { matched, unmatched };
}

/**
 * Load and validate test result JSON
 */
interface VitestResult {
  success: boolean;
  testResults: Array<{
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    assertionResults: Array<{
      fullName: string;
      status: 'passed' | 'failed' | 'skipped';
    }>;
  }>;
}

function checkTestResults(
  resultPath: string,
  requirementIds: string[],
): { passed: string[]; failed: string[]; notFound: string[] } {
  const passed: string[] = [];
  const failed: string[] = [];
  const notFound: string[] = [];

  try {
    const content = readFileSync(resultPath, 'utf-8');
    const results: VitestResult = JSON.parse(content);

    for (const reqId of requirementIds) {
      let foundTest = false;
      let allPassed = true;

      for (const testResult of results.testResults) {
        // Check if requirement ID is in test name or assertion name
        if (testResult.name.includes(reqId)) {
          foundTest = true;
          if (testResult.status !== 'passed') {
            allPassed = false;
          }
        }
        for (const assertion of testResult.assertionResults) {
          if (assertion.fullName.includes(reqId)) {
            foundTest = true;
            if (assertion.status !== 'passed') {
              allPassed = false;
            }
          }
        }
      }

      if (!foundTest) {
        notFound.push(reqId);
      } else if (allPassed) {
        passed.push(reqId);
      } else {
        failed.push(reqId);
      }
    }
  } catch {
    notFound.push(...requirementIds);
  }

  return { passed, failed, notFound };
}

// ============================================================================
// Model Class
// ============================================================================

class TestRefModel extends Model<typeof TestRefSchema> {
  readonly id = 'test-ref';
  readonly name = 'TestRef';
  readonly idPrefix = 'TEST';
  readonly schema = TestRefSchema;
  readonly description = 'Test reference (association between test code and requirements)';
  readonly externalSsotType = 'Test Code';
  protected modelLevel: ModelLevel = 'L3';

  protected lintRules: LintRule<TestRef>[] = [
    arrayMinLength<TestRef>('verifiesRequirements', 1),
    {
      id: 'test-has-source',
      severity: 'error',
      message: 'TestRef must have a test source path',
      check: (spec) => !spec.source?.path,
    },
    idFormat<TestRef>('TEST'),
    {
      id: 'test-has-patterns',
      severity: 'info',
      message: 'TestRef should have test case patterns for specific requirement verification',
      check: (spec) => !spec.testCasePatterns || spec.testCasePatterns.length === 0,
    },
  ];

  protected exporters: Exporter<TestRef>[] = [
    {
      format: 'markdown',
      index: (specs) => {
        const lines: string[] = [];
        lines.push('# Test Reference List');
        lines.push('');
        lines.push('| ID | Description | Framework | Requirements Count |');
        lines.push('|----|-------------|-----------|-------------------|');
        for (const spec of specs) {
          lines.push(
            `| ${spec.id} | ${spec.description} | ${spec.source.framework} | ${spec.verifiesRequirements.length} |`,
          );
        }
        lines.push('');
        lines.push('---');
        lines.push('');

        for (const spec of specs) {
          lines.push(`## ${spec.id}: ${spec.description}`);
          lines.push('');
          lines.push('### Test Source');
          lines.push('');
          lines.push(`- **Path**: \`${spec.source.path}\``);
          lines.push(`- **Framework**: ${spec.source.framework}`);
          if (spec.source.resultPath) {
            lines.push(`- **Result JSON**: \`${spec.source.resultPath}\``);
          }
          lines.push('');

          lines.push('### Verified Requirements');
          lines.push('');
          for (const reqId of spec.verifiesRequirements) {
            lines.push(`- ${reqId}`);
          }
          lines.push('');

          if (spec.implementsCommand) {
            lines.push('### Implemented Command');
            lines.push('');
            lines.push(`- ${spec.implementsCommand}`);
            lines.push('');
          }

          if (spec.testCasePatterns && spec.testCasePatterns.length > 0) {
            lines.push('### Test Case Patterns');
            lines.push('');
            lines.push('| Acceptance Criteria ID | Pattern | Description |');
            lines.push('|------------------------|---------|-------------|');
            for (const p of spec.testCasePatterns) {
              lines.push(`| ${p.acceptanceCriteriaId} | \`${p.pattern}\` | ${p.description || '-'} |`);
            }
            lines.push('');
          }

          lines.push('---');
          lines.push('');
        }

        return lines.join('\n').replace(/\n---\n\n$/s, '\n');
      },
      outputFile: 'design/test-refs.md',
    },
  ];

  protected externalChecker: ExternalChecker<TestRef> = {
    targetType: 'test',
    sourcePath: (spec) => spec.source.path,
    check: (spec): CheckResult => {
      const errors: CheckResult['errors'] = [];
      const warnings: CheckResult['warnings'] = [];
      const basePath = process.cwd();

      // 1. Check test file existence
      const pattern = spec.source.path;
      const testFiles = glob.sync(pattern, { cwd: basePath });

      if (testFiles.length === 0) {
        errors.push({
          message: `Test file(s) not found: ${pattern}`,
          specId: spec.id,
          field: 'source.path',
        });
        return { success: false, errors, warnings };
      }

      // 2. Check requirement ID mentions in each test file
      const allMissing = new Set<string>(spec.verifiesRequirements);

      for (const testFile of testFiles) {
        const fullPath = join(basePath, testFile);
        const { found } = checkRequirementMentions(fullPath, spec.verifiesRequirements);
        for (const id of found) {
          allMissing.delete(id);
        }
      }

      if (allMissing.size > 0) {
        for (const reqId of allMissing) {
          warnings.push({
            message: `Requirement '${reqId}' not mentioned in test file(s)`,
            specId: spec.id,
            field: 'verifiesRequirements',
          });
        }
      }

      // 3. Check test case pattern matches
      if (spec.testCasePatterns && spec.testCasePatterns.length > 0) {
        const allUnmatched = new Map<string, TestCasePattern>();
        for (const p of spec.testCasePatterns) {
          allUnmatched.set(p.acceptanceCriteriaId, p);
        }

        for (const testFile of testFiles) {
          const fullPath = join(basePath, testFile);
          const { matched } = checkTestCasePatterns(fullPath, spec.testCasePatterns);
          for (const p of matched) {
            allUnmatched.delete(p.acceptanceCriteriaId);
          }
        }

        for (const [, pattern] of allUnmatched) {
          errors.push({
            message: `Test case pattern not matched for '${pattern.acceptanceCriteriaId}': ${pattern.pattern}`,
            specId: spec.id,
            field: 'testCasePatterns',
          });
        }
      }

      // 4. Check test results (when resultPath is specified)
      if (spec.source.resultPath) {
        const resultFullPath = join(basePath, spec.source.resultPath);
        if (existsSync(resultFullPath)) {
          const { failed, notFound } = checkTestResults(resultFullPath, spec.verifiesRequirements);

          for (const reqId of failed) {
            errors.push({
              message: `Test for requirement '${reqId}' failed`,
              specId: spec.id,
              field: 'verifiesRequirements',
            });
          }

          for (const reqId of notFound) {
            warnings.push({
              message: `No test result found for requirement '${reqId}'`,
              specId: spec.id,
              field: 'verifiesRequirements',
            });
          }
        } else {
          warnings.push({
            message: `Test result file not found: ${spec.source.resultPath}`,
            specId: spec.id,
            field: 'source.resultPath',
          });
        }
      }

      return {
        success: errors.length === 0,
        errors,
        warnings,
      };
    },
  };

  /**
   * Coverage Checker
   * 
   * Verifies that Requirement acceptanceCriteria (verificationMethod: 'test')
   * are covered by TestRef.testCasePatterns.
   * 
   * Note: verificationMethod is a property defined in design/_models/requirement.ts
   */
  protected coverageChecker: CoverageChecker<TestRef> = {
    targetModel: 'requirement',
    description: 'TestRef coverage verification for acceptanceCriteria (verificationMethod: test)',
    check: (specs, registry): CoverageResult => {
      interface AcceptanceCriteriaSpec {
        id: string;
        description: string;
        verificationMethod?: string;
      }

      interface RequirementSpec {
        id: string;
        acceptanceCriteria?: AcceptanceCriteriaSpec[];
      }

      // 1. Extract acceptanceCriteria with verificationMethod: 'test' from every
      //    registered requirement model. A model missing from the registry is a
      //    misconfiguration, not full coverage.
      const requirements: RequirementSpec[] = [];
      for (const modelId of REQUIREMENT_MODEL_IDS) {
        const registered = registry[modelId];
        if (!registered) {
          throw new Error(
            `TestRef coverage check requires the '${modelId}' model in the registry`,
          );
        }
        requirements.push(...(registered.values() as IterableIterator<RequirementSpec>));
      }

      const testableACs: Array<{ id: string; description: string; sourceId: string }> = [];
      for (const req of requirements) {
        if (!req.acceptanceCriteria) continue;
        for (const ac of req.acceptanceCriteria) {
          // design/ specific: only target verificationMethod: 'test'
          if (ac.verificationMethod === 'test') {
            testableACs.push({
              id: ac.id,
              description: ac.description,
              sourceId: req.id,
            });
          }
        }
      }

      // 2. Collect acceptanceCriteriaId from TestRef.testCasePatterns
      const coveredACIds = new Set<string>();
      for (const ref of specs) {
        if (!ref.testCasePatterns) continue;
        for (const pattern of ref.testCasePatterns) {
          coveredACIds.add(pattern.acceptanceCriteriaId);
        }
      }

      // 3. Determine coverage
      const coveredItems: CoverageResult['coveredItems'] = [];
      const uncoveredItems: CoverageResult['uncoveredItems'] = [];

      for (const ac of testableACs) {
        if (coveredACIds.has(ac.id)) {
          coveredItems.push({ id: ac.id, description: ac.description });
        } else {
          uncoveredItems.push({ id: ac.id, description: ac.description, sourceId: ac.sourceId });
        }
      }

      const total = testableACs.length;
      const covered = coveredItems.length;
      const uncovered = uncoveredItems.length;
      const coveragePercent = total > 0 ? Math.round((covered / total) * 100) : 100;

      return {
        total,
        covered,
        uncovered,
        coveragePercent,
        coveredItems,
        uncoveredItems,
      };
    },
  };
}

// Singleton instance
export { TestRefModel };

```
<!--@embedoc:end-->

---

## Notes

1. **ID Uniqueness**: Ensure the model's `id` does not duplicate other models
2. **Schema Validation**: Strict Zod schema definitions are recommended
3. **Model Level**: Set `modelLevel` appropriately to enable relation constraint validation
4. **Lint Rule Severity**: `error` requires a fix, `warning` is recommended, `info` is informational
5. **File Placement**: Model classes go in `design/_models/`, spec instances go in `design/`
6. **Model Registration**: Add to the `allModels` array in `design/_models/index.ts` to make it available in CLI and embedoc
