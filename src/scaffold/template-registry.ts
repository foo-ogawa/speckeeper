/**
 * Template registry
 *
 * Resolves mermaid node classes to model template info.
 * All classes use the common base template (FR-SCF-028).
 * Class name is used only for model name / file name derivation
 * and node grouping — no class-specific templates exist.
 */

import type { ModelLevel } from '../core/relation.js';

// ---------------------------------------------------------------------------
// Model template metadata
// ---------------------------------------------------------------------------

export interface ModelTemplateInfo {
  /** Template identifier — always 'base' (FR-SCF-028) */
  templateName: 'base';
  /** Default model level (inferred from subgraph) */
  defaultLevel: ModelLevel;
  /** ID prefix for spec instances (= node ID) */
  defaultIdPrefix: string;
  /** Human-readable model name (PascalCase) */
  modelName: string;
  /** kebab-case file name (without .ts) */
  fileName: string;
}

// ---------------------------------------------------------------------------
// Subgraph → Level inference
// ---------------------------------------------------------------------------

const LEVEL_PATTERNS: Array<{ pattern: RegExp; level: ModelLevel }> = [
  { pattern: /^L0$|business|domain/i, level: 'L0' },
  { pattern: /^L1$|requirement/i, level: 'L1' },
  { pattern: /^L2$|design|architecture/i, level: 'L2' },
  { pattern: /^L3$|implementation|external/i, level: 'L3' },
];

export function inferLevelFromSubgraph(subgraphId: string | undefined): ModelLevel {
  if (!subgraphId) return 'L0';
  for (const { pattern, level } of LEVEL_PATTERNS) {
    if (pattern.test(subgraphId)) return level;
  }
  return 'L0';
}

// ---------------------------------------------------------------------------
// Class-based resolution
// ---------------------------------------------------------------------------

const SPECKEEPER_CLASS = 'speckeeper';

/**
 * Resolve a mermaid node to a model template.
 *
 * Always uses the base template (FR-SCF-028). The artifact class
 * (first non-speckeeper class) determines only model name and file name.
 * Level is inferred from subgraph membership.
 */
export function resolveModelTemplate(
  nodeId: string,
  nodeClasses?: string[],
  subgraphId?: string,
): ModelTemplateInfo {
  const level = inferLevelFromSubgraph(subgraphId);

  const artifactClass = nodeClasses
    ?.find(c => c !== SPECKEEPER_CLASS);

  if (!artifactClass) {
    return {
      templateName: 'base',
      defaultLevel: level,
      defaultIdPrefix: nodeId,
      modelName: toPascalCase(nodeId),
      fileName: toKebabCase(nodeId),
    };
  }

  return {
    templateName: 'base',
    defaultLevel: level,
    defaultIdPrefix: nodeId,
    modelName: toPascalCase(artifactClass),
    fileName: toKebabCase(artifactClass),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPascalCase(s: string): string {
  return s
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function toKebabCase(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}
