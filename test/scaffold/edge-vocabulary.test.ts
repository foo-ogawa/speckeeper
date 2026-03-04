import { describe, it, expect } from 'vitest';
import {
  EDGE_VOCABULARY,
  normalizeLabel,
  resolveEdges,
  isCheckEdge,
  isLintEdge,
  isDriftEdge,
  isTestLikeNode,
} from '../../src/scaffold/edge-vocabulary.js';
import type { MermaidEdge, MermaidNode } from '../../src/scaffold/types.js';

function makeNode(id: string, classes: string[], label?: string): MermaidNode {
  return { id, label: label ?? id, classes } as MermaidNode;
}

function makeEdge(
  sourceId: string,
  targetId: string,
  rawLabel: string,
  direction: 'forward' | 'bidirectional' = 'forward',
): MermaidEdge {
  return { sourceId, targetId, rawLabel, direction };
}

// ---------------------------------------------------------------------------
// Vocabulary structure
// ---------------------------------------------------------------------------

describe('EDGE_VOCABULARY', () => {
  it('contains verifiedBy as check category', () => {
    const entry = EDGE_VOCABULARY.find(v => v.label === 'verifiedBy');
    expect(entry).toBeDefined();
    expect(entry!.category).toBe('check');
    expect(entry!.relationType).toBe('verifiedBy');
  });

  it('contains implements as check category', () => {
    const entry = EDGE_VOCABULARY.find(v => v.label === 'implements');
    expect(entry).toBeDefined();
    expect(entry!.category).toBe('check');
  });

  it('contains verifies as external category', () => {
    const entry = EDGE_VOCABULARY.find(v => v.label === 'verifies');
    expect(entry).toBeDefined();
    expect(entry!.category).toBe('external');
    expect(entry!.description).toContain('no checker');
  });

  it('contains refines as lint category', () => {
    const entry = EDGE_VOCABULARY.find(v => v.label === 'refines');
    expect(entry).toBeDefined();
    expect(entry!.category).toBe('lint');
  });

  it('has minimized entries — all with relationType', () => {
    for (const entry of EDGE_VOCABULARY) {
      expect(entry.relationType).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

describe('category helpers', () => {
  it('isCheckEdge identifies check entries', () => {
    const impl = EDGE_VOCABULARY.find(v => v.label === 'implements')!;
    const vBy = EDGE_VOCABULARY.find(v => v.label === 'verifiedBy')!;
    expect(isCheckEdge(impl)).toBe(true);
    expect(isCheckEdge(vBy)).toBe(true);
  });

  it('isLintEdge identifies lint entries', () => {
    const refines = EDGE_VOCABULARY.find(v => v.label === 'refines')!;
    expect(isLintEdge(refines)).toBe(true);
  });

  it('isDriftEdge returns false for non-drift entries', () => {
    const impl = EDGE_VOCABULARY.find(v => v.label === 'implements')!;
    expect(isDriftEdge(impl)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Label normalisation
// ---------------------------------------------------------------------------

describe('normalizeLabel', () => {
  it('matches exact vocabulary label', () => {
    const result = normalizeLabel('verifiedBy');
    expect(result).not.toBeNull();
    expect(result!.entry.label).toBe('verifiedBy');
  });

  it('matches case-insensitively', () => {
    const result = normalizeLabel('IMPLEMENTS');
    expect(result).not.toBeNull();
    expect(result!.entry.label).toBe('implements');
  });

  it('returns null for unknown label', () => {
    const result = normalizeLabel('totallyUnknownLabel');
    expect(result).toBeNull();
  });

  it('returns null for undefined', () => {
    const result = normalizeLabel(undefined);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Edge resolution with diagnostics
// ---------------------------------------------------------------------------

describe('resolveEdges', () => {
  it('resolves known label between speckeeper nodes', () => {
    const nodes = new Map<string, MermaidNode>();
    nodes.set('FR', makeNode('FR', ['speckeeper']));
    nodes.set('UC', makeNode('UC', ['speckeeper']));

    const edges: MermaidEdge[] = [makeEdge('FR', 'UC', 'satisfies')];
    const { resolved, diagnostics } = resolveEdges(edges, nodes, 'speckeeper');

    expect(resolved).toHaveLength(1);
    expect(resolved[0].normalizedLabel).toBe('satisfies');
    expect(diagnostics).toHaveLength(0);
  });

  it('falls back to relatedTo for unknown label on speckeeper edge', () => {
    const nodes = new Map<string, MermaidNode>();
    nodes.set('FR', makeNode('FR', ['speckeeper']));
    nodes.set('UC', makeNode('UC', ['speckeeper']));

    const edges: MermaidEdge[] = [makeEdge('FR', 'UC', 'unknownRelation')];
    const { resolved, diagnostics } = resolveEdges(edges, nodes, 'speckeeper');

    expect(resolved).toHaveLength(1);
    expect(resolved[0].normalizedLabel).toBe('relatedTo');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('warning');
  });

  it('warns when implements is speckeeper→speckeeper', () => {
    const nodes = new Map<string, MermaidNode>();
    nodes.set('FR', makeNode('FR', ['speckeeper']));
    nodes.set('SR', makeNode('SR', ['speckeeper']));

    const edges: MermaidEdge[] = [makeEdge('FR', 'SR', 'implements')];
    const { diagnostics } = resolveEdges(edges, nodes, 'speckeeper');

    const implWarning = diagnostics.find(d => d.message.includes('"implements" should be speckeeper → external'));
    expect(implWarning).toBeDefined();
  });

  it('warns when verifiedBy is speckeeper→speckeeper', () => {
    const nodes = new Map<string, MermaidNode>();
    nodes.set('FR', makeNode('FR', ['speckeeper']));
    nodes.set('SR', makeNode('SR', ['speckeeper']));

    const edges: MermaidEdge[] = [makeEdge('FR', 'SR', 'verifiedBy')];
    const { diagnostics } = resolveEdges(edges, nodes, 'speckeeper');

    const vByWarning = diagnostics.find(d => d.message.includes('"verifiedBy" should be speckeeper → external'));
    expect(vByWarning).toBeDefined();
  });

  it('warns when verifiedBy target is not a test-like node', () => {
    const nodes = new Map<string, MermaidNode>();
    nodes.set('FR', makeNode('FR', ['speckeeper']));
    nodes.set('API', makeNode('API', ['openapi'], 'OpenAPI spec'));

    const edges: MermaidEdge[] = [makeEdge('FR', 'API', 'verifiedBy')];
    const { diagnostics } = resolveEdges(edges, nodes, 'speckeeper');

    const targetWarning = diagnostics.find(d => d.message.includes('does not appear to be a test node'));
    expect(targetWarning).toBeDefined();
  });

  it('does not warn when verifiedBy target is a test class', () => {
    const nodes = new Map<string, MermaidNode>();
    nodes.set('FR', makeNode('FR', ['speckeeper']));
    nodes.set('UT', makeNode('UT', ['test'], 'Unit Tests'));

    const edges: MermaidEdge[] = [makeEdge('FR', 'UT', 'verifiedBy')];
    const { diagnostics } = resolveEdges(edges, nodes, 'speckeeper');

    const targetWarning = diagnostics.find(d => d.message.includes('does not appear to be a test node'));
    expect(targetWarning).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Test-like node detection
// ---------------------------------------------------------------------------

describe('isTestLikeNode', () => {
  it('returns true for node with test class', () => {
    expect(isTestLikeNode(makeNode('UT', ['test']))).toBe(true);
  });

  it('returns true for node with e2e-test class', () => {
    expect(isTestLikeNode(makeNode('E2E', ['e2e-test']))).toBe(true);
  });

  it('returns true for node ID UT', () => {
    expect(isTestLikeNode(makeNode('UT', []))).toBe(true);
  });

  it('returns true for node ID containing TEST', () => {
    expect(isTestLikeNode(makeNode('MYTEST', []))).toBe(true);
  });

  it('returns true for node with test in label', () => {
    expect(isTestLikeNode(makeNode('X', [], 'Unit test'))).toBe(true);
  });

  it('returns false for regular node', () => {
    expect(isTestLikeNode(makeNode('API', ['openapi'], 'OpenAPI spec'))).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isTestLikeNode(undefined)).toBe(false);
  });
});
