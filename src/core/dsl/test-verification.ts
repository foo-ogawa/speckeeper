/**
 * Core DSL — Test verification common logic
 *
 * Verifies a spec against the test code that covers it: finds the test files,
 * checks that they name the spec IDs, matches the declared test case patterns,
 * and reads the framework's result file. A model supplies the test file path and
 * consumes the result.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';

/** A spec ID paired with the test case name pattern that covers it */
export interface TestCasePatternInput {
  /** ID of the criteria this pattern covers */
  acceptanceCriteriaId: string;
  /** Test case name pattern (regular expression source) */
  pattern: string;
}

export interface TestVerificationInput {
  /** Test file path or glob */
  path: string;
  /** Spec IDs the test files must name */
  specIds: string[];
  /** Patterns that must match a test case name */
  testCasePatterns?: TestCasePatternInput[];
  /** Path of the framework's result JSON */
  resultPath?: string;
  /** Directory the paths resolve against; defaults to the working directory */
  basePath?: string;
}

export interface TestVerificationResult {
  /** Test files the path matched */
  files: string[];
  /** Spec IDs named by at least one test file */
  mentionedSpecIds: string[];
  /** Spec IDs no test file names */
  unmentionedSpecIds: string[];
  /** Patterns that matched a test case name */
  matchedPatterns: TestCasePatternInput[];
  /** Patterns no test case name matched */
  unmatchedPatterns: TestCasePatternInput[];
  /** Result file outcome, or undefined when no result path was given */
  results?: TestResultSummary;
}

export interface TestResultSummary {
  /** The result file was present and parsed */
  found: boolean;
  /** Spec IDs whose tests all passed */
  passed: string[];
  /** Spec IDs with at least one failing test */
  failed: string[];
  /** Spec IDs no test result mentions */
  notFound: string[];
}

/** Shape of a vitest/jest JSON report, narrowed to the fields read here */
interface FrameworkResultFile {
  testResults?: Array<{
    name?: string;
    status?: string;
    assertionResults?: Array<{ fullName?: string; status?: string }>;
  }>;
}

/**
 * Test file search: expand the declared path or glob.
 */
export function findTestFiles(path: string, basePath: string): string[] {
  return glob.sync(path, { cwd: basePath }).sort();
}

/**
 * Spec ID reference check: a spec ID counts as named when it appears in a
 * `describe`, `it` or `test` title.
 */
function specIdsNamedIn(content: string, specIds: string[]): Set<string> {
  const named = new Set<string>();
  for (const specId of specIds) {
    const escaped = escapeForRegExp(specId);
    const titled = new RegExp(`(?:describe|it|test)\\s*\\(\\s*['"\`][^'"\`]*${escaped}`, 'm');
    if (titled.test(content)) named.add(specId);
  }
  return named;
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Test result parsing: read the framework's JSON report and classify each spec ID.
 * A report that cannot be read or parsed is reported as not found rather than as
 * a pass, so a missing report never looks like a green run.
 */
export function parseTestResults(resultPath: string, specIds: string[]): TestResultSummary {
  let report: FrameworkResultFile;
  try {
    report = JSON.parse(readFileSync(resultPath, 'utf-8')) as FrameworkResultFile;
  } catch {
    return { found: false, passed: [], failed: [], notFound: [...specIds] };
  }

  const passed: string[] = [];
  const failed: string[] = [];
  const notFound: string[] = [];

  for (const specId of specIds) {
    let seen = false;
    let allPassed = true;

    for (const suite of report.testResults ?? []) {
      if (suite.name?.includes(specId)) {
        seen = true;
        if (suite.status !== 'passed') allPassed = false;
      }
      for (const assertion of suite.assertionResults ?? []) {
        if (assertion.fullName?.includes(specId)) {
          seen = true;
          if (assertion.status !== 'passed') allPassed = false;
        }
      }
    }

    if (!seen) notFound.push(specId);
    else if (allPassed) passed.push(specId);
    else failed.push(specId);
  }

  return { found: true, passed, failed, notFound };
}

/**
 * Verify a spec against its test code.
 *
 * With no matching test file nothing can be confirmed, so every spec ID is
 * reported as unmentioned and every pattern as unmatched.
 */
export function verifyTests(input: TestVerificationInput): TestVerificationResult {
  const basePath = input.basePath ?? process.cwd();
  const files = findTestFiles(input.path, basePath);
  const patterns = input.testCasePatterns ?? [];

  const mentioned = new Set<string>();
  const matched = new Map<string, TestCasePatternInput>();

  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(join(basePath, file), 'utf-8');
    } catch {
      continue;
    }

    for (const specId of specIdsNamedIn(content, input.specIds)) {
      mentioned.add(specId);
    }

    for (const pattern of patterns) {
      if (new RegExp(pattern.pattern, 'm').test(content)) {
        matched.set(pattern.acceptanceCriteriaId, pattern);
      }
    }
  }

  const results = input.resultPath === undefined
    ? undefined
    : parseTestResults(join(basePath, input.resultPath), input.specIds);

  return {
    files,
    mentionedSpecIds: input.specIds.filter(id => mentioned.has(id)),
    unmentionedSpecIds: input.specIds.filter(id => !mentioned.has(id)),
    matchedPatterns: patterns.filter(p => matched.has(p.acceptanceCriteriaId)),
    unmatchedPatterns: patterns.filter(p => !matched.has(p.acceptanceCriteriaId)),
    results,
  };
}
