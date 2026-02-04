/**
 * spects Test References - Test Reference Definitions
 *
 * Defines associations between test files and acceptance criteria.
 * verifiesRequirements and relations are auto-derived from testCasePatterns.acceptanceCriteriaId.
 * spects check test verifies test file existence and acceptance criteria ID mentions.
 */
import type { TestRef, TestCasePattern } from './_models/test-ref.ts';

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

const lintTestPatterns: TestCasePattern[] = [
  // FR-401-01: ID uniqueness validation
  {
    acceptanceCriteriaId: 'FR-401-01',
    pattern: 'FR-101.*ID uniqueness check',
    description: 'ID duplication detection test',
  },
  // FR-401-02: ID convention validation
  {
    acceptanceCriteriaId: 'FR-401-02',
    pattern: 'FR-101.*Naming convention check',
    description: 'ID naming convention check test',
  },
  // FR-400-01: Common lint
  {
    acceptanceCriteriaId: 'FR-400-01',
    pattern: 'FR-400.*Required fields check',
    description: 'Required fields check test',
  },
  // FR-401-03: Reference integrity validation
  {
    acceptanceCriteriaId: 'FR-401-03',
    pattern: 'FR-401.*Reference integrity check',
    description: 'Reference integrity check test',
  },
  // FR-401-04: Circular reference validation
  {
    acceptanceCriteriaId: 'FR-401-04',
    pattern: 'FR-401.*Circular dependency check',
    description: 'Circular dependency detection test',
  },
  // FR-401-06: Orphan element detection
  {
    acceptanceCriteriaId: 'FR-401-06',
    pattern: 'FR-401.*Orphan element check',
    description: 'Orphan element detection test',
  },
];

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

// ---------------------------------------------------------------------------
// New test file pattern definitions
// ---------------------------------------------------------------------------

const idManagementTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-101-01', pattern: 'FR-101-01.*ID uniqueness', description: 'ID uniqueness test' },
  { acceptanceCriteriaId: 'FR-101-02', pattern: 'FR-101-02.*ID naming convention', description: 'ID naming convention test' },
  { acceptanceCriteriaId: 'FR-101-03', pattern: 'FR-101-03.*reference integrity', description: 'Reference integrity test' },
  { acceptanceCriteriaId: 'FR-101-04', pattern: 'FR-101-04.*ID change', description: 'ID change reference detection test' },
];

const phaseManagementTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-102-01', pattern: 'FR-102-01.*Phase configuration', description: 'Phase setting test' },
  { acceptanceCriteriaId: 'FR-102-02', pattern: 'FR-102-02.*phase gate', description: 'Phase gate validation test' },
  { acceptanceCriteriaId: 'FR-102-03', pattern: 'FR-102-03.*TBD', description: 'TBD allow/prohibit test' },
];

const modelDefinitionTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-104-01', pattern: 'FR-104-01.*Model base class', description: 'Model base class test' },
  { acceptanceCriteriaId: 'FR-104-02', pattern: 'FR-104-02.*Zod schema', description: 'Zod schema validation test' },
  { acceptanceCriteriaId: 'FR-104-03', pattern: 'FR-104-03.*Custom lint', description: 'Custom lint rule test' },
  { acceptanceCriteriaId: 'FR-104-04', pattern: 'FR-104-04.*renderer|export.*markdown|export.*json', description: 'Renderer test' },
  { acceptanceCriteriaId: 'FR-104-05', pattern: 'FR-104-05.*External checker', description: 'External checker test' },
  { acceptanceCriteriaId: 'FR-104-07', pattern: 'FR-104-07.*Model registration', description: 'Model registration test' },
];

const externalRefTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-200-01', pattern: 'FR-200-01.*basic interface', description: 'Basic interface test' },
  { acceptanceCriteriaId: 'FR-200-02', pattern: 'FR-200-02.*file path', description: 'File path setting test' },
  { acceptanceCriteriaId: 'FR-200-03', pattern: 'FR-200-03.*association', description: 'Association test' },
];

const buildTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-300-01', pattern: 'FR-300-01.*docs', description: 'docs/ generation test' },
  { acceptanceCriteriaId: 'FR-300-02', pattern: 'FR-300-02.*specs', description: 'specs/ generation test' },
  { acceptanceCriteriaId: 'FR-301-03', pattern: 'FR-301-03.*Model-specific rendering', description: 'Per-model rendering test' },
  { acceptanceCriteriaId: 'FR-301-04', pattern: 'FR-301-04.*format|single.*index', description: 'Format parameter test' },
  { acceptanceCriteriaId: 'FR-301-05', pattern: 'FR-301-05.*idempotent|identical.*output', description: 'Idempotency test' },
  { acceptanceCriteriaId: 'FR-302-01', pattern: 'FR-302-01.*JSON Schema', description: 'JSON Schema mapping test' },
  { acceptanceCriteriaId: 'FR-302-02', pattern: 'FR-302-02.*reference graph|index\\.json', description: 'Reference resolution graph test' },
];

const driftTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-500-01', pattern: 'FR-500-01.*Diff detection', description: 'Difference detection test' },
  { acceptanceCriteriaId: 'FR-500-02', pattern: 'FR-500-02.*CI fail', description: 'CI failure test' },
  { acceptanceCriteriaId: 'FR-500-03', pattern: 'FR-500-03.*Regeneration message', description: 'Regenerate message test' },
];

const checkTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-600-01', pattern: 'FR-600-01.*Existence check', description: 'Existence check test' },
  { acceptanceCriteriaId: 'FR-600-02', pattern: 'FR-600-02.*Type check', description: 'Type check test' },
  { acceptanceCriteriaId: 'FR-600-03', pattern: 'FR-600-03.*Constraint check', description: 'Constraint check test' },
  { acceptanceCriteriaId: 'FR-601-01', pattern: 'FR-601-01|existence.*Existence', description: 'Existence category test' },
  { acceptanceCriteriaId: 'FR-601-02', pattern: 'FR-601-02|type.*Type', description: 'Type category test' },
  { acceptanceCriteriaId: 'FR-601-03', pattern: 'FR-601-03|constraint.*Constraint', description: 'Constraint category test' },
  { acceptanceCriteriaId: 'FR-602-01', pattern: 'FR-602-01.*All models check', description: 'All models check test' },
  { acceptanceCriteriaId: 'FR-602-02', pattern: 'FR-602-02.*specific model', description: 'Specific model check test' },
  { acceptanceCriteriaId: 'FR-602-04', pattern: 'FR-602-04.*externalChecker presence', description: 'externalChecker presence test' },
  { acceptanceCriteriaId: 'FR-603-01', pattern: 'FR-603-01.*externalChecker config', description: 'externalChecker config test' },
  { acceptanceCriteriaId: 'FR-603-02', pattern: 'FR-603-02.*File loading', description: 'File reading test' },
  { acceptanceCriteriaId: 'FR-603-03', pattern: 'FR-603-03.*Check result structure', description: 'Check result structure test' },
  { acceptanceCriteriaId: 'FR-603-04', pattern: 'FR-603-04.*Auto-detection', description: 'Auto detection test' },
];

const impactTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-700-01', pattern: 'FR-700-01.*Impact scope analysis', description: 'Impact scope analysis test' },
  { acceptanceCriteriaId: 'FR-700-02', pattern: 'FR-700-02.*Relation tracking', description: 'Relation tracking test' },
  { acceptanceCriteriaId: 'FR-700-03', pattern: 'FR-700-03.*reference depth', description: 'Reference depth test' },
  { acceptanceCriteriaId: 'FR-700-04', pattern: 'FR-700-04.*Impact category classification', description: 'Impact category classification test' },
  { acceptanceCriteriaId: 'FR-701-01', pattern: 'FR-701-01.*relations property', description: 'Relations property test' },
  { acceptanceCriteriaId: 'FR-701-03', pattern: 'FR-701-03.*Impact analysis input', description: 'Impact analysis input test' },
  { acceptanceCriteriaId: 'FR-701-04', pattern: 'FR-701-04.*level constraint', description: 'Level constraint test' },
  { acceptanceCriteriaId: 'FR-701-05', pattern: 'FR-701-05.*Violation detection', description: 'Violation detection test' },
];

const exportTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-800-01', pattern: 'FR-800-01.*aggregated JSON', description: 'Aggregated JSON output test' },
];

const performanceTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'NFR-001-01', pattern: 'NFR-001-01.*Large-scale model', description: 'Large scale model build test' },
];

const compatibilityTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'NFR-002-01', pattern: 'NFR-002-01.*Node.js 18', description: 'Node.js 18 compatibility test' },
  { acceptanceCriteriaId: 'NFR-002-02', pattern: 'NFR-002-02.*Node.js 20', description: 'Node.js 20 compatibility test' },
  { acceptanceCriteriaId: 'NFR-003-01', pattern: 'NFR-003-01.*TypeScript 5.0', description: 'TypeScript 5.0 compatibility test' },
  { acceptanceCriteriaId: 'NFR-003-02', pattern: 'NFR-003-02.*strict mode', description: 'Strict mode test' },
  { acceptanceCriteriaId: 'NFR-005-01', pattern: 'NFR-005-01.*ESM import', description: 'ESM import test' },
];

