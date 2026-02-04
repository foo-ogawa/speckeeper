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

### APIRef Model (with External SSOT Checker)

<!--@embedoc:code_snippet file="design/_models/api-ref.ts" lang="typescript" title="design/_models/api-ref.ts" no_source="true"-->
⚠️ File not found: design/_models/api-ref.ts
<!--@embedoc:end-->

### Model Registration (design/_models/index.ts)

After adding a model, register it in the `allModels` array in `design/_models/index.ts`:

<!--@embedoc:code_snippet file="design/_models/index.ts" start="77" end="127" lang="typescript" title="design/_models/index.ts (excerpt)" no_source="true"-->
**design/_models/index.ts (excerpt)**

```typescript

```
<!--@embedoc:end-->

---

## Model Base Class

All models extend the `Model` base class from `src/core/model.ts`.

### Type Definitions

<!--@embedoc:code_snippet file="src/core/model.ts" start="24" end="107" lang="typescript" title="src/core/model.ts (Type Definitions)" no_source="true"-->
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
  outputDir?: string;
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
}

/**
 * Coverage result
 */
export interface CoverageResult {
  /** Total target count */
  total: number;
  /** Covered count */
  covered: number;
  /** Uncovered count */
  uncovered: number;
  /** Coverage rate (%) */
  coveragePercent: number;
  /** Details of covered items */
  coveredItems: { id: string; description?: string }[];
  /** Details of uncovered items */
  uncoveredItems: { id: string; description?: string; sourceId?: string }[];
}

/**
 * Coverage checker definition
 * 
 * Verify cross-model consistency (coverage).
 * Example: Whether TestRef covers acceptanceCriteria of Requirement
 */
export interface CoverageChecker<T> {
  /** Target model ID for coverage (e.g. 'requirement') */
  targetModel: string;
  /** Description of coverage check */
  description: string;
  /** Execute coverage check */
  check: (
    specs: T[],
    registry: Record<string, Map<string, unknown>>
  ) => CoverageResult;
}
```
<!--@embedoc:end-->

### Model Class

<!--@embedoc:code_snippet file="src/core/model.ts" start="109" end="156" lang="typescript" title="src/core/model.ts (Model Class Properties)" no_source="true"-->
**src/core/model.ts (Model Class Properties)**

```typescript
// ============================================================================
// Renderer (for embeds)
// ============================================================================

/**
 * Render context
 * Simplified version compatible with embedoc's EmbedContext
 */
export interface RenderContext {
  /** Parameters (filter conditions other than format, etc.) */
  params: Record<string, string | undefined>;
  /** Markdown helpers */
  markdown: {
    /** Generate table */
    table: (headers: string[], rows: (string | unknown)[][]) => string;
  };
}

/**
 * Renderer definition
 * 
 * Model-specific rendering called from embeds
 */
export interface Renderer<T> {
  /** Format ID ('table', 'list', 'detail', 'spec-chapter', etc.) */
  format: string;
  /** Rendering process */
  render: (specs: T[], ctx: RenderContext) => string;
}

// ============================================================================
// Model Base Class
// ============================================================================

/**
 * Model base class
 * 
 * @template TSchema - Zod schema type
 */
export abstract class Model<TSchema extends ZodType> {
  /** Singleton instance storage (per subclass) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static _instances: WeakMap<new () => any, Model<ZodType>> = new WeakMap();

  /**
   * Get singleton instance of the model
   * Usage: RequirementModel.instance
   */
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
| `implements` | L3→L1 | Implements a requirement |
| `satisfies` | L1→L0 | Satisfies a use case |
| `refines` | Same level or lower | Refinement |
| `verifies` | L3→L1 | Test verifies a requirement |
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
    {
      id: 'test-has-requirements',
      severity: 'error',
      message: 'TestRef must verify at least one requirement',
      check: (spec) => !spec.verifiesRequirements || spec.verifiesRequirements.length === 0,
    },
    {
      id: 'test-has-source',
      severity: 'error',
      message: 'TestRef must have a test source path',
      check: (spec) => !spec.source?.path,
    },
    {
      id: 'test-id-format',
      severity: 'warning',
      message: 'TestRef ID should follow naming convention (e.g., TEST-001)',
      check: (spec) => !/^TEST-\d{3}$/.test(spec.id),
    },
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
      single: (spec) => {
        const lines: string[] = [];
        lines.push(`# ${spec.id}: ${spec.description}`);
        lines.push('');
        lines.push('## Test Source');
        lines.push('');
        lines.push(`- **Path**: \`${spec.source.path}\``);
        lines.push(`- **Framework**: ${spec.source.framework}`);
        if (spec.source.resultPath) {
          lines.push(`- **Result JSON**: \`${spec.source.resultPath}\``);
        }
        lines.push('');

        lines.push('## Verified Requirements');
        lines.push('');
        for (const reqId of spec.verifiesRequirements) {
          lines.push(`- ${reqId}`);
        }
        lines.push('');

        if (spec.implementsCommand) {
          lines.push('## Implemented Command');
          lines.push('');
          lines.push(`- ${spec.implementsCommand}`);
          lines.push('');
        }

        if (spec.testCasePatterns && spec.testCasePatterns.length > 0) {
          lines.push('## Test Case Patterns');
          lines.push('');
          lines.push('| Acceptance Criteria ID | Pattern | Description |');
          lines.push('|------------------------|---------|-------------|');
          for (const p of spec.testCasePatterns) {
            lines.push(`| ${p.acceptanceCriteriaId} | \`${p.pattern}\` | ${p.description || '-'} |`);
          }
          lines.push('');
        }

        return lines.join('\n');
      },
      index: (specs) => {
        const lines: string[] = [];
        lines.push('# Test Reference List');
        lines.push('');
        lines.push('| ID | Description | Framework | Requirements Count |');
        lines.push('|----|-------------|-----------|-------------------|');
        for (const spec of specs) {
          lines.push(
            `| [${spec.id}](./${spec.id}.md) | ${spec.description} | ${spec.source.framework} | ${spec.verifiesRequirements.length} |`,
          );
        }
        return lines.join('\n');
      },
      outputDir: 'test-refs',
      filename: (spec) => spec.id,
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
      // 1. Extract acceptanceCriteria with verificationMethod: 'test' from requirement model
      const requirements = registry.requirements;
      if (!requirements) {
        return {
          total: 0,
          covered: 0,
          uncovered: 0,
          coveragePercent: 100,
          coveredItems: [],
          uncoveredItems: [],
        };
      }

      interface AcceptanceCriteriaSpec {
        id: string;
        description: string;
        verificationMethod?: string;
      }

      interface RequirementSpec {
        id: string;
        acceptanceCriteria?: AcceptanceCriteriaSpec[];
      }

      const testableACs: Array<{ id: string; description: string; sourceId: string }> = [];
      for (const req of requirements.values() as IterableIterator<RequirementSpec>) {
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
