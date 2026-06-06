import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  SpeckeeperInsightProvider,
  filterInsight,
  findRelationLocation,
} from '../../src/external/insight-provider.js';

vi.mock('../../src/utils/config-loader.js');

const { loadConfig } = await import('../../src/utils/config-loader.js');
const mockedLoadConfig = vi.mocked(loadConfig);

function createMockModel(id = 'functional-requirement') {
  return {
    id,
    name: 'FunctionalRequirement',
    lintAll: vi.fn().mockReturnValue([]),
    getExporters: vi.fn().mockReturnValue([]),
    register: vi.fn(),
  };
}

describe('SpeckeeperInsightProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('converts spec relations to ExternalEdge with spec_relation evidence', async () => {
    const model = createMockModel();
    mockedLoadConfig.mockResolvedValue({
      specs: [
        {
          model,
          data: [
            {
              id: 'FR-001',
              _sourceFile: 'design/requirements.yaml',
              relations: [{ type: 'satisfies', target: 'UC-001' }],
            },
            { id: 'UC-001', _sourceFile: 'design/usecases.yaml' },
          ],
        },
      ],
    } as never);

    const provider = new SpeckeeperInsightProvider();
    const insight = await provider.provide({ projectRoot: '/project' });

    expect(insight.source).toBe('speckeeper');
    expect(insight.edges).toHaveLength(1);
    expect(insight.edges[0]).toMatchObject({
      from: 'FR-001',
      to: 'UC-001',
      kind: 'satisfies',
      propagation: 'backward',
    });
    expect(insight.edges[0].evidence?.[0]).toMatchObject({
      kind: 'spec_relation',
      filePath: 'design/requirements.yaml',
    });
  });

  it('maps RELATION_CONSTRAINTS propagation per relation type', async () => {
    const model = createMockModel();
    mockedLoadConfig.mockResolvedValue({
      specs: [
        {
          model,
          data: [
            {
              id: 'COMP-001',
              relations: [
                { type: 'implements', target: 'FR-001' },
                { type: 'traces', target: 'FR-002' },
              ],
            },
          ],
        },
      ],
    } as never);

    const provider = new SpeckeeperInsightProvider();
    const insight = await provider.provide({ projectRoot: '/project' });

    const byKind = Object.fromEntries(insight.edges.map(e => [e.kind, e.propagation]));
    expect(byKind.implements).toBe('forward');
    expect(byKind.traces).toBe('both');
  });

  it('builds AnchorMapping with filePaths for specs', async () => {
    const model = createMockModel('test-ref');
    mockedLoadConfig.mockResolvedValue({
      specs: [
        {
          model,
          data: [
            {
              id: 'TEST-001',
              _sourceFile: 'design/test-refs.yaml',
              source: { path: 'test/cli/foo.test.ts' },
            },
          ],
        },
      ],
    } as never);

    const provider = new SpeckeeperInsightProvider();
    const insight = await provider.provide({ projectRoot: '/project' });

    const anchor = insight.anchorMapping?.find(a => a.domainId === 'TEST-001');
    expect(anchor?.filePaths).toContain('design/test-refs.yaml');
    expect(anchor?.filePaths).toContain('test/cli/foo.test.ts');
    expect(anchor?.symbols).toHaveLength(1);
  });

  it('returns empty edges when no specs in config', async () => {
    mockedLoadConfig.mockResolvedValue({} as never);

    const provider = new SpeckeeperInsightProvider();
    const insight = await provider.provide({ projectRoot: '/project' });

    expect(insight.edges).toEqual([]);
  });

  it('filters edges by changedFiles', async () => {
    mockedLoadConfig.mockResolvedValue({
      specs: [{
        model: createMockModel(),
        data: [
          { id: 'FR-001', _sourceFile: 'design/requirements.yaml', relations: [{ type: 'satisfies', target: 'UC-001' }] },
          { id: 'FR-002', _sourceFile: 'design/other.yaml', relations: [{ type: 'traces', target: 'UC-002' }] },
          { id: 'UC-001', _sourceFile: 'design/usecases.yaml' },
          { id: 'UC-002', _sourceFile: 'design/usecases2.yaml' },
        ],
      }],
    } as never);

    const provider = new SpeckeeperInsightProvider();
    const insight = await provider.provide({
      projectRoot: '/project',
      changedFiles: ['design/requirements.yaml'],
    });

    expect(insight.edges).toHaveLength(1);
    expect(insight.edges[0].from).toBe('FR-001');
    expect(insight.edges[0].to).toBe('UC-001');
    expect(insight.anchorMapping?.map(a => a.domainId).sort()).toEqual(['FR-001', 'UC-001']);
  });

  it('filters edges by artifactIds', async () => {
    mockedLoadConfig.mockResolvedValue({
      specs: [{
        model: createMockModel(),
        data: [
          { id: 'FR-001', _sourceFile: 'design/requirements.yaml', relations: [{ type: 'satisfies', target: 'UC-001' }] },
          { id: 'FR-002', _sourceFile: 'design/other.yaml', relations: [{ type: 'traces', target: 'UC-002' }] },
          { id: 'UC-001', _sourceFile: 'design/usecases.yaml' },
          { id: 'UC-002', _sourceFile: 'design/usecases2.yaml' },
        ],
      }],
    } as never);

    const provider = new SpeckeeperInsightProvider();
    const insight = await provider.provide({
      projectRoot: '/project',
      artifactIds: ['FR-002'],
    });

    expect(insight.edges).toHaveLength(1);
    expect(insight.edges[0].from).toBe('FR-002');
    expect(insight.edges[0].to).toBe('UC-002');
    expect(insight.anchorMapping?.map(a => a.domainId).sort()).toEqual(['FR-002', 'UC-002']);
  });

  it('returns all edges when neither changedFiles nor artifactIds are set', async () => {
    mockedLoadConfig.mockResolvedValue({
      specs: [{
        model: createMockModel(),
        data: [
          { id: 'FR-001', _sourceFile: 'design/requirements.yaml', relations: [{ type: 'satisfies', target: 'UC-001' }] },
          { id: 'FR-002', _sourceFile: 'design/other.yaml', relations: [{ type: 'traces', target: 'UC-002' }] },
          { id: 'UC-001', _sourceFile: 'design/usecases.yaml' },
          { id: 'UC-002', _sourceFile: 'design/usecases2.yaml' },
        ],
      }],
    } as never);

    const provider = new SpeckeeperInsightProvider();
    const insight = await provider.provide({ projectRoot: '/project' });

    expect(insight.edges).toHaveLength(2);
  });
});

