/**
 * External Insight Provider for agent-contracts-analyzer integration.
 * Exposes spec relation edges from speckeeper design specs.
 */
import { readFileSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AnchorMapping,
  ExternalEdge,
  ExternalEvidence,
  ExternalInsight,
  InsightProvider,
  InsightQuery,
  SymbolAnchor,
} from './analyzer-types.js';
import {
  buildRegistryFromConfig,
  type Relation,
  type SpecEntry,
} from '../core/model.js';
import {
  RELATION_CONSTRAINTS,
  type RelationType,
} from '../core/relation.js';
import { loadConfig } from '../utils/config-loader.js';

// ============================================================================
// Types
// ============================================================================

interface SpecWithRelations {
  id: string;
  relations?: Relation[];
  _sourceFile?: string;
  source?: { path?: string };
}

export interface RelationLocation {
  line: number;
  endLine: number;
}

// ============================================================================
// Provider
// ============================================================================

export class SpeckeeperInsightProvider implements InsightProvider {
  readonly name = 'speckeeper';

  constructor(private readonly configPath?: string) {}

  async provide(query: InsightQuery): Promise<ExternalInsight> {
    const projectRoot = resolve(query.projectRoot);
    const config = await loadConfig(this.configPath, projectRoot);
    const edges: ExternalEdge[] = [];
    const anchorBySpecId = new Map<string, AnchorMapping>();

    if (!config.specs) {
      return this.buildInsight(edges, []);
    }

    const registry = buildRegistryFromConfig(config.specs);
    collectEdgesAndAnchors(config.specs, registry, projectRoot, edges, anchorBySpecId);

    return this.buildInsight(edges, Array.from(anchorBySpecId.values()));
  }

  private buildInsight(
    edges: ExternalEdge[],
    anchorMapping: AnchorMapping[],
  ): ExternalInsight {
    return {
      source: 'speckeeper',
      sourceVersion: getSpeckeeperVersion(),
      generatedAt: new Date().toISOString(),
      edges,
      anchorMapping: anchorMapping.length > 0 ? anchorMapping : undefined,
    };
  }
}

export function createSpeckeeperInsightProvider(
  configPath?: string,
): SpeckeeperInsightProvider {
  return new SpeckeeperInsightProvider(configPath);
}

// ============================================================================
// Edge & anchor collection
// ============================================================================

function collectEdgesAndAnchors(
  specs: SpecEntry[],
  registry: Record<string, Map<string, unknown>>,
  projectRoot: string,
  edges: ExternalEdge[],
  anchorBySpecId: Map<string, AnchorMapping>,
): void {
  for (const entry of specs) {
    for (const raw of entry.data) {
      const spec = raw as SpecWithRelations;
      if (!spec.id) continue;

      const sourceFile = spec._sourceFile
        ? relative(projectRoot, resolve(projectRoot, spec._sourceFile))
        : undefined;

      upsertAnchor(anchorBySpecId, spec, sourceFile, projectRoot);

      if (!spec.relations?.length) continue;

      for (const relation of spec.relations) {
        const constraint = RELATION_CONSTRAINTS[relation.type as RelationType];
        const propagation = constraint?.propagation ?? 'both';
        const location = sourceFile
          ? findRelationLocation(sourceFile, spec.id, relation, projectRoot)
          : undefined;

        const evidence: ExternalEvidence = {
          kind: 'spec_relation',
          detail: formatRelationDetail(spec.id, relation),
          ...(sourceFile ? { filePath: sourceFile } : {}),
          ...(location ? { line: location.line, endLine: location.endLine } : {}),
        };

        edges.push({
          from: spec.id,
          to: relation.target,
          kind: relation.type,
          propagation,
          weight: 0.7,
          evidence: [evidence],
        });
      }
    }
  }

  // Ensure anchor entries exist for relation targets present in registry
  for (const [, map] of Object.entries(registry)) {
    for (const [, raw] of map) {
      const spec = raw as SpecWithRelations;
      if (!spec.id || anchorBySpecId.has(spec.id)) continue;
      const sourceFile = spec._sourceFile
        ? relative(projectRoot, resolve(projectRoot, spec._sourceFile))
        : undefined;
      upsertAnchor(anchorBySpecId, spec, sourceFile, projectRoot);
    }
  }
}

