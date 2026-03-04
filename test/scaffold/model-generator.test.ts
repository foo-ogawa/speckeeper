import { describe, it, expect } from 'vitest';
import type { MermaidNode, ResolvedEdge } from '../../src/scaffold/types.js';
import {
  generateModelFile,
  generateAllModelFiles,
  resolveCheckerBindings,
} from '../../src/scaffold/model-generator.js';

function makeNode(id: string, classes: string[], opts?: Partial<MermaidNode>): MermaidNode {
  return { id, label: opts?.label ?? id, classes, subgraph: opts?.subgraph, ...opts } as MermaidNode;
}

function makeEdge(
  sourceId: string,
  targetId: string,
  label: string,
  category: 'check' | 'lint' | 'external' = 'check',
): ResolvedEdge {
  return {
    sourceId,
    targetId,
    rawLabel: label,
    direction: 'forward',
    normalizedLabel: label,
    vocabulary: {
      label,
      expectedDirection: 'forward',
      relationType: label,
      category,
      description: '',
    },
    modifier: undefined,
  };
}

describe('generateModelFile', () => {
  it('generates base template for any class with core factory imports', () => {
    const node = makeNode('FR', ['speckeeper', 'requirement']);
    const result = generateModelFile(node, [], []);
    expect(result.relativePath).toBe('_models/requirement.ts');
    expect(result.content).toContain("from 'speckeeper/dsl'");
    expect(result.content).toContain('requireField');
  });

  it('generates base template with requireField factory', () => {
    const node = makeNode('Custom', ['speckeeper']);
    const result = generateModelFile(node, [], []);
    expect(result.relativePath).toBe('_models/custom.ts');
    expect(result.content).toContain("from 'speckeeper/dsl'");
    expect(result.content).toContain('requireField');
  });

  it('appends checker binding comments for implements edge', () => {
    const nodes = new Map<string, MermaidNode>();
    const fr = makeNode('FR', ['speckeeper', 'requirement']);
    const api = makeNode('API', ['openapi']);
    nodes.set('FR', fr);
    nodes.set('API', api);

    const edge = makeEdge('FR', 'API', 'implements');
    const result = generateModelFile(fr, [], [edge], nodes);
    expect(result.content).toContain('Checker Bindings');
    expect(result.content).toContain('externalOpenAPIChecker');
  });

  it('appends checker binding comments for verifiedBy edge', () => {
    const nodes = new Map<string, MermaidNode>();
    const fr = makeNode('FR', ['speckeeper', 'requirement']);
    const ut = makeNode('UT', ['test']);
    nodes.set('FR', fr);
    nodes.set('UT', ut);

    const edge = makeEdge('FR', 'UT', 'verifiedBy');
    const result = generateModelFile(fr, [], [edge], nodes);
    expect(result.content).toContain('Checker Bindings');
    expect(result.content).toContain('testChecker');
  });
});