describe('filterInsight', () => {
  it('returns insight unchanged when no filters are provided', () => {
    const insight = {
      source: 'speckeeper' as const,
      edges: [{ from: 'FR-001', to: 'UC-001', kind: 'satisfies', propagation: 'backward' as const }],
      anchorMapping: [{ domainId: 'FR-001', filePaths: ['design/requirements.yaml'] }],
    };

    const result = filterInsight(insight, { projectRoot: '/project' });
    expect(result).toBe(insight);
  });
});

describe('findRelationLocation', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'speckeeper-insight-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns line and endLine for a relation block in YAML', () => {
    const yamlPath = join(tempDir, 'specs.yaml');
    const content = `entries:
  - model: term
    specs:
      - id: FR-001
        name: Example
        relations:
          - type: satisfies
            target: UC-001
            description: link
      - id: FR-002
        name: Other
`;
    writeFileSync(yamlPath, content, 'utf-8');

    const location = findRelationLocation(
      'specs.yaml',
      'FR-001',
      { type: 'satisfies', target: 'UC-001' },
      tempDir,
    );

    expect(location).toBeDefined();
    expect(location!.line).toBeGreaterThan(0);
    expect(location!.endLine).toBeGreaterThanOrEqual(location!.line);
    const lines = content.split('\n');
    const block = lines.slice(location!.line - 1, location!.endLine).join('\n');
    expect(block).toContain('type: satisfies');
    expect(block).toContain('target: UC-001');
  });
});
