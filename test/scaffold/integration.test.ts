/**
 * Integration test — scaffold end-to-end with app-skelton README.md mermaid
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMarkdownFlowchart } from '../../src/scaffold/mermaid-parser.js';
import { resolveEdges } from '../../src/scaffold/edge-vocabulary.js';
import { generateAllModelFiles } from '../../src/scaffold/model-generator.js';
import { generateAllCheckerFiles } from '../../src/scaffold/checker-generator.js';
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
    expect(flowchart.edges.length).toBe(32);
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
      expect(resolved.length).toBe(32);
    });

    it('resolves speckeeper labels as exact RelationType matches', () => {
      const srToFr = resolved.find(e => e.sourceId === 'SR' && e.targetId === 'FR');
      expect(srToFr?.normalizedLabel).toBe('refines');

      const ucToApi = resolved.find(e => e.sourceId === 'UC' && e.targetId === 'API');
      expect(ucToApi?.normalizedLabel).toBe('implements');
      expect(ucToApi?.vocabulary.category).toBe('check');

      const frToAt = resolved.find(e => e.sourceId === 'FR' && e.targetId === 'AT');
      expect(frToAt?.normalizedLabel).toBe('includes');
      expect(frToAt?.vocabulary.category).toBe('coverage');

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
    const modelFiles = generateAllModelFiles(spkNodes, resolved);

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
      expect(specPaths.length).toBe(modelPaths.length);
      for (const sp of specPaths) {
        expect(sp).toMatch(/\.ts$/);
      }
      const specDataFiles = modelFiles.filter(f => !f.relativePath.startsWith('_models/'));
      for (const sf of specDataFiles) {
        expect(sf.content).toContain('.instance.register(');
      }
    });

    it('SR, FR, NFR all map to requirement (1 model file with 3 Model classes)', () => {
      const reqModelFiles = modelFiles.filter(f => f.relativePath === '_models/requirement.ts');
      expect(reqModelFiles).toHaveLength(1);
      expect(reqModelFiles[0].content).toContain('SystemRequirementModel');
      expect(reqModelFiles[0].content).toContain('FunctionalRequirementModel');
      expect(reqModelFiles[0].content).toContain('NonFunctionalRequirementModel');
      expect(reqModelFiles[0].content).toContain("idPrefix = 'SR'");
      expect(reqModelFiles[0].content).toContain("idPrefix = 'FR'");
      expect(reqModelFiles[0].content).toContain("idPrefix = 'NFR'");
    });

    it('requirement template includes acceptance criteria', () => {
      const req = modelFiles.find(f => f.relativePath === '_models/requirement.ts')!;
      expect(req.content).toContain('AcceptanceCriteriaSchema');
      expect(req.content).toContain('req-acceptance-not-empty');
    });

    it('logical-entity template has LDM prefix and includes columns', () => {
      const le = modelFiles.find(f => f.relativePath.includes('logical-entity'))!;
      expect(le.content).toContain("idPrefix = 'LDM'");
      expect(le.content).toContain('ColumnSchema');
      expect(le.content).toContain('lent-has-primary-key');
    });
  });

  describe('checker generation', () => {
    const { resolved } = resolveEdges(flowchart.edges, flowchart.nodes, SPECKEEPER_CLASS);
    const checkerFiles = generateAllCheckerFiles(resolved, flowchart.nodes, SPECKEEPER_CLASS);

    it('generates checkers for artifact targets', () => {
      const paths = checkerFiles.map(f => f.relativePath).sort();
      expect(paths).toContain('_checkers/ddl-checker.ts');
      expect(paths).toContain('_checkers/openapi-checker.ts');
    });

    it('generates test-checkers for test-like targets', () => {
      const paths = checkerFiles.map(f => f.relativePath).sort();
      expect(paths).toContain('_checkers/e2e-test-checker.ts');
      expect(paths).toContain('_checkers/data-unit-test-checker.ts');
      expect(paths).toContain('_checkers/unit-test-checker.ts');
      expect(paths).toContain('_checkers/integration-test-checker.ts');
    });

    it('test-checkers verify file existence and spec ID references', () => {
      const e2e = checkerFiles.find(f => f.relativePath.includes('e2e-test-checker'))!;
      expect(e2e.content).toContain("targetType: 'test'");
      expect(e2e.content).toContain('AcceptanceTest');
      expect(e2e.content).toContain('spec.id');
      expect(e2e.content).toContain('embedoc');
    });

    it('ddl-checker references LogicalEntity', () => {
      const ddl = checkerFiles.find(f => f.relativePath.includes('ddl-checker'))!;
      expect(ddl.content).toContain('LogicalEntity');
      expect(ddl.content).toContain("targetType: 'ddl'");
    });

    it('openapi-checker references UseCase', () => {
      const api = checkerFiles.find(f => f.relativePath.includes('openapi-checker'))!;
      expect(api.content).toContain('UseCase');
      expect(api.content).toContain("targetType: 'openapi'");
    });

    it('generates expected checker files matching flowchart edges', () => {
      const paths = checkerFiles.map(f => f.relativePath).sort();
      expect(paths).toContain('_checkers/ddl-checker.ts');
      expect(paths).toContain('_checkers/openapi-checker.ts');
      expect(paths).toContain('_checkers/unit-test-checker.ts');
      expect(paths).toContain('_checkers/e2e-test-checker.ts');
      expect(paths).toContain('_checkers/data-unit-test-checker.ts');
      expect(paths).toContain('_checkers/integration-test-checker.ts');
    });
  });

  describe('index generation', () => {
    const spkNodes: MermaidNode[] = [];
    for (const node of flowchart.nodes.values()) {
      if (node.classes.includes(SPECKEEPER_CLASS)) spkNodes.push(node);
    }
    const { resolved } = resolveEdges(flowchart.edges, flowchart.nodes, SPECKEEPER_CLASS);
    const modelFiles = generateAllModelFiles(spkNodes, resolved);
    const indexFile = generateModelsIndex(modelFiles);

    it('generates _models/index.ts', () => {
      expect(indexFile.relativePath).toBe('_models/index.ts');
    });

    it('exports all model classes', () => {
      expect(indexFile.content).toContain('SystemRequirementModel');
      expect(indexFile.content).toContain('FunctionalRequirementModel');
      expect(indexFile.content).toContain('NonFunctionalRequirementModel');
      expect(indexFile.content).toContain('UseCaseModel');
      expect(indexFile.content).toContain('ActorModel');
      expect(indexFile.content).toContain('TermModel');
      expect(indexFile.content).toContain('ConceptualDataModel');
      expect(indexFile.content).toContain('LogicalDataModel');
      expect(indexFile.content).toContain('AcceptanceTestModel');
      expect(indexFile.content).toContain('DataTestModel');
      expect(indexFile.content).toContain('ValidationConstraintModel');
    });

    it('provides allModels array', () => {
      expect(indexFile.content).toContain('export const allModels');
    });
  });
});