describe('resolveCheckerBindings', () => {
  it('returns empty array when no check edges', () => {
    const nodes = new Map<string, MermaidNode>();
    nodes.set('FR', makeNode('FR', ['speckeeper']));
    const lintEdge = makeEdge('FR', 'UC', 'satisfies', 'lint');
    const result = resolveCheckerBindings('FR', [lintEdge], nodes, 'speckeeper');
    expect(result).toEqual([]);
  });

  it('skips speckeeper-to-speckeeper check edges', () => {
    const nodes = new Map<string, MermaidNode>();
    nodes.set('FR', makeNode('FR', ['speckeeper']));
    nodes.set('SR', makeNode('SR', ['speckeeper']));
    const edge = makeEdge('FR', 'SR', 'implements');
    const result = resolveCheckerBindings('FR', [edge], nodes, 'speckeeper');
    expect(result).toEqual([]);
  });

  it('detects implements edge to openapi target', () => {
    const nodes = new Map<string, MermaidNode>();
    nodes.set('FR', makeNode('FR', ['speckeeper']));
    nodes.set('API', makeNode('API', ['openapi']));
    const edge = makeEdge('FR', 'API', 'implements');
    const result = resolveCheckerBindings('FR', [edge], nodes, 'speckeeper');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ edgeType: 'implements', targetNodeId: 'API', targetClass: 'openapi' });
  });

  it('detects verifiedBy edge to test target', () => {
    const nodes = new Map<string, MermaidNode>();
    nodes.set('FR', makeNode('FR', ['speckeeper']));
    nodes.set('UT', makeNode('UT', ['test']));
    const edge = makeEdge('FR', 'UT', 'verifiedBy');
    const result = resolveCheckerBindings('FR', [edge], nodes, 'speckeeper');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ edgeType: 'verifiedBy', targetNodeId: 'UT', targetClass: 'test' });
  });

  it('de-duplicates edges to the same target', () => {
    const nodes = new Map<string, MermaidNode>();
    nodes.set('FR', makeNode('FR', ['speckeeper']));
    nodes.set('UT', makeNode('UT', ['test']));
    const e1 = makeEdge('FR', 'UT', 'verifiedBy');
    const e2 = makeEdge('FR', 'UT', 'implements');
    const result = resolveCheckerBindings('FR', [e1, e2], nodes, 'speckeeper');
    expect(result).toHaveLength(1);
  });
});

describe('generateAllModelFiles', () => {
  it('deduplicates nodes with the same template class', () => {
    const nodes: MermaidNode[] = [
      makeNode('FR', ['speckeeper', 'requirement']),
      makeNode('SR', ['speckeeper', 'requirement']),
      makeNode('NFR', ['speckeeper', 'requirement']),
    ];
    const allNodesMap = new Map(nodes.map(n => [n.id, n]));
    const files = generateAllModelFiles(nodes, [], allNodesMap);

    const modelFiles = files.filter(f => f.relativePath.startsWith('_models/'));
    expect(modelFiles).toHaveLength(1);
    expect(modelFiles[0].relativePath).toBe('_models/requirement.ts');
  });

  it('generates separate files for different template classes', () => {
    const nodes: MermaidNode[] = [
      makeNode('FR', ['speckeeper', 'requirement']),
      makeNode('T', ['speckeeper', 'term']),
    ];
    const allNodesMap = new Map(nodes.map(n => [n.id, n]));
    const files = generateAllModelFiles(nodes, [], allNodesMap);

    const modelFiles = files.filter(f => f.relativePath.startsWith('_models/'));
    expect(modelFiles).toHaveLength(2);
    const paths = modelFiles.map(f => f.relativePath).sort();
    expect(paths).toEqual(['_models/requirement.ts', '_models/term.ts']);
  });

  it('generates index.ts', () => {
    const nodes: MermaidNode[] = [
      makeNode('FR', ['speckeeper', 'requirement']),
    ];
    const allNodesMap = new Map(nodes.map(n => [n.id, n]));
    const files = generateAllModelFiles(nodes, [], allNodesMap);

    const index = files.find(f => f.relativePath === 'index.ts');
    expect(index).toBeDefined();
    expect(index!.content).toContain('mergeSpecs');
  });

  it('aggregates edges across nodes of the same template for bindings', () => {
    const fr = makeNode('FR', ['speckeeper', 'requirement']);
    const sr = makeNode('SR', ['speckeeper', 'requirement']);
    const api = makeNode('API', ['openapi']);
    const ut = makeNode('UT', ['test']);
    const nodes = [fr, sr];
    const allNodesMap = new Map<string, MermaidNode>([
      ['FR', fr], ['SR', sr], ['API', api], ['UT', ut],
    ]);
    const edges: ResolvedEdge[] = [
      makeEdge('FR', 'API', 'implements'),
      makeEdge('SR', 'UT', 'verifiedBy'),
    ];

    const files = generateAllModelFiles(nodes, edges, allNodesMap);
    const model = files.find(f => f.relativePath === '_models/requirement.ts')!;
    expect(model.content).toContain('externalOpenAPIChecker');
    expect(model.content).toContain('testChecker');
  });
});
