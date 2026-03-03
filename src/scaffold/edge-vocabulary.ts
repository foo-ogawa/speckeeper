/**
 * Edge label controlled vocabulary
 *
 * Edge labels for speckeeper-managed nodes must match speckeeper's
 * RELATION_TYPES. Labels between non-speckeeper nodes are free text.
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
 * Speckeeper-managed vocabulary — labels match RELATION_TYPES exactly.
 * Used for edges involving at least one speckeeper-managed node.
 */
export const EDGE_VOCABULARY: EdgeVocabularyEntry[] = [
  // A. lint targets (speckeeper ↔ speckeeper reference integrity)
  {
    label: 'refines',
    expectedDirection: 'forward',
    relationType: 'refines',
    category: 'lint',
    description: 'Decompose higher-level item into lower-level detail',
  },
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

  // B. check targets (speckeeper → external SSOT)
  {
    label: 'implements',
    expectedDirection: 'forward',
    relationType: 'implements',
    category: 'check',
    description: 'Realize speckeeper spec as external artifact, interface, or test',
  },

  // C. coverage targets
  {
    label: 'includes',
    expectedDirection: 'forward',
    relationType: 'includes',
    category: 'coverage',
    description: 'Parent contains child items',
  },
  {
    label: 'traces',
    expectedDirection: 'forward',
    relationType: 'traces',
    category: 'coverage',
    description: 'Derive target from source',
  },
  {
    label: 'verifies',
    expectedDirection: 'forward',
    relationType: 'verifies',
    category: 'coverage',
    description: 'Test verifies target',
  },

  // Additional RELATION_TYPES (usable but no special scaffold behaviour)
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
];

/**
 * Well-known labels for edges between non-speckeeper nodes.
 * These are not validated — any label is accepted for external-only edges.
 * Listed here so scaffold can recognise and categorise them.
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
 *
 * 1. Exact match (case-insensitive)
 * 2. Label ends with a vocabulary entry (longest match wins)
 * 3. Label contains a vocabulary entry (longest match wins)
 * 4. null if no match
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

    // Try to normalise against the full vocabulary
    const norm = normalizeLabel(edge.rawLabel);

    if (!norm) {
      if (involvesSpeckeeper) {
        // Edge involves speckeeper node but label doesn't match any RelationType
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
        // Both nodes are external — free text label, skip validation
        resolved.push({
          ...edge,
          normalizedLabel: edge.rawLabel ?? '',
          vocabulary: { label: edge.rawLabel ?? '', expectedDirection: 'forward', relationType: undefined, category: 'external', description: '' },
          modifier: undefined,
        });
      }
      continue;
    }

    // If the edge involves a speckeeper node, the label must be a RelationType
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

    // Validate arrow direction (only for speckeeper-involved edges)
    if (involvesSpeckeeper && edge.direction !== norm.entry.expectedDirection) {
      const expected = norm.entry.expectedDirection === 'bidirectional' ? '<-->' : '-->';
      diagnostics.push({
        severity: 'warning',
        message: `"${norm.entry.label}" expects ${expected} arrow but got ${edge.direction === 'bidirectional' ? '<-->' : '-->'}`,
        context: `${edge.sourceId} → ${edge.targetId}`,
      });
    }

    // Validate: "implements" should not be speckeeper → speckeeper
    if (norm.entry.label === 'implements') {
      if (isSpk(edge.sourceId) && isSpk(edge.targetId)) {
        diagnostics.push({
          severity: 'warning',
          message: '"implements" should be speckeeper → external; consider using "refines" for speckeeper → speckeeper edges',
          context: `${edge.sourceId} → ${edge.targetId}`,
        });
      }
    }

    // Validate: "includes" and "traces" should be speckeeper → speckeeper
    if (norm.entry.label === 'includes' || norm.entry.label === 'traces') {
      if (!isSpk(edge.sourceId) || !isSpk(edge.targetId)) {
        diagnostics.push({
          severity: 'warning',
          message: `"${norm.entry.label}" should connect two speckeeper-managed nodes`,
          context: `${edge.sourceId} → ${edge.targetId}`,
        });
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
 * Determine whether an "implements" edge should generate a coverage checker
 * (target is a test-like node) rather than an external checker.
 */
export function isTestLikeNode(node: MermaidNode | undefined): boolean {
  if (!node) return false;
  const id = node.id.toUpperCase();
  const testIds = ['UT', 'IT', 'DUT', 'E2ET'];
  if (testIds.includes(id)) return true;
  if (id.includes('TEST')) return true;
  const label = (node.label ?? '').toLowerCase();
  if (label.includes('テスト') || label.includes('test')) return true;
  return false;
}
