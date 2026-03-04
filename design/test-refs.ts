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

// Lint command test patterns
const lintTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-401-01', pattern: 'FR-401-01.*lintAll.*exits.*code 1', description: 'Error-severity results trigger exit(1)' },
  { acceptanceCriteriaId: 'FR-401-03', pattern: 'FR-401-03.*exits.*code 1.*error message', description: 'Ref-exists error triggers exit and output' },
  { acceptanceCriteriaId: 'FR-402-01', pattern: 'FR-402-01.*lintAll.*outputs warning', description: 'Warnings output without exit' },
];

// Check command test patterns
const checkTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-602-01', pattern: 'FR-602-01.*check.*consistency', description: 'Check runs external SSOT check' },
  { acceptanceCriteriaId: 'FR-602-04', pattern: 'FR-602-04.*skips.*without external', description: 'Skips models without external source' },
  { acceptanceCriteriaId: 'FR-603-03', pattern: 'FR-603-03.*exits.*code 1.*outputs.*error', description: 'Outputs error/warning messages and exits' },
];

// Build command test patterns
const buildTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-300-01', pattern: 'FR-300-01.*exporter\\.single.*batchWriteFiles', description: 'Calls exporter and passes to batchWriteFiles' },
  { acceptanceCriteriaId: 'FR-301-05', pattern: 'FR-301-05.*exporter\\.single.*identical arguments', description: 'Same arguments on repeated builds' },
];

// Impact command test patterns
const impactTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-700-01', pattern: 'FR-700-01.*target info.*analysis phase', description: 'Reaches analysis phase for valid ID' },
  { acceptanceCriteriaId: 'FR-700-03', pattern: 'FR-700-03.*depth value.*--depth', description: 'Outputs depth from --depth option' },
];

// Drift command test patterns
const driftTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-500-01', pattern: 'FR-500-01.*No drift detected.*content match', description: 'No drift when content matches' },
  { acceptanceCriteriaId: 'FR-500-02', pattern: 'FR-500-02.*exits.*code 1.*failOnDrift', description: 'Exits with code 1 on failOnDrift' },
];

// New command test patterns (uses FR-104 model definition)
const newTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-104-01', pattern: 'FR-104-01.*available model types header', description: 'Outputs model types header when type omitted' },
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

  // ---------------------------------------------------------------------------
  // TEST-020: Lint command test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-020',
    description: 'Lint command verification test',
    source: {
      path: 'test/cli/lint.test.ts',
      framework: 'vitest',
    },
    verifiesRequirements: deriveVerifiesRequirements(lintTestPatterns),
    implementsCommand: 'CMD-LINT',
    testCasePatterns: lintTestPatterns,
    relations: deriveRelations(lintTestPatterns, 'CMD-LINT'),
  },

  // ---------------------------------------------------------------------------
  // TEST-021: Check command test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-021',
    description: 'Check command verification test',
    source: {
      path: 'test/cli/check.test.ts',
      framework: 'vitest',
    },
    verifiesRequirements: deriveVerifiesRequirements(checkTestPatterns),
    implementsCommand: 'CMD-CHECK',
    testCasePatterns: checkTestPatterns,
    relations: deriveRelations(checkTestPatterns, 'CMD-CHECK'),
  },

  // ---------------------------------------------------------------------------
  // TEST-022: Build command test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-022',
    description: 'Build command verification test',
    source: {
      path: 'test/cli/build.test.ts',
      framework: 'vitest',
    },
    verifiesRequirements: deriveVerifiesRequirements(buildTestPatterns),
    implementsCommand: 'CMD-BUILD',
    testCasePatterns: buildTestPatterns,
    relations: deriveRelations(buildTestPatterns, 'CMD-BUILD'),
  },

  // ---------------------------------------------------------------------------
  // TEST-023: Impact command test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-023',
    description: 'Impact command verification test',
    source: {
      path: 'test/cli/impact.test.ts',
      framework: 'vitest',
    },
    verifiesRequirements: deriveVerifiesRequirements(impactTestPatterns),
    implementsCommand: 'CMD-IMPACT',
    testCasePatterns: impactTestPatterns,
    relations: deriveRelations(impactTestPatterns, 'CMD-IMPACT'),
  },

  // ---------------------------------------------------------------------------
  // TEST-024: Drift command test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-024',
    description: 'Drift command verification test',
    source: {
      path: 'test/cli/drift.test.ts',
      framework: 'vitest',
    },
    verifiesRequirements: deriveVerifiesRequirements(driftTestPatterns),
    implementsCommand: 'CMD-DRIFT',
    testCasePatterns: driftTestPatterns,
    relations: deriveRelations(driftTestPatterns, 'CMD-DRIFT'),
  },

  // ---------------------------------------------------------------------------
  // TEST-025: New command test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-025',
    description: 'New command verification test',
    source: {
      path: 'test/cli/new.test.ts',
      framework: 'vitest',
    },
    verifiesRequirements: deriveVerifiesRequirements(newTestPatterns),
    implementsCommand: 'CMD-NEW',
    testCasePatterns: newTestPatterns,
    relations: deriveRelations(newTestPatterns, 'CMD-NEW'),
  },
];

export default defineSpecs(
  [TestRefModel.instance, testRefs],
);