// Lint custom rule test patterns
const lintCustomRuleTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-400-02', pattern: 'FR-400-02.*Custom lint rule', description: 'Custom lint rule definition test' },
  { acceptanceCriteriaId: 'FR-401-05', pattern: 'FR-401-05.*TBD validation', description: 'Phase TBD validation test' },
  { acceptanceCriteriaId: 'FR-402-01', pattern: 'FR-402-01.*lintRules config', description: 'lintRules config test' },
  { acceptanceCriteriaId: 'FR-402-02', pattern: 'FR-402-02.*Severity configuration', description: 'Severity setting test' },
  { acceptanceCriteriaId: 'FR-402-03', pattern: 'FR-402-03.*Lint result structure', description: 'Lint result structure test' },
];

// Coverage verification test patterns
const coverageTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-604-01', pattern: 'FR-604-01.*--coverage', description: '--coverage option execution test' },
  { acceptanceCriteriaId: 'FR-604-02', pattern: 'FR-604-02.*coverageChecker.*interface', description: 'coverageChecker interface test' },
  { acceptanceCriteriaId: 'FR-604-03', pattern: 'FR-604-03.*coverageChecker auto-detection', description: 'coverageChecker auto detection test' },
  { acceptanceCriteriaId: 'FR-604-04', pattern: 'FR-604-04.*coverage rate', description: 'Coverage rate calculation test' },
  { acceptanceCriteriaId: 'FR-604-05', pattern: 'FR-604-05.*Uncovered items', description: 'Uncovered list display test' },
];

// Model level test patterns
const modelLevelTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-104-08', pattern: 'FR-104-08.*modelLevel configuration', description: 'modelLevel setting test' },
  { acceptanceCriteriaId: 'FR-104-09', pattern: 'FR-104-09.*level.*property', description: 'level property retrieval test' },
];

// Init command test patterns
const initTestPatterns: TestCasePattern[] = [
  { acceptanceCriteriaId: 'FR-105-01', pattern: 'FR-105-01.*creates design/', description: 'Design directory creation test' },
  { acceptanceCriteriaId: 'FR-105-02', pattern: 'FR-105-02.*spects.config.ts', description: 'Config file generation test' },
  { acceptanceCriteriaId: 'FR-105-03', pattern: 'FR-105-03.*package.json', description: 'Package.json generation test' },
  { acceptanceCriteriaId: 'FR-105-04', pattern: 'FR-105-04.*tsconfig.json', description: 'tsconfig.json generation test' },
  { acceptanceCriteriaId: 'FR-105-05', pattern: 'FR-105-05.*model definitions', description: 'Model definitions generation test' },
  { acceptanceCriteriaId: 'FR-105-06', pattern: 'FR-105-06.*sample specification', description: 'Sample specification generation test' },
  { acceptanceCriteriaId: 'FR-105-07', pattern: 'FR-105-07.*spects lint', description: 'Generated project lint test' },
  { acceptanceCriteriaId: 'FR-105-08', pattern: 'FR-105-08.*typecheck', description: 'Generated project typecheck test' },
  { acceptanceCriteriaId: 'FR-105-09', pattern: 'FR-105-09.*--force', description: 'Force overwrite test' },
  { acceptanceCriteriaId: 'FR-105-10', pattern: 'FR-105-10.*skips package.json', description: 'Skip existing package.json test' },
];

// ============================================================================
// Test Reference List
// ============================================================================

