/**
 * Edge label controlled vocabulary (logic-driven)
 *
 * Only edges that trigger specific speckeeper logic are defined here.
 * Other speckeeper↔speckeeper edges use generic reference integrity.
 */
import type {
  EdgeVocabularyEntry,
  MermaidEdge,
  MermaidNode,
  ResolvedEdge,
  ScaffoldDiagnostic,
} from './types.js';

// ---------------------------------------------------------------------------
// Vocabulary definitions
// ---------------------------------------------------------------------------

/**
 * Speckeeper-managed vocabulary — labels that trigger specific logic.
 *
 * - implements (check): speckeeper → external SSOT, triggers external checker
 * - verifiedBy (check): speckeeper → external test, triggers test checker
 * - refines (lint): speckeeper → speckeeper, reference integrity + level constraint
 * - All other speckeeper↔speckeeper edges: generic reference integrity (lint)
 */
export const EDGE_VOCABULARY: EdgeVocabularyEntry[] = [
  // check: speckeeper → external SSOT
  {
    label: 'implements',
    expectedDirection: 'forward',
    relationType: 'implements',
    category: 'check',
    description: 'Spec is implemented as external artifact (OpenAPI, DDL, etc.)',
  },
  {
    label: 'verifiedBy',
    expectedDirection: 'forward',
    relationType: 'verifiedBy',
    category: 'check',
    description: 'Spec is verified by external test code',
  },

  // lint: speckeeper ↔ speckeeper with level constraint
  {
    label: 'refines',
    expectedDirection: 'forward',
    relationType: 'refines',
    category: 'lint',
    description: 'Decompose higher-level item into lower-level detail',
  },

  // lint: speckeeper ↔ speckeeper generic reference integrity
  {
    label: 'relatedTo',
    expectedDirection: 'bidirectional',
    relationType: 'relatedTo',
    category: 'lint',
    description: 'Bidirectional association or consistency constraint',
  },
  {
    label: 'uses',
    expectedDirection: 'forward',
    relationType: 'uses',
    category: 'lint',
    description: 'Reference / dependency',
  },
  {
    label: 'dependsOn',
    expectedDirection: 'forward',
    relationType: 'dependsOn',
    category: 'lint',
    description: 'Dependency relationship',
  },
  {
    label: 'satisfies',
    expectedDirection: 'forward',
    relationType: 'satisfies',
    category: 'lint',
    description: 'Satisfies business/requirements',
  },
  {
    label: 'includes',
    expectedDirection: 'forward',
    relationType: 'includes',
    category: 'lint',
    description: 'Parent contains child items',
  },
  {
    label: 'traces',
    expectedDirection: 'forward',
    relationType: 'traces',
    category: 'lint',
    description: 'Derive target from source',
  },

  // external: test code → implementation code (no checker generated)
  {
    label: 'verifies',
    expectedDirection: 'forward',
    relationType: 'verifies',
    category: 'external',
    description: 'Test code tests implementation code (external → external, no checker)',
  },
];

/**
 * Well-known labels for edges between non-speckeeper nodes.
 */
export const EXTERNAL_LABELS: EdgeVocabularyEntry[] = [
  {
    label: 'generate',
    expectedDirection: 'forward',
    relationType: undefined,
    category: 'drift',
    description: 'Automated generation (external tool)',
  },
  {
    label: 'apply',
    expectedDirection: 'forward',
    relationType: undefined,
    category: 'external',
    description: 'Apply to external system',
  },
  {
    label: 'deploy',
    expectedDirection: 'forward',
    relationType: undefined,
    category: 'external',
    description: 'Deploy artifact',
  },
];

const ALL_VOCABULARY = [...EDGE_VOCABULARY, ...EXTERNAL_LABELS];

const SORTED_VOCABULARY = [...ALL_VOCABULARY].sort(
  (a, b) => b.label.length - a.label.length,
);

const SORTED_SPECKEEPER_VOCABULARY = [...EDGE_VOCABULARY].sort(
  (a, b) => b.label.length - a.label.length,
);

// ---------------------------------------------------------------------------
// Label normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a raw edge label to its canonical vocabulary entry.
 */