function upsertAnchor(
  anchorBySpecId: Map<string, AnchorMapping>,
  spec: SpecWithRelations,
  sourceFile: string | undefined,
  projectRoot: string,
): void {
  const filePaths = new Set<string>();
  if (sourceFile) filePaths.add(sourceFile);
  if (spec.source?.path) {
    filePaths.add(relative(projectRoot, resolve(projectRoot, spec.source.path)));
  }

  const symbols = extractSymbolAnchors(spec, projectRoot);

  if (filePaths.size === 0 && symbols.length === 0) return;

  anchorBySpecId.set(spec.id, {
    domainId: spec.id,
    filePaths: [...filePaths],
    ...(symbols.length > 0 ? { symbols } : {}),
  });
}

function extractSymbolAnchors(
  spec: SpecWithRelations,
  projectRoot: string,
): SymbolAnchor[] {
  const path = spec.source?.path;
  if (!path) return [];

  const filePath = relative(projectRoot, resolve(projectRoot, path));
  return [
    {
      symbolId: spec.id,
      filePath,
      startLine: 1,
      endLine: 1,
    },
  ];
}

function formatRelationDetail(specId: string, relation: Relation): string {
  const desc = relation.description ? ` (${relation.description})` : '';
  return `${specId} --[${relation.type}]--> ${relation.target}${desc}`;
}

// ============================================================================
// Relation location in YAML/JSON source
// ============================================================================

export function findRelationLocation(
  sourceFile: string,
  specId: string,
  relation: Relation,
  projectRoot: string,
): RelationLocation | undefined {
  const absPath = resolve(projectRoot, sourceFile);
  let content: string;
  try {
    content = readFileSync(absPath, 'utf-8');
  } catch {
    return undefined;
  }

  const lines = content.split('\n');
  const specStart = findSpecBlockStart(lines, specId);
  if (specStart < 0) return undefined;

  const relationsStart = findRelationsSectionStart(lines, specStart);
  if (relationsStart < 0) return undefined;

  const specEnd = findNextSpecBoundary(lines, specStart);
  const searchEnd = specEnd >= 0 ? specEnd : lines.length;

  for (let i = relationsStart; i < searchEnd; i++) {
    const line = lines[i];
    if (!line.includes(`target: ${relation.target}`)) continue;

    const blockStart = findRelationBlockStart(lines, i, relationsStart);
    const blockLines = collectRelationBlock(lines, blockStart, searchEnd);
    const blockText = blockLines.join('\n');

    if (
      blockText.includes(`type: ${relation.type}`) &&
      blockText.includes(`target: ${relation.target}`)
    ) {
      return {
        line: blockStart + 1,
        endLine: blockStart + blockLines.length,
      };
    }
  }

  return undefined;
}

function findSpecBlockStart(lines: string[], specId: string): number {
  const idPattern = new RegExp(`^\\s*-?\\s*id:\\s*${escapeRegExp(specId)}\\s*$`);
  for (let i = 0; i < lines.length; i++) {
    if (idPattern.test(lines[i])) return i;
  }
  return -1;
}

function findRelationsSectionStart(lines: string[], fromLine: number): number {
  for (let i = fromLine; i < lines.length; i++) {
    if (/^\s*relations:\s*$/.test(lines[i])) return i;
    if (i > fromLine && /^\s*-?\s*id:\s+\S+/.test(lines[i])) return -1;
  }
  return -1;
}

function findNextSpecBoundary(lines: string[], specStart: number): number {
  for (let i = specStart + 1; i < lines.length; i++) {
    if (/^\s*-?\s*id:\s+\S+/.test(lines[i])) return i;
  }
  return -1;
}

function findRelationBlockStart(
  lines: string[],
  targetLine: number,
  relationsStart: number,
): number {
  for (let i = targetLine; i >= relationsStart; i--) {
    if (/^\s*-\s+type:/.test(lines[i])) return i;
  }
  return targetLine;
}

function collectRelationBlock(
  lines: string[],
  start: number,
  searchEnd: number,
): string[] {
  const block: string[] = [lines[start]];
  const baseIndent = lines[start].match(/^(\s*)/)?.[1]?.length ?? 0;

  for (let i = start + 1; i < searchEnd; i++) {
    const line = lines[i];
    if (/^\s*-\s+type:/.test(line)) break;
    const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
    if (line.trim() !== '' && indent <= baseIndent) break;
    block.push(line);
  }

  return block;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSpeckeeperVersion(): string | undefined {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(dir, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version;
  } catch {
    return undefined;
  }
}