export const testRefs: TestRef[] = [
  // ---------------------------------------------------------------------------
  // TEST-001: Lint command test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-001',
    description: 'Lint command verification test',
    source: {
      path: 'test/cli/lint.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(lintTestPatterns),
    implementsCommand: 'CMD-LINT',
    testCasePatterns: lintTestPatterns,
    relations: deriveRelations(lintTestPatterns, 'CMD-LINT'),
  },

  // ---------------------------------------------------------------------------
  // TEST-002: Config Loader utility test
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
  // TEST-005: ID Management test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-005',
    description: 'ID management feature verification test',
    source: {
      path: 'test/core/id-management.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(idManagementTestPatterns),
    testCasePatterns: idManagementTestPatterns,
    relations: deriveRelations(idManagementTestPatterns),
  },

  // ---------------------------------------------------------------------------
  // TEST-006: Phase Management test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-006',
    description: 'Phase management feature verification test',
    source: {
      path: 'test/core/phase-management.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(phaseManagementTestPatterns),
    testCasePatterns: phaseManagementTestPatterns,
    relations: deriveRelations(phaseManagementTestPatterns),
  },

  // ---------------------------------------------------------------------------
  // TEST-007: Model Definition test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-007',
    description: 'Model definition feature verification test',
    source: {
      path: 'test/core/model-definition.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(modelDefinitionTestPatterns),
    testCasePatterns: modelDefinitionTestPatterns,
    relations: deriveRelations(modelDefinitionTestPatterns),
  },

  // ---------------------------------------------------------------------------
  // TEST-008: External Ref test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-008',
    description: 'External SSOT reference feature verification test',
    source: {
      path: 'test/models/external-ref.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(externalRefTestPatterns),
    testCasePatterns: externalRefTestPatterns,
    relations: deriveRelations(externalRefTestPatterns),
  },

  // ---------------------------------------------------------------------------
  // TEST-009: Build test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-009',
    description: 'Build feature verification test',
    source: {
      path: 'test/cli/build.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(buildTestPatterns),
    implementsCommand: 'CMD-BUILD',
    testCasePatterns: buildTestPatterns,
    relations: deriveRelations(buildTestPatterns, 'CMD-BUILD'),
  },

  // ---------------------------------------------------------------------------
  // TEST-010: Drift test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-010',
    description: 'Drift check feature verification test',
    source: {
      path: 'test/cli/drift.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(driftTestPatterns),
    implementsCommand: 'CMD-DRIFT',
    testCasePatterns: driftTestPatterns,
    relations: deriveRelations(driftTestPatterns, 'CMD-DRIFT'),
  },

  // ---------------------------------------------------------------------------
  // TEST-011: Check test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-011',
    description: 'External SSOT consistency check feature verification test',
    source: {
      path: 'test/cli/check.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(checkTestPatterns),
    implementsCommand: 'CMD-CHECK',
    testCasePatterns: checkTestPatterns,
    relations: deriveRelations(checkTestPatterns, 'CMD-CHECK'),
  },

  // ---------------------------------------------------------------------------
  // TEST-012: Impact test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-012',
    description: 'Change impact analysis feature verification test',
    source: {
      path: 'test/cli/impact.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(impactTestPatterns),
    implementsCommand: 'CMD-IMPACT',
    testCasePatterns: impactTestPatterns,
    relations: deriveRelations(impactTestPatterns, 'CMD-IMPACT'),
  },

  // ---------------------------------------------------------------------------
  // TEST-013: Export test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-013',
    description: 'Export feature verification test',
    source: {
      path: 'test/cli/export.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(exportTestPatterns),
    testCasePatterns: exportTestPatterns,
    relations: deriveRelations(exportTestPatterns),
  },

  // ---------------------------------------------------------------------------
  // TEST-014: Performance test (NFR)
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-014',
    description: 'Performance requirements verification test',
    source: {
      path: 'test/nfr/performance.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(performanceTestPatterns),
    testCasePatterns: performanceTestPatterns,
    relations: deriveRelations(performanceTestPatterns),
  },

  // ---------------------------------------------------------------------------
  // TEST-015: Compatibility test (NFR)
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-015',
    description: 'Compatibility requirements verification test',
    source: {
      path: 'test/nfr/compatibility.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(compatibilityTestPatterns),
    testCasePatterns: compatibilityTestPatterns,
    relations: deriveRelations(compatibilityTestPatterns),
  },

  // ---------------------------------------------------------------------------
  // TEST-016: Lint Command custom rule test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-016',
    description: 'Lint custom rule feature verification test',
    source: {
      path: 'test/cli/lint.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(lintCustomRuleTestPatterns),
    implementsCommand: 'CMD-LINT',
    testCasePatterns: lintCustomRuleTestPatterns,
    relations: deriveRelations(lintCustomRuleTestPatterns, 'CMD-LINT'),
  },

  // ---------------------------------------------------------------------------
  // TEST-017: Coverage test
  // ---------------------------------------------------------------------------
  {
    id: 'TEST-017',
    description: 'Test coverage verification feature test',
    source: {
      path: 'test/cli/coverage.test.ts',
      framework: 'vitest',
      resultPath: 'test-results/all.json',
    },
    verifiesRequirements: deriveVerifiesRequirements(coverageTestPatterns),
    implementsCommand: 'CMD-CHECK',
    testCasePatterns: coverageTestPatterns,
    relations: deriveRelations(coverageTestPatterns, 'CMD-CHECK'),
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

console.log(`Test References loaded: ${testRefs.length} refs`);
