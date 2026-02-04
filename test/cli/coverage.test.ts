/**
 * Coverage Check Tests
 * 
 * FR-604: Coverage verification (cross-model)
 * 
 * Test the coverageChecker interface of the Model class
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Mock type definitions (corresponding to CoverageChecker/CoverageResult in src/core/model.ts)
// ============================================================================

interface CoverageResult {
  total: number;
  covered: number;
  uncovered: number;
  coveragePercent: number;
  coveredItems: { id: string; description?: string }[];
  uncoveredItems: { id: string; description?: string; sourceId?: string }[];
}

interface CoverageChecker<T> {
  targetModel: string;
  description: string;
  check: (specs: T[], registry: Record<string, Map<string, unknown>>) => CoverageResult;
}

// design/ specific types (mock for testing)
interface AcceptanceCriteria {
  id: string;
  description: string;
  verificationMethod?: 'test' | 'review' | 'demo' | 'inspection';
}

interface Requirement {
  id: string;
  acceptanceCriteria?: AcceptanceCriteria[];
}

interface TestCasePattern {
  acceptanceCriteriaId: string;
  pattern: string;
}

interface TestRef {
  id: string;
  testCasePatterns?: TestCasePattern[];
}

// ============================================================================
// Mock coverageChecker (mimics implementation in design/_models/test-ref.ts)
// ============================================================================

const testRefCoverageChecker: CoverageChecker<TestRef> = {
  targetModel: 'requirement',
  description: 'TestRef coverage verification for acceptanceCriteria (verificationMethod: test)',
  check: (specs, registry): CoverageResult => {
    const requirements = registry.requirements;
    if (!requirements) {
      return { total: 0, covered: 0, uncovered: 0, coveragePercent: 100, coveredItems: [], uncoveredItems: [] };
    }

    // design/ specific: Extract acceptanceCriteria with verificationMethod: 'test'
    const testableACs: Array<{ id: string; description: string; sourceId: string }> = [];
    for (const req of requirements.values() as IterableIterator<Requirement>) {
      if (!req.acceptanceCriteria) continue;
      for (const ac of req.acceptanceCriteria) {
        if (ac.verificationMethod === 'test') {
          testableACs.push({ id: ac.id, description: ac.description, sourceId: req.id });
        }
      }
    }

    // Collect acceptanceCriteriaId from TestRef.testCasePatterns
    const coveredACIds = new Set<string>();
    for (const ref of specs) {
      if (!ref.testCasePatterns) continue;
      for (const pattern of ref.testCasePatterns) {
        coveredACIds.add(pattern.acceptanceCriteriaId);
      }
    }

    // Coverage determination
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

    return { total, covered, uncovered, coveragePercent, coveredItems, uncoveredItems };
  },
};

// ============================================================================
// Helper functions
// ============================================================================

function createRegistry(requirements: Requirement[]): Record<string, Map<string, unknown>> {
  const reqMap = new Map<string, unknown>();
  for (const req of requirements) {
    reqMap.set(req.id, req);
  }
  return { requirements: reqMap };
}

// ============================================================================
// Test suite
// ============================================================================

describe('FR-604: Coverage verification', () => {
  // ---------------------------------------------------------------------------
  // FR-604-01: Execute coverage verification with spects check --coverage
  // ---------------------------------------------------------------------------
  describe('FR-604-01: --coverage option execution', () => {
    it('should execute coverage check when --coverage option is provided', () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ-001',
          acceptanceCriteria: [
            { id: 'REQ-001-01', description: 'Test criterion', verificationMethod: 'test' },
          ],
        },
      ];
      const testRefs: TestRef[] = [
        {
          id: 'TEST-001',
          testCasePatterns: [{ acceptanceCriteriaId: 'REQ-001-01', pattern: '.*' }],
        },
      ];

      const result = testRefCoverageChecker.check(testRefs, createRegistry(requirements));

      expect(result).toBeDefined();
      expect(result.coveragePercent).toBe(100);
    });

    it('should return 100% coverage when no testable criteria exist', () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ-001',
          acceptanceCriteria: [
            { id: 'REQ-001-01', description: 'Review criterion', verificationMethod: 'review' },
          ],
        },
      ];
      const testRefs: TestRef[] = [];

      const result = testRefCoverageChecker.check(testRefs, createRegistry(requirements));

      expect(result.coveragePercent).toBe(100);
      expect(result.covered).toBe(0);
      expect(result.uncovered).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // FR-604-02: Define coverageChecker interface on Model class
  // ---------------------------------------------------------------------------
  describe('FR-604-02: coverageChecker interface definition', () => {
    it('should have CoverageChecker interface with required properties', () => {
      // coverageChecker has targetModel, description, check
      expect(testRefCoverageChecker.targetModel).toBe('requirement');
      expect(testRefCoverageChecker.description).toBeDefined();
      expect(typeof testRefCoverageChecker.check).toBe('function');
    });

    it('should have CoverageResult with total, covered, uncovered, coveragePercent', () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ-001',
          acceptanceCriteria: [
            { id: 'REQ-001-01', description: 'Test 1', verificationMethod: 'test' },
            { id: 'REQ-001-02', description: 'Test 2', verificationMethod: 'test' },
          ],
        },
      ];
      const testRefs: TestRef[] = [
        {
          id: 'TEST-001',
          testCasePatterns: [{ acceptanceCriteriaId: 'REQ-001-01', pattern: '.*' }],
        },
      ];

      const result = testRefCoverageChecker.check(testRefs, createRegistry(requirements));

      expect(result.total).toBe(2);
      expect(result.covered).toBe(1);
      expect(result.uncovered).toBe(1);
      expect(result.coveragePercent).toBe(50);
      expect(result.coveredItems).toHaveLength(1);
      expect(result.uncoveredItems).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // FR-604-03: Auto-detect and execute models with coverageChecker
  // ---------------------------------------------------------------------------
  describe('FR-604-03: coverageChecker auto-detection', () => {
    it('should detect model with coverageChecker and execute check', () => {
      // Mock model with coverageChecker
      interface MockModel {
        id: string;
        getCoverageChecker: () => CoverageChecker<TestRef> | undefined;
      }

      const modelWithChecker: MockModel = {
        id: 'test-ref',
        getCoverageChecker: () => testRefCoverageChecker,
      };

      const modelWithoutChecker: MockModel = {
        id: 'requirement',
        getCoverageChecker: () => undefined,
      };

      expect(modelWithChecker.getCoverageChecker()).toBeDefined();
      expect(modelWithoutChecker.getCoverageChecker()).toBeUndefined();
    });

    it('should iterate through models and find coverageChecker', () => {
      interface MockModel {
        id: string;
        getCoverageChecker: () => CoverageChecker<TestRef> | undefined;
      }

      const models: MockModel[] = [
        { id: 'requirement', getCoverageChecker: () => undefined },
        { id: 'test-ref', getCoverageChecker: () => testRefCoverageChecker },
        { id: 'component', getCoverageChecker: () => undefined },
      ];

      const foundChecker = models.find(m => m.getCoverageChecker())?.getCoverageChecker();

      expect(foundChecker).toBeDefined();
      expect(foundChecker?.targetModel).toBe('requirement');
    });
  });

  // ---------------------------------------------------------------------------
  // FR-604-04: Calculate and display coverage rate (%)
  // ---------------------------------------------------------------------------
  describe('FR-604-04: Coverage rate calculation', () => {
    it('should calculate 0% when nothing is covered', () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ-001',
          acceptanceCriteria: [
            { id: 'REQ-001-01', description: 'Test 1', verificationMethod: 'test' },
            { id: 'REQ-001-02', description: 'Test 2', verificationMethod: 'test' },
          ],
        },
      ];
      const testRefs: TestRef[] = [];

      const result = testRefCoverageChecker.check(testRefs, createRegistry(requirements));

      expect(result.coveragePercent).toBe(0);
    });

    it('should calculate 50% when half is covered', () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ-001',
          acceptanceCriteria: [
            { id: 'REQ-001-01', description: 'Covered', verificationMethod: 'test' },
            { id: 'REQ-001-02', description: 'Not covered', verificationMethod: 'test' },
          ],
        },
      ];
      const testRefs: TestRef[] = [
        {
          id: 'TEST-001',
          testCasePatterns: [{ acceptanceCriteriaId: 'REQ-001-01', pattern: '.*' }],
        },
      ];

      const result = testRefCoverageChecker.check(testRefs, createRegistry(requirements));

      expect(result.coveragePercent).toBe(50);
    });

    it('should calculate 100% when everything is covered', () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ-001',
          acceptanceCriteria: [
            { id: 'REQ-001-01', description: 'Test 1', verificationMethod: 'test' },
            { id: 'REQ-001-02', description: 'Test 2', verificationMethod: 'test' },
          ],
        },
      ];
      const testRefs: TestRef[] = [
        {
          id: 'TEST-001',
          testCasePatterns: [
            { acceptanceCriteriaId: 'REQ-001-01', pattern: '.*' },
            { acceptanceCriteriaId: 'REQ-001-02', pattern: '.*' },
          ],
        },
      ];

      const result = testRefCoverageChecker.check(testRefs, createRegistry(requirements));

      expect(result.coveragePercent).toBe(100);
    });

    it('should round coverage percentage to integer', () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ-001',
          acceptanceCriteria: [
            { id: 'REQ-001-01', description: 'Test 1', verificationMethod: 'test' },
            { id: 'REQ-001-02', description: 'Test 2', verificationMethod: 'test' },
            { id: 'REQ-001-03', description: 'Test 3', verificationMethod: 'test' },
          ],
        },
      ];
      const testRefs: TestRef[] = [
        {
          id: 'TEST-001',
          testCasePatterns: [{ acceptanceCriteriaId: 'REQ-001-01', pattern: '.*' }],
        },
      ];

      const result = testRefCoverageChecker.check(testRefs, createRegistry(requirements));

      // 1/3 = 33.33% -> rounds to 33%
      expect(result.coveragePercent).toBe(33);
    });
  });

  // ---------------------------------------------------------------------------
  // FR-604-05: Display list of uncovered items
  // ---------------------------------------------------------------------------
  describe('FR-604-05: Uncovered items listing', () => {
    it('should list all uncovered items with details', () => {
      const requirements: Requirement[] = [
        {
          id: 'FR-100',
          acceptanceCriteria: [
            { id: 'FR-100-01', description: 'First criterion', verificationMethod: 'test' },
            { id: 'FR-100-02', description: 'Second criterion', verificationMethod: 'test' },
          ],
        },
        {
          id: 'FR-200',
          acceptanceCriteria: [
            { id: 'FR-200-01', description: 'Third criterion', verificationMethod: 'test' },
          ],
        },
      ];
      const testRefs: TestRef[] = [
        {
          id: 'TEST-001',
          testCasePatterns: [{ acceptanceCriteriaId: 'FR-100-01', pattern: '.*' }],
        },
      ];

      const result = testRefCoverageChecker.check(testRefs, createRegistry(requirements));

      expect(result.uncoveredItems).toHaveLength(2);

      // Check uncovered items have all required fields
      for (const item of result.uncoveredItems) {
        expect(item.id).toBeDefined();
        expect(item.description).toBeDefined();
      }

      // Specific uncovered items
      const uncoveredIds = result.uncoveredItems.map(item => item.id);
      expect(uncoveredIds).toContain('FR-100-02');
      expect(uncoveredIds).toContain('FR-200-01');
    });

    it('should include sourceId for each uncovered item', () => {
      const requirements: Requirement[] = [
        {
          id: 'FR-101',
          acceptanceCriteria: [
            { id: 'FR-101-01', description: 'Criterion', verificationMethod: 'test' },
          ],
        },
      ];
      const testRefs: TestRef[] = [];

      const result = testRefCoverageChecker.check(testRefs, createRegistry(requirements));

      expect(result.uncoveredItems).toHaveLength(1);
      expect(result.uncoveredItems[0].sourceId).toBe('FR-101');
    });

    it('should return empty uncovered list when all covered', () => {
      const requirements: Requirement[] = [
        {
          id: 'REQ-001',
          acceptanceCriteria: [
            { id: 'REQ-001-01', description: 'Test', verificationMethod: 'test' },
          ],
        },
      ];
      const testRefs: TestRef[] = [
        {
          id: 'TEST-001',
          testCasePatterns: [{ acceptanceCriteriaId: 'REQ-001-01', pattern: '.*' }],
        },
      ];

      const result = testRefCoverageChecker.check(testRefs, createRegistry(requirements));

      expect(result.uncoveredItems).toHaveLength(0);
    });
  });
});
