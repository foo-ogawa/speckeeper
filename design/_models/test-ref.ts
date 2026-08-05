/**
 * Test Reference Model Definition
 *
 * Manages the association between test code and requirements/CLI commands.
 * Checks test code existence and requirement ID mentions as external SSOT verification.
 */
import { z } from 'zod';
import { Model, RelationSchema } from '../../src/core/model.ts';
import type { LintRule, Exporter, ExternalChecker, CheckResult, CoverageChecker, CoverageResult, ModelLevel } from '../../src/core/model.ts';
import { arrayMinLength, idFormat, verifyTests } from '../../src/core/dsl/index.ts';
import { REQUIREMENT_MODEL_IDS } from './requirement.ts';

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

      const verified = verifyTests({
        path: spec.source.path,
        specIds: spec.verifiesRequirements,
        testCasePatterns: spec.testCasePatterns,
        resultPath: spec.source.resultPath,
      });

      if (verified.files.length === 0) {
        errors.push({
          message: `Test file(s) not found: ${spec.source.path}`,
          specId: spec.id,
          field: 'source.path',
        });
        return { success: false, errors, warnings };
      }

      for (const reqId of verified.unmentionedSpecIds) {
        warnings.push({
          message: `Requirement '${reqId}' not mentioned in test file(s)`,
          specId: spec.id,
          field: 'verifiesRequirements',
        });
      }

      for (const pattern of verified.unmatchedPatterns) {
        errors.push({
          message: `Test case pattern not matched for '${pattern.acceptanceCriteriaId}': ${pattern.pattern}`,
          specId: spec.id,
          field: 'testCasePatterns',
        });
      }

      if (verified.results && !verified.results.found) {
        warnings.push({
          message: `Test result file not readable: ${spec.source.resultPath}`,
          specId: spec.id,
          field: 'source.resultPath',
        });
      } else if (verified.results) {
        for (const reqId of verified.results.failed) {
          errors.push({
            message: `Test for requirement '${reqId}' failed`,
            specId: spec.id,
            field: 'verifiesRequirements',
          });
        }
        for (const reqId of verified.results.notFound) {
          warnings.push({
            message: `No test result found for requirement '${reqId}'`,
            specId: spec.id,
            field: 'verifiesRequirements',
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
