/**
 * Machine-readable build artifacts (specs/)
 *
 * FR-302: Entity JSON Schema + reference resolution graph
 * FR-800: Aggregated JSON for machine processing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { buildCommand } from '../../src/cli/build.js';
import { Model, RelationSchema } from '../../src/core/model.js';
import { EntityModel } from '../../design/_models/concept-model.ts';

vi.mock('../../src/utils/config-loader.js');

const { loadConfig } = await import('../../src/utils/config-loader.js');
const mockedLoadConfig = vi.mocked(loadConfig);

// ============================================================================
// A second model, so the reference graph is exercised across models.
// It defines no exporters: its specs must still reach the graph.
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

const everyTypeEntity = {
  id: 'E-900',
  name: 'Sample',
  description: 'Entity covering every logical attribute type',
  attributes: [
    { name: 'id', type: 'uuid', required: true },
    {
      name: 'title',
      type: 'string',
      required: true,
      description: 'Display title',
      constraints: { minLength: 1, maxLength: 80, pattern: '^[A-Z]' },
    },
    { name: 'count', type: 'integer', required: false, constraints: { minimum: 0, maximum: 10 } },
    { name: 'ratio', type: 'number', required: false },
    { name: 'active', type: 'boolean', required: true },
    { name: 'startsOn', type: 'date', required: false },
    { name: 'createdAt', type: 'datetime', required: false },
    { name: 'openAt', type: 'time', required: false },
    { name: 'contact', type: 'email', required: false },
    { name: 'homepage', type: 'url', required: false },
    { name: 'payload', type: 'json', required: false },
    { name: 'tags', type: 'array', itemType: 'string', required: false },
    { name: 'anything', type: 'array', required: false },
    { name: 'status', type: 'enum', enumValues: ['open', 'closed'], required: true },
    { name: 'ownerId', type: 'reference', referenceTo: 'E-901', required: false },
    { name: 'peerId', type: 'reference', required: false },
    { name: 'implicit', type: 'string' },
  ],
  relations: [{ type: 'refines', target: 'PR-001' }],
};

const plainEntity = {
  id: 'E-901',
  name: 'Owner',
  description: 'Owner of a sample',
  attributes: [{ name: 'id', type: 'string', required: true }],
};

const probeSpecs = [
  { id: 'PR-001', name: 'Probe requirement', relations: [{ type: 'relatedTo', target: 'E-901' }] },
];

function configWith(entities: unknown[], probes: unknown[] = probeSpecs) {
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

/** Absolute paths of every file below dir, recursively. */
function collectFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...collectFiles(full));
    else found.push(full);
  }
  return found;
}

// ============================================================================
// Tests
// ============================================================================

describe('FR-302, FR-800: build writes machine-readable artifacts to specs/', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = mkdtempSync(join(tmpdir(), 'speckeeper-specs-'));
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('FR-302-01 maps entity attributes to JSON Schema properties in specs/schemas/entities/', async () => {
    mockedLoadConfig.mockResolvedValue(configWith([everyTypeEntity, plainEntity]) as never);

    await buildCommand({});

    const entitiesDir = join(tempDir, 'specs', 'schemas', 'entities');
    expect(readdirSync(entitiesDir).sort()).toEqual(['E-900.json', 'E-901.json']);

    const schema = JSON.parse(readFileSync(join(entitiesDir, 'E-900.json'), 'utf-8'));

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('E-900.json');
    expect(schema.title).toBe('Sample');
    expect(schema.description).toBe('Entity covering every logical attribute type');
    expect(schema.type).toBe('object');

    expect(schema.properties).toEqual({
      id: { type: 'string', format: 'uuid' },
      title: {
        type: 'string',
        description: 'Display title',
        minLength: 1,
        maxLength: 80,
        pattern: '^[A-Z]',
      },
      count: { type: 'integer', minimum: 0, maximum: 10 },
      ratio: { type: 'number' },
      active: { type: 'boolean' },
      startsOn: { type: 'string', format: 'date' },
      createdAt: { type: 'string', format: 'date-time' },
      openAt: { type: 'string', format: 'time' },
      contact: { type: 'string', format: 'email' },
      homepage: { type: 'string', format: 'uri' },
      payload: {},
      tags: { type: 'array', items: { type: 'string' } },
      anything: { type: 'array' },
      status: { type: 'string', enum: ['open', 'closed'] },
      ownerId: { type: 'string', $comment: 'Reference to E-901' },
      peerId: { type: 'string' },
      implicit: { type: 'string' },
    });

    expect(schema.required).toEqual(['id', 'title', 'active', 'status', 'implicit']);
  });

  it('FR-302-01 keeps markdown exporters in docsDir', async () => {
    mockedLoadConfig.mockResolvedValue(configWith([plainEntity]) as never);

    await buildCommand({});

    expect(existsSync(join(tempDir, 'docs', 'design', 'entities.md'))).toBe(true);
  });

  it('FR-302-02 writes the reference resolution graph to specs/index.json', async () => {
    mockedLoadConfig.mockResolvedValue(configWith([everyTypeEntity, plainEntity]) as never);

    await buildCommand({});

    const graph = JSON.parse(readFileSync(join(tempDir, 'specs', 'index.json'), 'utf-8'));

    expect(graph.nodes).toEqual([
      { id: 'E-900', model: 'entity' },
      { id: 'E-901', model: 'entity' },
      { id: 'PR-001', model: 'probe' },
    ]);
    expect(graph.edges).toEqual([
      { from: 'E-900', type: 'refines', to: 'PR-001' },
      { from: 'PR-001', type: 'relatedTo', to: 'E-901' },
    ]);
  });

  it('FR-800-01 writes the aggregated JSON identically on repeated builds', async () => {
    mockedLoadConfig.mockResolvedValue(configWith([plainEntity, everyTypeEntity]) as never);

    const indexPath = join(tempDir, 'specs', 'index.json');

    await buildCommand({});
    const first = readFileSync(indexPath, 'utf-8');

    await buildCommand({});
    const second = readFileSync(indexPath, 'utf-8');

    expect(second).toBe(first);
    expect(first.endsWith('\n')).toBe(true);
  });

  it('FR-300-02 writes every file under specsDir as machine-readable JSON', async () => {
    mockedLoadConfig.mockResolvedValue(configWith([everyTypeEntity, plainEntity]) as never);

    await buildCommand({});

    const specsDir = join(tempDir, 'specs');
    const written = collectFiles(specsDir).sort();

    // The build must produce a machine-readable tree, and every file in it must parse.
    expect(written.length).toBeGreaterThan(0);
    for (const file of written) {
      const content = readFileSync(file, 'utf-8');
      expect(() => JSON.parse(content), file).not.toThrow();
    }
  });

  it('FR-302-01 fails the build when an enum attribute declares no values', async () => {
    const brokenEntity = {
      id: 'E-902',
      name: 'Broken',
      description: 'Enum attribute without enumValues',
      attributes: [{ name: 'status', type: 'enum', required: true }],
    };
    mockedLoadConfig.mockResolvedValue(configWith([brokenEntity]) as never);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

    await buildCommand({});

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(vi.mocked(console.error).mock.calls.flat().join(' ')).toContain('Build failed');
    expect(existsSync(join(tempDir, 'specs', 'schemas', 'entities'))).toBe(false);
  });
});
