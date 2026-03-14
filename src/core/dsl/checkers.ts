/**
 * Core DSL — Coverage checkers and annotation scan utilities
 *
 * Per-model checker factory functions (testChecker, externalOpenAPIChecker, etc.)
 * have been replaced by the global scanner (src/core/global-scanner.ts).
 * This module retains coverage checkers and shared annotation scan utilities.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import type { CoverageChecker, CoverageResult } from '../model.js';
import type { ArtifactConfig } from '../config-api.js';

// ---------------------------------------------------------------------------
// Annotation scan utilities (shared by coverage checkers)
// ---------------------------------------------------------------------------

export type AnnotationRelationType = 'verifiedBy' | 'implements' | 'traces';

function relationTypeToAnnotation(relationType: AnnotationRelationType): string {
  return relationType === 'verifiedBy' ? 'verifies' : relationType;
}

function getDefaultPatternForRelation(relationType: AnnotationRelationType): RegExp {
  const ann = relationTypeToAnnotation(relationType);
  return new RegExp(`@${ann}\\s+([\\w-]+(?:[,\\s]+[\\w-]+)*)`, 'g');
}

function extractSpecIds(captured: string): string[] {
  return captured.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
}

let _artifactsConfig: Record<string, ArtifactConfig> | undefined;

export function setArtifactsConfig(config: Record<string, ArtifactConfig>): void {
  _artifactsConfig = config;
}

export function getArtifactsConfig(): Record<string, ArtifactConfig> | undefined {
  return _artifactsConfig;
}

// ---------------------------------------------------------------------------
// Annotation coverage checker
// ---------------------------------------------------------------------------

export interface AnnotationCoverageConfig {
  artifact: string;
  relationType: AnnotationRelationType;
  description: string;
  contentPatterns?: RegExp[];
}

export function annotationCoverage<T extends { id: string }>(
  config: AnnotationCoverageConfig,
): CoverageChecker<T> {
  return {
    targetModel: 'annotation',
    description: config.description,
    check: (specs, _registry): CoverageResult => {
      const basePath = process.cwd();
      const allSpecIds = new Set(specs.map((s) => s.id));
      const coveredIds = new Set<string>();

      const artifactsConfig = getArtifactsConfig();
      const artifactConfig = artifactsConfig?.[config.artifact];
      if (!artifactConfig) {
        return {
          total: allSpecIds.size,
          covered: 0,
          uncovered: allSpecIds.size,
          coveragePercent: 0,
          coveredItems: [],
          uncoveredItems: Array.from(allSpecIds).map((id) => ({ id })),
        };
      }

      const allFiles = new Set<string>();
      for (const pattern of artifactConfig.globs) {
        const found = glob.sync(pattern, {
          cwd: basePath,
          ignore: artifactConfig.exclude ?? [],
        });
        for (const f of found) {
          allFiles.add(f);
        }
      }

      const patterns =
        config.contentPatterns ??
        artifactConfig.contentPatterns ??
        [getDefaultPatternForRelation(config.relationType)];

      const patternList = Array.isArray(patterns) ? patterns : [patterns];

      for (const filePath of allFiles) {
        const fullPath = join(basePath, filePath);
        let content: string;
        try {
          content = readFileSync(fullPath, 'utf-8');
        } catch {
          continue;
        }

        const lines = content.split('\n');
        for (const line of lines) {
          for (const re of patternList) {
            const copy = new RegExp(re.source, re.flags);
            let m: RegExpExecArray | null;
            while ((m = copy.exec(line)) !== null) {
              const ids = extractSpecIds(m[1] ?? '');
              for (const id of ids) {
                if (allSpecIds.has(id)) {
                  coveredIds.add(id);
                }
              }
            }
          }
        }
      }

      const coveredItems = Array.from(coveredIds).map((id) => ({ id }));
      const uncoveredItems = Array.from(allSpecIds)
        .filter((id) => !coveredIds.has(id))
        .map((id) => ({ id }));

      const total = allSpecIds.size;
      const covered = coveredItems.length;
      const coveragePercent = total > 0 ? Math.round((covered / total) * 100) : 100;

      return {
        total,
        covered,
        uncovered: total - covered,
        coveragePercent,
        coveredItems,
        uncoveredItems,
      };
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