export function normalizeLabel(
  rawLabel: string | undefined,
  vocabulary: EdgeVocabularyEntry[] = SORTED_VOCABULARY,
): { entry: EdgeVocabularyEntry; modifier: string | undefined } | null {
  if (!rawLabel) return null;

  const lower = rawLabel.toLowerCase().trim();

  for (const entry of vocabulary) {
    if (lower === entry.label.toLowerCase()) {
      return { entry, modifier: undefined };
    }
  }

  for (const entry of vocabulary) {
    const entryLower = entry.label.toLowerCase();
    if (lower.endsWith(entryLower)) {
      const mod = rawLabel.slice(0, rawLabel.length - entry.label.length).trim();
      return { entry, modifier: mod || undefined };
    }
  }

  for (const entry of vocabulary) {
    const entryLower = entry.label.toLowerCase();
    if (lower.includes(entryLower)) {
      const idx = lower.indexOf(entryLower);
      const before = rawLabel.slice(0, idx).trim();
      const after = rawLabel.slice(idx + entry.label.length).trim();
      const mod = [before, after].filter(Boolean).join(' ');
      return { entry, modifier: mod || undefined };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Edge resolution
// ---------------------------------------------------------------------------

/** Known test-like node classes */
const TEST_CLASSES = new Set(['test', 'e2e-test', 'unit-test', 'integration-test']);

function isTestLikeByClass(node: MermaidNode | undefined): boolean {
  if (!node) return false;
  return node.classes.some(c => TEST_CLASSES.has(c) || c.includes('test'));
}

/**
 * Resolve raw edges to vocabulary-backed ResolvedEdges,
 * collecting diagnostics along the way.
 */
export function resolveEdges(
  edges: MermaidEdge[],
  nodes: Map<string, MermaidNode>,
  speckeeperClassName: string,
): { resolved: ResolvedEdge[]; diagnostics: ScaffoldDiagnostic[] } {
  const diagnostics: ScaffoldDiagnostic[] = [];
  const resolved: ResolvedEdge[] = [];

  const isSpk = (id: string): boolean =>
    nodes.get(id)?.classes.includes(speckeeperClassName) ?? false;

  const fallback = EDGE_VOCABULARY.find(v => v.label === 'relatedTo')!;

  for (const edge of edges) {
    const involvesSpeckeeper = isSpk(edge.sourceId) || isSpk(edge.targetId);

    const norm = normalizeLabel(edge.rawLabel);

    if (!norm) {
      if (involvesSpeckeeper) {
        diagnostics.push({
          severity: 'warning',
          message: `Edge label "${edge.rawLabel}" is not a valid speckeeper RelationType — falling back to "relatedTo"`,
          context: `${edge.sourceId} → ${edge.targetId}`,
        });
        resolved.push({
          ...edge,
          normalizedLabel: 'relatedTo',
          vocabulary: fallback,
          modifier: undefined,
        });
      } else {
        resolved.push({
          ...edge,
          normalizedLabel: edge.rawLabel ?? '',
          vocabulary: { label: edge.rawLabel ?? '', expectedDirection: 'forward', relationType: undefined, category: 'external', description: '' },
          modifier: undefined,
        });
      }
      continue;
    }

    if (involvesSpeckeeper && !norm.entry.relationType) {
      const spkNorm = normalizeLabel(edge.rawLabel, SORTED_SPECKEEPER_VOCABULARY);
      if (!spkNorm) {
        diagnostics.push({
          severity: 'warning',
          message: `Edge label "${edge.rawLabel}" is not a valid speckeeper RelationType — falling back to "relatedTo"`,
          context: `${edge.sourceId} → ${edge.targetId}`,
        });
        resolved.push({
          ...edge,
          normalizedLabel: 'relatedTo',
          vocabulary: fallback,
          modifier: undefined,
        });
        continue;
      }
    }

    resolved.push({
      ...edge,
      normalizedLabel: norm.entry.label,
      vocabulary: norm.entry,
      modifier: norm.modifier,
    });

    // Validate arrow direction
    if (involvesSpeckeeper && edge.direction !== norm.entry.expectedDirection) {
      const expected = norm.entry.expectedDirection === 'bidirectional' ? '<-->' : '-->';
      diagnostics.push({
        severity: 'warning',
        message: `"${norm.entry.label}" expects ${expected} arrow but got ${edge.direction === 'bidirectional' ? '<-->' : '-->'}`,
        context: `${edge.sourceId} → ${edge.targetId}`,
      });
    }

    // Validate: "implements" should be speckeeper → external only
    if (norm.entry.label === 'implements') {
      if (isSpk(edge.sourceId) && isSpk(edge.targetId)) {
        diagnostics.push({
          severity: 'warning',
          message: '"implements" should be speckeeper → external; consider using "refines" for speckeeper → speckeeper edges',
          context: `${edge.sourceId} → ${edge.targetId}`,
        });
      }
    }

    // Validate: "verifiedBy" should be speckeeper → external only
    if (norm.entry.label === 'verifiedBy') {
      if (isSpk(edge.sourceId) && isSpk(edge.targetId)) {
        diagnostics.push({
          severity: 'warning',
          message: '"verifiedBy" should be speckeeper → external; it represents verification by external test code',
          context: `${edge.sourceId} → ${edge.targetId}`,
        });
      }

      // Warn if target is not a test-like node
      const targetNode = nodes.get(edge.targetId);
      if (targetNode && !isTestLikeByClass(targetNode)) {
        const targetId = edge.targetId.toUpperCase();
        const looksLikeTest = ['UT', 'IT', 'DUT', 'E2ET'].includes(targetId) ||
          targetId.includes('TEST') ||
          (targetNode.label ?? '').toLowerCase().includes('test');
        if (!looksLikeTest) {
          diagnostics.push({
            severity: 'warning',
            message: `"verifiedBy" target "${edge.targetId}" does not appear to be a test node; verifiedBy is intended for test targets`,
            context: `${edge.sourceId} → ${edge.targetId}`,
          });
        }
      }
    }
  }

  return { resolved, diagnostics };
}

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

export function isLintEdge(entry: EdgeVocabularyEntry): boolean {
  return entry.category === 'lint';
}

export function isCheckEdge(entry: EdgeVocabularyEntry): boolean {
  return entry.category === 'check';
}

export function isCoverageEdge(entry: EdgeVocabularyEntry): boolean {
  return entry.category === 'coverage';
}

export function isDriftEdge(entry: EdgeVocabularyEntry): boolean {
  return entry.category === 'drift';
}

/**
 * Determine whether a node is test-like (by ID, label, or class).
 */
export function isTestLikeNode(node: MermaidNode | undefined): boolean {
  if (!node) return false;
  if (isTestLikeByClass(node)) return true;
  const id = node.id.toUpperCase();
  const testIds = ['UT', 'IT', 'DUT', 'E2ET'];
  if (testIds.includes(id)) return true;
  if (id.includes('TEST')) return true;
  const label = (node.label ?? '').toLowerCase();
  if (label.includes('テスト') || label.includes('test')) return true;
  return false;
}
