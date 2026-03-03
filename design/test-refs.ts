/**
 * speckeeper Test References - Test Reference Definitions
 *
 * Defines associations between test files and acceptance criteria.
 * verifiesRequirements and relations are auto-derived from testCasePatterns.acceptanceCriteriaId.
 * speckeeper check test verifies test file existence and acceptance criteria ID mentions.
 */
import type { TestRef, TestCasePattern } from './_models/test-ref.ts';
import { TestRefModel } from './_models/test-ref.ts';
import { defineSpecs } from '../src/core/model';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract requirement ID from acceptance criteria ID
 * Example: FR-101-01 -> FR-101
 */
function extractRequirementId(acceptanceCriteriaId: string): string {
  const match = acceptanceCriteriaId.match(/^([A-Z]+-\d+)-\d+$/);
  return match ? match[1] : acceptanceCriteriaId;
}

/**
 * Auto-generate verifiesRequirements from testCasePatterns
 */
function deriveVerifiesRequirements(patterns: TestCasePattern[]): string[] {
  const reqIds = new Set<string>();
  for (const p of patterns) {
    reqIds.add(extractRequirementId(p.acceptanceCriteriaId));
  }
  return Array.from(reqIds);
}

/**
 * Auto-generate relations from testCasePatterns
 */
function deriveRelations(patterns: TestCasePattern[], implementsCommand?: string) {
  const relations: Array<{ type: 'verifies'; target: string; description: string }> = [];
  const seenReqs = new Set<string>();

  for (const p of patterns) {
    const reqId = extractRequirementId(p.acceptanceCriteriaId);
    if (!seenReqs.has(reqId)) {
      seenReqs.add(reqId);
      relations.push({
        type: 'verifies',
        target: reqId,
        description: `Verifies acceptance criteria for ${reqId}`,
      });
    }
  }

  if (implementsCommand) {
    relations.push({
      type: 'verifies',
      target: implementsCommand,
      description: `Verifies ${implementsCommand}`,
    });
  }

  return relations;
}

// ============================================================================
// Test Case Pattern Definitions
// ============================================================================

const configLoaderTestPatterns: TestCasePattern[] = [
  // CR-002-01: Zero-config startup
  {
    acceptanceCriteriaId: 'CR-002-01',
    pattern: 'default config|no config file',
    description: 'Default config test',
  },
];

const fileWriterTestPatterns: TestCasePattern[] = [
  // FR-300: File output
  {
    acceptanceCriteriaId: 'FR-300-01',
    pattern: 'write.*file|file.*writ',
    description: 'File output test',
  },
];

// Model level test patterns
const modelLevelTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-104-08', pattern: 'FR-104-08.*modelLevel configuration', description: 'modelLevel setting test' },
  { acceptanceCriteriaId: 'FR-104-09', pattern: 'FR-104-09.*level.*property', description: 'level property retrieval test' },
];

// Init command test patterns
const initTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-105-01', pattern: 'FR-105-01.*creates design/', description: 'Design directory creation test' },
  { acceptanceCriteriaId: 'FR-105-02', pattern: 'FR-105-02.*speckeeper.config.ts', description: 'Config file generation test' },
  { acceptanceCriteriaId: 'FR-105-03', pattern: 'FR-105-03.*package.json', description: 'Package.json generation test' },
  { acceptanceCriteriaId: 'FR-105-04', pattern: 'FR-105-04.*tsconfig.json', description: 'tsconfig.json generation test' },
  { acceptanceCriteriaId: 'FR-105-05', pattern: 'FR-105-05.*model definitions', description: 'Model definitions generation test' },
  { acceptanceCriteriaId: 'FR-105-06', pattern: 'FR-105-06.*sample specification', description: 'Sample specification generation test' },
  { acceptanceCriteriaId: 'FR-105-07', pattern: 'FR-105-07.*speckeeper lint', description: 'Generated project lint test' },
  { acceptanceCriteriaId: 'FR-105-08', pattern: 'FR-105-08.*typecheck', description: 'Generated project typecheck test' },
  { acceptanceCriteriaId: 'FR-105-09', pattern: 'FR-105-09.*--force', description: 'Force overwrite test' },
  { acceptanceCriteriaId: 'FR-105-10', pattern: 'FR-105-10.*skips package.json', description: 'Skip existing package.json test' },
];

// ============================================================================
// Test Reference List
// ============================================================================

export const testRefs: TestRef[] = [
  // ---------------------------------------------------------------------------
  // TEST-003: Config Loader utility test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-003',
    description: 'Config file loading utility verification test',
    source: {
      path: 'test/utils/config-loader.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(configLoaderTestPatterns),
    testCasePatterns: configLoaderTestPatterns,
    relations: deriveRelations(configLoaderTestPatterns),
  },

  // ---------------------------------------------------------------------------
  // TEST-004: File Writer utility test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-004',
    description: 'File writing utility verification test',
    source: {
      path: 'test/utils/file-writer.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(fileWriterTestPatterns),
    testCasePatterns: fileWriterTestPatterns,
    relations: deriveRelations(fileWriterTestPatterns),
  },

  // ---------------------------------------------------------------------------
  // TEST-018: Model Level test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-018',
    description: 'Model level configuration feature verification test',
    source: {
      path: 'test/core/model-level.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(modelLevelTestPatterns),
    testCasePatterns: modelLevelTestPatterns,
    relations: deriveRelations(modelLevelTestPatterns),
  },

  // ---------------------------------------------------------------------------
  // TEST-019: Init command test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-019',
    description: 'Project initialization feature verification test',
    source: {
      path: 'test/cli/init.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(initTestPatterns),
    implementsCommand: 'CMD-INIT',
    testCasePatterns: initTestPatterns,
    relations: deriveRelations(initTestPatterns, 'CMD-INIT'),
  },
];

export default defineSpecs(
  [TestRefModel.instance, testRefs],
);
