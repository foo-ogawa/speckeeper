/**
 * Integration test — scaffold end-to-end with app-skelton README.md mermaid
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMarkdownFlowchart } from '../../src/scaffold/mermaid-parser.js';
import { resolveEdges } from '../../src/scaffold/edge-vocabulary.js';
import { generateAllModelFiles } from '../../src/scaffold/model-generator.js';
import { generateModelsIndex } from '../../src/scaffold/index-generator.js';
import type { MermaidNode } from '../../src/scaffold/types.js';

const README_PATH = join(__dirname, 'fixtures/app-skelton-example.md');
const SPECKEEPER_CLASS = 'speckeeper';

function loadFlowchart() {
  const markdown = readFileSync(README_PATH, 'utf-8');
  return parseMarkdownFlowchart(markdown)!;
}

describe('scaffold integration with app-skelton README.md', () => {
  const flowchart = loadFlowchart();

  it('parses the flowchart', () => {
    expect(flowchart).not.toBeNull();
    expect(flowchart.nodes.size).toBe(22);
    expect(flowchart.edges.length).toBe(34);
  });

  describe('speckeeper-managed nodes', () => {
    const spkNodes: MermaidNode[] = [];
    for (const node of flowchart.nodes.values()) {
      if (node.classes.includes(SPECKEEPER_CLASS)) {
        spkNodes.push(node);
      }
    }

    it('identifies 10 speckeeper-managed nodes', () => {
      const ids = spkNodes.map(n => n.id).sort();
      expect(ids).toEqual(['AT', 'CDM', 'DT', 'FR', 'LDM', 'NFR', 'SR', 'TERM', 'UC', 'VC']);
    });
  });

  describe('edge resolution', () => {
    const { resolved, diagnostics } = resolveEdges(flowchart.edges, flowchart.nodes, SPECKEEPER_CLASS);

    it('resolves all edges', () => {
      expect(resolved.length).toBe(34);
    });

    it('resolves verifiedBy as check category', () => {
      const frToUt = resolved.find(e => e.sourceId === 'FR' && e.targetId === 'UT' && e.normalizedLabel === 'verifiedBy');
      expect(frToUt).toBeDefined();
      expect(frToUt?.vocabulary.category).toBe('check');

      const frToIt = resolved.find(e => e.sourceId === 'FR' && e.targetId === 'IT' && e.normalizedLabel === 'verifiedBy');
      expect(frToIt).toBeDefined();
      expect(frToIt?.vocabulary.category).toBe('check');
    });

    it('resolves verifies as external category', () => {
      const dutToOrm = resolved.find(e => e.sourceId === 'DUT' && e.targetId === 'ORM');
      expect(dutToOrm?.vocabulary.category).toBe('external');
    });

    it('resolves speckeeper labels as exact RelationType matches', () => {
      const srToFr = resolved.find(e => e.sourceId === 'SR' && e.targetId === 'FR');
      expect(srToFr?.normalizedLabel).toBe('refines');

      const ucToApi = resolved.find(e => e.sourceId === 'UC' && e.targetId === 'API');
      expect(ucToApi?.normalizedLabel).toBe('implements');
      expect(ucToApi?.vocabulary.category).toBe('check');

      const frToAt = resolved.find(e => e.sourceId === 'FR' && e.targetId === 'AT');
      expect(frToAt?.normalizedLabel).toBe('includes');
      expect(frToAt?.vocabulary.category).toBe('lint');

      const frToVc = resolved.find(e => e.sourceId === 'FR' && e.targetId === 'VC');
      expect(frToVc?.normalizedLabel).toBe('traces');
    });

    it('accepts free-text labels for external-only edges without validation errors', () => {
      const dbsToOrm = resolved.find(e => e.sourceId === 'DBS' && e.targetId === 'ORM');
      expect(dbsToOrm).toBeDefined();

      const compimpToCtn = resolved.find(e => e.sourceId === 'COMPIMP' && e.targetId === 'CTN');
      expect(compimpToCtn).toBeDefined();

      const externalOnlyDiags = diagnostics.filter(d =>
        d.context?.includes('DBS') || d.context?.includes('COMPIMP → CTN')
      );
      const externalErrors = externalOnlyDiags.filter(d => d.severity === 'error');
      expect(externalErrors).toHaveLength(0);
    });

    it('produces no errors (only warnings allowed)', () => {
      const errors = diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('model generation', () => {
    const spkNodes: MermaidNode[] = [];
    for (const node of flowchart.nodes.values()) {
      if (node.classes.includes(SPECKEEPER_CLASS)) spkNodes.push(node);
    }
    const { resolved } = resolveEdges(flowchart.edges, flowchart.nodes, SPECKEEPER_CLASS);
    const modelFiles = generateAllModelFiles(spkNodes, resolved, flowchart.nodes);

    it('generates de-duplicated model files and spec data files', () => {
      const modelPaths = modelFiles.map(f => f.relativePath).filter(p => p.startsWith('_models/')).sort();
      const specPaths = modelFiles.map(f => f.relativePath).filter(p => !p.startsWith('_models/')).sort();
      expect(modelPaths).toEqual([
        '_models/acceptance-test.ts',
        '_models/data-test.ts',
        '_models/entity.ts',
        '_models/logical-entity.ts',
        '_models/requirement.ts',
        '_models/term.ts',
        '_models/usecase.ts',
        '_models/validation-constraint.ts',
      ]);
      const specDataPaths = specPaths.filter(p => p !== 'index.ts');
      expect(specDataPaths.length).toBe(modelPaths.length);
      for (const sp of specPaths) {
        expect(sp).toMatch(/\.ts$/);
      }
      const specDataFiles = modelFiles.filter(f => !f.relativePath.startsWith('_models/') && f.relativePath !== 'index.ts');
      for (const sf of specDataFiles) {
        expect(sf.content).toContain('defineSpecs');
      }
      const indexFile = modelFiles.find(f => f.relativePath === 'index.ts');
      expect(indexFile).toBeDefined();
      expect(indexFile!.content).toContain('mergeSpecs');
    });

    it('SR, FR, NFR all map to requirement (1 model file, de-duplicated)', () => {
      const reqModelFiles = modelFiles.filter(f => f.relativePath === '_models/requirement.ts');
      expect(reqModelFiles).toHaveLength(1);
      expect(reqModelFiles[0].content).toContain('RequirementModel');
      expect(reqModelFiles[0].content).toContain('RequirementSchema');
    });

    it('all generated models use base template with core factory imports', () => {
      const allModelFiles = modelFiles.filter(f => f.relativePath.startsWith('_models/'));
      for (const mf of allModelFiles) {
        expect(mf.content).toContain("from 'speckeeper/dsl'");
        expect(mf.content).toContain('requireField');
        expect(mf.content).toContain("z.object({");
      }
    });

    it('logical-entity model uses base template with LDM prefix', () => {
      const le = modelFiles.find(f => f.relativePath.includes('logical-entity'))!;
      expect(le.content).toContain("idPrefix = 'LDM'");
      expect(le.content).toContain("from 'speckeeper/dsl'");
    });

    it('FR model includes checker bindings for implements (API) and verifiedBy (UT, IT)', () => {
      const req = modelFiles.find(f => f.relativePath === '_models/requirement.ts')!;
      expect(req.content).toContain('Checker Bindings');
      expect(req.content).toContain('verifiedBy');
      expect(req.content).toContain('testChecker');
    });

    it('UC model includes checker binding for implements (API)', () => {
      const uc = modelFiles.find(f => f.relativePath === '_models/usecase.ts')!;
      expect(uc.content).toContain('Checker Bindings');
      expect(uc.content).toContain('implements');
      expect(uc.content).toContain('openapi');
    });

    it('LDM model includes checker binding for implements (DDL)', () => {
      const ldm = modelFiles.find(f => f.relativePath === '_models/logical-entity.ts')!;
      expect(ldm.content).toContain('Checker Bindings');
      expect(ldm.content).toContain('implements');
      expect(ldm.content).toContain('sqlschema');
    });
  });

  describe('index generation', () => {
    const spkNodes: MermaidNode[] = [];
    for (const node of flowchart.nodes.values()) {
      if (node.classes.includes(SPECKEEPER_CLASS)) spkNodes.push(node);
    }
    const { resolved } = resolveEdges(flowchart.edges, flowchart.nodes, SPECKEEPER_CLASS);
    const modelFiles = generateAllModelFiles(spkNodes, resolved, flowchart.nodes);
    const indexFile = generateModelsIndex(modelFiles);

    it('generates _models/index.ts', () => {
      expect(indexFile.relativePath).toBe('_models/index.ts');
    });

    it('exports model classes generated from base template', () => {
      expect(indexFile.content).toContain('RequirementModel');
      expect(indexFile.content).toContain('UsecaseModel');
      expect(indexFile.content).toContain('TermModel');
      expect(indexFile.content).toContain('EntityModel');
      expect(indexFile.content).toContain('LogicalEntityModel');
      expect(indexFile.content).toContain('AcceptanceTestModel');
      expect(indexFile.content).toContain('DataTestModel');
      expect(indexFile.content).toContain('ValidationConstraintModel');
    });

    it('provides allModels array', () => {
      expect(indexFile.content).toContain('export const allModels');
    });
  });
});
