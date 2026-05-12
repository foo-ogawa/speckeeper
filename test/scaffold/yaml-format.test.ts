/**
 * Scaffold YAML format tests
 *
 * NFR-005: Verify scaffold generates YAML spec data files when format=yaml
 */
import { describe, it, expect } from 'vitest';
import type { MermaidNode } from '../../src/scaffold/types.js';
import {
  generateSpecDataFile,
  generateDesignIndex,
  generateAllModelFiles,
} from '../../src/scaffold/model-generator.js';

function makeNode(id: string, classes: string[], opts?: Partial<MermaidNode>): MermaidNode {
  return { id, label: opts?.label ?? id, classes, subgraph: opts?.subgraph, ...opts } as MermaidNode;
}

describe('generateSpecDataFile with format=yaml', () => {
  it('generates YAML spec data file', () => {
    const node = makeNode('FR', ['speckeeper', 'requirement']);
    const result = generateSpecDataFile(node, 'yaml');
    expect(result.relativePath).toBe('requirement.yaml');
    expect(result.content).toContain('model: requirement');
    expect(result.content).toContain('specs:');
    expect(result.content).not.toContain('import');
  });

  it('generates TS spec data file by default', () => {
    const node = makeNode('FR', ['speckeeper', 'requirement']);
    const result = generateSpecDataFile(node);
    expect(result.relativePath).toBe('requirement.ts');
    expect(result.content).toContain('defineSpecs');
  });
});

describe('generateDesignIndex with format=yaml', () => {
  it('generates loadYamlDir-based index.ts for yaml format', () => {
    const nodes = [makeNode('FR', ['speckeeper', 'requirement'])];
    const result = generateDesignIndex(nodes, 'yaml');
    expect(result.relativePath).toBe('index.ts');
    expect(result.content).toContain('loadYamlDir');
    expect(result.content).toContain('allModels');
    expect(result.content).not.toContain("from './requirement'");
  });

  it('generates import-based index.ts for ts format', () => {
    const nodes = [makeNode('FR', ['speckeeper', 'requirement'])];
    const result = generateDesignIndex(nodes, 'ts');
    expect(result.relativePath).toBe('index.ts');
    expect(result.content).toContain("from './requirement'");
    expect(result.content).not.toContain('loadYamlDir');
  });
});

describe('generateAllModelFiles with format=yaml', () => {
  it('generates YAML spec files and loadYamlDir index', () => {
    const nodes = [
      makeNode('FR', ['speckeeper', 'requirement']),
      makeNode('T', ['speckeeper', 'term']),
    ];
    const allNodesMap = new Map(nodes.map(n => [n.id, n]));
    const files = generateAllModelFiles(nodes, [], allNodesMap, 'yaml');

    const specFiles = files.filter(f => f.relativePath.endsWith('.yaml'));
    expect(specFiles).toHaveLength(2);
    expect(specFiles.map(f => f.relativePath).sort()).toEqual(['requirement.yaml', 'term.yaml']);

    const index = files.find(f => f.relativePath === 'index.ts');
    expect(index).toBeDefined();
    expect(index!.content).toContain('loadYamlDir');
  });

  it('model files are always TS regardless of format', () => {
    const nodes = [makeNode('FR', ['speckeeper', 'requirement'])];
    const allNodesMap = new Map(nodes.map(n => [n.id, n]));
    const files = generateAllModelFiles(nodes, [], allNodesMap, 'yaml');

    const modelFiles = files.filter(f => f.relativePath.startsWith('_models/'));
    expect(modelFiles).toHaveLength(1);
    expect(modelFiles[0].relativePath).toBe('_models/requirement.ts');
  });
});
