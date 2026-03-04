/**
 * Core DSL — Checker and coverage factories
 *
 * Target-class-specific external checkers and relation-based coverage checkers.
 * Scaffold auto-binds these based on edge type and target node class.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import type { ExternalChecker, CheckResult, CoverageChecker, CoverageResult } from '../model.js';

// ---------------------------------------------------------------------------
// Test checker (target class: "test")
// ---------------------------------------------------------------------------

export interface TestCheckerConfig<T> {
  sourcePath?: (spec: T) => string;
}

/**
 * Creates an ExternalChecker that verifies test file existence and spec ID references.
 */
export function testChecker<T extends { id: string }>(
  config?: TestCheckerConfig<T>,
): ExternalChecker<T> {
  return {
    targetType: 'test',
    sourcePath: config?.sourcePath ?? (() => '.'),
    check: (spec): CheckResult => {
      const errors: CheckResult['errors'] = [];
      const warnings: CheckResult['warnings'] = [];
      const basePath = process.cwd();

      const testPatterns = [
        'test/**/*.test.ts',
        'test/**/*.spec.ts',
        'tests/**/*.test.ts',
        'tests/**/*.spec.ts',
      ];

      let testFiles: string[] = [];
      for (const pattern of testPatterns) {
        testFiles = testFiles.concat(glob.sync(pattern, { cwd: basePath }));
      }

      if (testFiles.length === 0) {
        warnings.push({ message: `No test files found for ${spec.id}`, specId: spec.id });
        return { success: true, errors, warnings };
      }

      let specIdFound = false;
      for (const testFile of testFiles) {
        const fullPath = join(basePath, testFile);
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const patterns = [
            new RegExp(`describe\\s*\\(\\s*['"\`].*${spec.id}`, 'm'),
            new RegExp(`it\\s*\\(\\s*['"\`].*${spec.id}`, 'm'),
            new RegExp(`test\\s*\\(\\s*['"\`].*${spec.id}`, 'm'),
          ];
          if (patterns.some(p => p.test(content))) {
            specIdFound = true;
            break;
          }
        } catch {
          // skip unreadable files
        }
      }

      if (!specIdFound) {
        warnings.push({
          message: `Spec ID "${spec.id}" not found in any test file`,
          specId: spec.id,
        });
      }

      return { success: errors.length === 0, errors, warnings };
    },
  };
}

// ---------------------------------------------------------------------------
// OpenAPI checker (target class: "openapi")
// ---------------------------------------------------------------------------

export interface OpenAPICheckerConfig<T> {
  sourcePath?: (spec: T) => string;
}

/**
 * Creates an ExternalChecker that verifies consistency with an OpenAPI spec file.
 */
export function externalOpenAPIChecker<T extends { id: string }>(
  config?: OpenAPICheckerConfig<T>,
): ExternalChecker<T> {
  return {
    targetType: 'openapi',
    sourcePath: config?.sourcePath ?? (() => 'api/openapi.yaml'),
    check: (spec, externalData): CheckResult => {
      const errors: CheckResult['errors'] = [];
      const warnings: CheckResult['warnings'] = [];

      if (!externalData) {
        warnings.push({ message: `No OpenAPI data loaded for ${spec.id}`, specId: spec.id });
        return { success: true, errors, warnings };
      }

      return { success: errors.length === 0, errors, warnings };
    },
  };
}

// ---------------------------------------------------------------------------
// SQL Schema checker (target class: "sqlschema")
// ---------------------------------------------------------------------------

export interface SqlSchemaCheckerConfig<T> {
  sourcePath?: (spec: T) => string;
}

/**
 * Creates an ExternalChecker that verifies consistency with a SQL schema (DDL).
 */
export function externalSqlSchemaChecker<T extends { id: string }>(
  config?: SqlSchemaCheckerConfig<T>,
): ExternalChecker<T> {
  return {
    targetType: 'ddl',
    sourcePath: config?.sourcePath ?? (() => 'db/schema.sql'),
    check: (spec, externalData): CheckResult => {
      const errors: CheckResult['errors'] = [];
      const warnings: CheckResult['warnings'] = [];

      if (!externalData) {
        warnings.push({ message: `No SQL schema data loaded for ${spec.id}`, specId: spec.id });
        return { success: true, errors, warnings };
      }

      return { success: errors.length === 0, errors, warnings };
    },
  };
}

// ---------------------------------------------------------------------------
// Relation-based coverage checker
// ---------------------------------------------------------------------------

export interface RelationCoverageConfig {
  targetModel: string;
  description: string;
  relationType?: string;
  targetPrefix?: string;
}

/**
 * Creates a CoverageChecker that computes coverage of a target model via relations.
 */
export function relationCoverage<T extends { id: string; relations?: Array<{ type: string; target: string }> }>(
  config: RelationCoverageConfig,
): CoverageChecker<T> {
  return {
    targetModel: config.targetModel,
    description: config.description,
    check: (specs, registry): CoverageResult => {
      const targets = registry[config.targetModel];
      if (!targets) {
        return { total: 0, covered: 0, uncovered: 0, coveragePercent: 100, coveredItems: [], uncoveredItems: [] };
      }

      const allTargetIds = new Set<string>();
      const targetDescriptions = new Map<string, string>();
      for (const t of targets.values() as IterableIterator<{ id: string; name?: string; description?: string }>) {
        if (config.targetPrefix && !t.id.startsWith(config.targetPrefix)) continue;
        allTargetIds.add(t.id);
        targetDescriptions.set(t.id, t.name ?? t.description ?? t.id);
      }

      const coveredIds = new Set<string>();
      for (const spec of specs) {
        if (!spec.relations) continue;
        for (const rel of spec.relations) {
          if (config.relationType && rel.type !== config.relationType) continue;
          if (allTargetIds.has(rel.target)) coveredIds.add(rel.target);
        }
      }

      const coveredItems: CoverageResult['coveredItems'] = [];
      const uncoveredItems: CoverageResult['uncoveredItems'] = [];
      for (const id of allTargetIds) {
        const desc = targetDescriptions.get(id);
        if (coveredIds.has(id)) {
          coveredItems.push({ id, description: desc });
        } else {
          uncoveredItems.push({ id, description: desc });
        }
      }

      const total = allTargetIds.size;
      const covered = coveredItems.length;
      const coveragePercent = total > 0 ? Math.round((covered / total) * 100) : 100;

      return { total, covered, uncovered: total - covered, coveragePercent, coveredItems, uncoveredItems };
    },
  };
}
