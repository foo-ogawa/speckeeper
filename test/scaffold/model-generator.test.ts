import { describe, it, expect } from 'vitest';
import type { MermaidNode, ResolvedEdge } from '../../src/scaffold/types.js';
import {
  generateModelFile,
  generateAllModelFiles,
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

describe('FR-106, FR-605: generateModelFile', () => {
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

  it('does not generate externalChecker code (checker bindings removed)', () => {
    const nodes = new Map<string, MermaidNode>();
    const fr = makeNode('FR', ['speckeeper', 'requirement']);
    const api = makeNode('API', ['openapi']);
    nodes.set('FR', fr);
    nodes.set('API', api);

    const edge = makeEdge('FR', 'API', 'implements');
    const result = generateModelFile(fr, [], [edge], nodes);
    expect(result.content).not.toContain('protected externalChecker');
    expect(result.content).not.toContain('annotationChecker');
  });

  it('generated model has basic structure without checker code', () => {
    const nodes = new Map<string, MermaidNode>();
    const fr = makeNode('FR', ['speckeeper', 'requirement']);
    const ut = makeNode('UT', ['test']);
    nodes.set('FR', fr);
    nodes.set('UT', ut);

    const edge = makeEdge('FR', 'UT', 'verifiedBy');
    const result = generateModelFile(fr, [], [edge], nodes);
    expect(result.content).not.toContain('protected externalChecker');
    expect(result.content).toContain('protected exporters');
    expect(result.content).toContain('protected lintRules');
  });
});

describe('FR-703-02: scaffold emits checker binding guidance for check edges', () => {
  it('FR-703-02 names the implements target and points at the config binding', () => {
    const fr = makeNode('FR', ['speckeeper', 'requirement']);
    const api = makeNode('API', ['openapi'], { label: 'API spec openapi SSoT' });
    const nodes = new Map<string, MermaidNode>([['FR', fr], ['API', api]]);

    const result = generateModelFile(fr, [], [makeEdge('FR', 'API', 'implements')], nodes);

    expect(result.content).toContain('Checker binding');
    expect(result.content).toContain('implements → API (API spec openapi SSoT)');
    expect(result.content).toContain('speckeeper.config.ts');
    // Guidance only — no checker code, per FR-106-08
    expect(result.content).not.toContain('protected externalChecker');
    expect(result.content).not.toContain('annotationChecker');
  });

  it('FR-703-02 names a verifiedBy target as well', () => {
    const fr = makeNode('FR', ['speckeeper', 'requirement']);
    const ut = makeNode('UT', ['test']);
    const nodes = new Map<string, MermaidNode>([['FR', fr], ['UT', ut]]);

    const result = generateModelFile(fr, [], [makeEdge('FR', 'UT', 'verifiedBy')], nodes);

    expect(result.content).toContain('verifiedBy → UT');
  });

  it('FR-703-02 lists every check edge detected for the model', () => {
    const fr = makeNode('FR', ['speckeeper', 'requirement']);
    const api = makeNode('API', ['openapi']);
    const ut = makeNode('UT', ['test']);
    const nodes = new Map<string, MermaidNode>([['FR', fr], ['API', api], ['UT', ut]]);

    const result = generateModelFile(
      fr,
      [],
      [makeEdge('FR', 'API', 'implements'), makeEdge('FR', 'UT', 'verifiedBy')],
      nodes,
    );

    expect(result.content).toContain('implements → API');
    expect(result.content).toContain('verifiedBy → UT');
  });

  it('FR-703-02 emits no guidance when no check edge is detected', () => {
    const fr = makeNode('FR', ['speckeeper', 'requirement']);
    const uc = makeNode('UC', ['speckeeper', 'usecase']);
    const nodes = new Map<string, MermaidNode>([['FR', fr], ['UC', uc]]);

    const withLintEdge = generateModelFile(fr, [], [makeEdge('FR', 'UC', 'refines', 'lint')], nodes);
    expect(withLintEdge.content).not.toContain('Checker binding');

    const withNoEdge = generateModelFile(fr, [], [], nodes);
    expect(withNoEdge.content).not.toContain('Checker binding');
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

  it('emits no _checkers/ file for any edge category', () => {
    const fr = makeNode('FR', ['speckeeper', 'requirement']);
    const api = makeNode('API', ['openapi']);
    const ut = makeNode('UT', ['test']);
    const allNodesMap = new Map<string, MermaidNode>([['FR', fr], ['API', api], ['UT', ut]]);
    const edges: ResolvedEdge[] = [
      makeEdge('FR', 'API', 'implements'),
      makeEdge('FR', 'UT', 'verifiedBy'),
      makeEdge('FR', 'API', 'verifies', 'external'),
    ];

    const files = generateAllModelFiles([fr], edges, allNodesMap);

    expect(files.length).toBeGreaterThan(0);
    expect(files.filter(f => f.relativePath.startsWith('_checkers/'))).toEqual([]);
  });

  it('generated model does not include checker code even with edges', () => {
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
    expect(model.content).not.toContain('annotationChecker');
    expect(model.content).not.toContain('externalOpenAPIChecker');
    expect(model.content).not.toContain('protected externalChecker');
    expect(model.content).toContain('protected lintRules');
  });
});
