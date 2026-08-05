/**
 * Drift over the machine-readable artifacts (specs/)
 *
 * FR-500: drift compares every file a build writes — the markdown exporters in
 * docsDir, the JSON exporters in specsDir, and the aggregated reference graph.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { buildCommand } from '../../src/cli/build.js';
import { driftCommand } from '../../src/cli/drift.js';
import { Model, RelationSchema } from '../../src/core/model.js';
import { EntityModel } from '../../design/_models/concept-model.ts';

vi.mock('../../src/utils/config-loader.js');

const { loadConfig } = await import('../../src/utils/config-loader.js');
const mockedLoadConfig = vi.mocked(loadConfig);

// ============================================================================
// A second model without exporters, so the reference graph spans both models
// ============================================================================

const ProbeSchema = z.object({
  id: z.string(),
  name: z.string(),
  relations: z.array(RelationSchema).optional(),
});

class ProbeModel extends Model<typeof ProbeSchema> {
  readonly id = 'probe';
  readonly name = 'Probe';
  readonly idPrefix = 'PR';
  readonly schema = ProbeSchema;
}

// ============================================================================
// Fixtures
// ============================================================================

const entities = [
  {
    id: 'E-900',
    name: 'Sample',
    description: 'Sample entity',
    attributes: [{ name: 'id', type: 'uuid', required: true }],
    relations: [{ type: 'refines', target: 'PR-001' }],
  },
  {
    id: 'E-901',
    name: 'Owner',
    description: 'Owner of a sample',
    attributes: [{ name: 'id', type: 'string', required: true }],
  },
];

const probes = [{ id: 'PR-001', name: 'Probe requirement' }];

function config() {
  const entityModel = EntityModel.instance;
  const probeModel = ProbeModel.instance;
  return {
    designDir: 'design',
    docsDir: 'docs',
    specsDir: 'specs',
    models: [entityModel, probeModel],
    specs: [
      { model: entityModel, data: entities },
      { model: probeModel, data: probes },
    ],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('FR-500: drift covers docs/, specs/ and the aggregated reference graph', () => {
  let tempDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  /** Absolute paths of the files a build writes for the fixtures above */
  let entitiesDoc: string;
  let entitySchema: string;
  let referenceGraph: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = mkdtempSync(join(tmpdir(), 'speckeeper-drift-'));
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);

    entitiesDoc = join(tempDir, 'docs', 'design', 'entities.md');
    entitySchema = join(tempDir, 'specs', 'schemas', 'entities', 'E-900.json');
    referenceGraph = join(tempDir, 'specs', 'index.json');

    mockedLoadConfig.mockResolvedValue(config() as never);
    await buildCommand({});
    logSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  function output(): string {
    return logSpy.mock.calls.map(c => String(c[0])).join('\n');
  }

  it('FR-500-01 reports no drift for the files a build just wrote', async () => {
    await driftCommand({ failOnDrift: true });

    expect(output()).toContain('No drift detected');
    // 1 markdown index + 2 entity JSON Schemas + the reference graph
    expect(output()).toContain('Checked: 4 files');
  });

  it('FR-500-01 detects a hand-edited entity JSON Schema under specs/', async () => {
    const tampered = JSON.parse(readFileSync(entitySchema, 'utf-8'));
    tampered.title = 'TAMPERED';
    tampered.properties = {};
    writeFileSync(entitySchema, JSON.stringify(tampered, null, 2) + '\n');

    await expect(driftCommand({ failOnDrift: true })).rejects.toThrow('process.exit(1)');

    expect(output()).toContain('1 file(s) have drifted');
    expect(output()).toContain(entitySchema);
  });

  it('FR-500-01 detects a hand-edited reference graph in specs/index.json', async () => {
    writeFileSync(referenceGraph, JSON.stringify({ nodes: [], edges: [] }) + '\n');

    await expect(driftCommand({ failOnDrift: true })).rejects.toThrow('process.exit(1)');

    expect(output()).toContain('1 file(s) have drifted');
    expect(output()).toContain(referenceGraph);
  });

  it('FR-500-01 detects a deleted machine-readable artifact', async () => {
    unlinkSync(referenceGraph);

    await expect(driftCommand({ failOnDrift: true })).rejects.toThrow('process.exit(1)');

    expect(output()).toContain('1 file(s) are missing');
    expect(output()).toContain(referenceGraph);
  });

  it('FR-500-01 detects a hand-edited markdown document under docs/', async () => {
    writeFileSync(entitiesDoc, '# Entities\n\nhand written\n');

    await expect(driftCommand({ failOnDrift: true })).rejects.toThrow('process.exit(1)');

    expect(output()).toContain('1 file(s) have drifted');
    expect(output()).toContain(entitiesDoc);
  });
});
