/**
 * FR-107-04: core provides the test verification common logic — test file
 * search, spec ID reference check and test result parsing — driven by a test
 * file path.
 *
 * Uses real files on disk, so the search and the reads actually run.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  verifyTests,
  findTestFiles,
  parseTestResults,
} from '../../../src/core/dsl/test-verification.js';

let tempDir: string;

const ORDERS_TEST = `describe('FR-001: order placement', () => {
  it('FR-001-01 stores the order', () => {});
  it('rejects an empty cart', () => {});
});
`;

const SHIPPING_TEST = `describe('shipping', () => {
  it('FR-002-01 picks the cheapest carrier', () => {});
});
`;

const RESULT_JSON = JSON.stringify({
  testResults: [
    {
      name: 'test/orders.test.ts',
      status: 'passed',
      assertionResults: [
        { fullName: 'FR-001: order placement > FR-001-01 stores the order', status: 'passed' },
      ],
    },
    {
      name: 'test/shipping.test.ts',
      status: 'failed',
      assertionResults: [
        { fullName: 'shipping > FR-002-01 picks the cheapest carrier', status: 'failed' },
      ],
    },
  ],
});

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'speckeeper-testverify-'));
  mkdirSync(join(tempDir, 'test'));
  writeFileSync(join(tempDir, 'test', 'orders.test.ts'), ORDERS_TEST);
  writeFileSync(join(tempDir, 'test', 'shipping.test.ts'), SHIPPING_TEST);
  writeFileSync(join(tempDir, 'results.json'), RESULT_JSON);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('FR-107-04: core-provided test verification common logic', () => {
  it('FR-107-04 finds the test files, checks spec ID references and parses results from the test file path', () => {
    const result = verifyTests({
      path: 'test/*.test.ts',
      specIds: ['FR-001', 'FR-002', 'FR-003'],
      testCasePatterns: [
        { acceptanceCriteriaId: 'FR-001-01', pattern: 'FR-001-01 stores the order' },
        { acceptanceCriteriaId: 'FR-003-01', pattern: 'FR-003-01 never written' },
      ],
      resultPath: 'results.json',
      basePath: tempDir,
    });

    // test file search
    expect(result.files).toEqual(['test/orders.test.ts', 'test/shipping.test.ts']);

    // spec ID reference check: FR-001 is named in a describe title, FR-003 nowhere
    expect(result.mentionedSpecIds).toEqual(['FR-001', 'FR-002']);
    expect(result.unmentionedSpecIds).toEqual(['FR-003']);

    // test case patterns
    expect(result.matchedPatterns.map(p => p.acceptanceCriteriaId)).toEqual(['FR-001-01']);
    expect(result.unmatchedPatterns.map(p => p.acceptanceCriteriaId)).toEqual(['FR-003-01']);

    // test result parsing
    expect(result.results).toEqual({
      found: true,
      passed: ['FR-001'],
      failed: ['FR-002'],
      notFound: ['FR-003'],
    });
  });

  it('FR-107-04 reports nothing verified when the path matches no test file', () => {
    const result = verifyTests({
      path: 'test/missing/*.test.ts',
      specIds: ['FR-001'],
      testCasePatterns: [{ acceptanceCriteriaId: 'FR-001-01', pattern: 'anything' }],
      basePath: tempDir,
    });

    expect(result.files).toEqual([]);
    expect(result.mentionedSpecIds).toEqual([]);
    expect(result.unmentionedSpecIds).toEqual(['FR-001']);
    expect(result.unmatchedPatterns).toHaveLength(1);
    expect(result.results).toBeUndefined();
  });

  it('FR-107-04 reports an unreadable result file as not found rather than as a pass', () => {
    const missing = parseTestResults(join(tempDir, 'no-such-results.json'), ['FR-001']);
    expect(missing).toEqual({ found: false, passed: [], failed: [], notFound: ['FR-001'] });

    writeFileSync(join(tempDir, 'broken.json'), '{ not json');
    const broken = parseTestResults(join(tempDir, 'broken.json'), ['FR-001']);
    expect(broken).toEqual({ found: false, passed: [], failed: [], notFound: ['FR-001'] });
  });

  it('FR-107-04 only counts a spec ID named inside a test title', () => {
    writeFileSync(
      join(tempDir, 'test', 'comment.test.ts'),
      "// FR-900 is only mentioned in a comment\ndescribe('unrelated', () => {});\n",
    );

    const result = verifyTests({
      path: 'test/comment.test.ts',
      specIds: ['FR-900'],
      basePath: tempDir,
    });

    expect(result.unmentionedSpecIds).toEqual(['FR-900']);
  });

  it('FR-107-04 expands a glob into a stable file list', () => {
    expect(findTestFiles('test/*.test.ts', tempDir)).toEqual([
      'test/orders.test.ts',
      'test/shipping.test.ts',
    ]);
  });
});
