/**
 * YAML / JSON Spec Loader Tests
 *
 * NFR-005: Input Format Diversity — loadYamlSpecs / loadYamlDir
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { z } from 'zod';
import { Model, loadYamlSpecs, loadYamlDir } from '../../src/core/model.js';
import type { ModelLevel, LintRule, Exporter } from '../../src/core/model.js';

// ---------------------------------------------------------------------------
// Test model definitions
// ---------------------------------------------------------------------------

const TermSchema = z.object({
  id: z.string(),
  term: z.string(),
  definition: z.string(),
  category: z.enum(['business', 'technical', 'acronym']),
});

class TermModel extends Model<typeof TermSchema> {
  readonly id = 'term';
  readonly name = 'Term';
  readonly idPrefix = 'TERM';
  readonly schema = TermSchema;
  protected modelLevel: ModelLevel = 'L0';
  protected lintRules: LintRule<z.infer<typeof TermSchema>>[] = [];
  protected exporters: Exporter<z.infer<typeof TermSchema>>[] = [];
}

const RequirementSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['functional', 'non-functional']),
  priority: z.enum(['must', 'should', 'could']),
  description: z.string(),
});

class ReqModel extends Model<typeof RequirementSchema> {
  readonly id = 'requirement';
  readonly name = 'Requirement';
  readonly idPrefix = 'REQ';
  readonly schema = RequirementSchema;
  protected modelLevel: ModelLevel = 'L1';
  protected lintRules: LintRule<z.infer<typeof RequirementSchema>>[] = [];
  protected exporters: Exporter<z.infer<typeof RequirementSchema>>[] = [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const models: Model<any>[] = [TermModel.instance, ReqModel.instance];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const testDir = join(process.cwd(), '.test-yaml-loader');

function writeTempFile(relativePath: string, content: string): string {
  const fullPath = join(testDir, relativePath);
  const dir = join(fullPath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content);
  return fullPath;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NFR-005: loadYamlSpecs', () => {
  beforeEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  });

  it('loads single-model YAML (shorthand format)', () => {
    const path = writeTempFile('glossary.yaml', `
model: term
specs:
  - id: TERM-001
    term: SSoT
    definition: Single Source of Truth
    category: acronym
  - id: TERM-002
    term: DSL
    definition: Domain Specific Language
    category: technical
`);

    const result = loadYamlSpecs(path, models);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].model.id).toBe('term');
    expect(result.entries[0].data).toHaveLength(2);
    expect((result.entries[0].data[0] as { id: string }).id).toBe('TERM-001');
  });

  it('loads multi-model YAML (entries format)', () => {
    const path = writeTempFile('requirements.yaml', `
entries:
  - model: requirement
    specs:
      - id: FR-001
        name: Auth
        type: functional
        priority: must
        description: User authentication
  - model: term
    specs:
      - id: TERM-A001
        term: API
        definition: Application Programming Interface
        category: technical
`);

    const result = loadYamlSpecs(path, models);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].model.id).toBe('requirement');
    expect(result.entries[0].data).toHaveLength(1);
    expect(result.entries[1].model.id).toBe('term');
    expect(result.entries[1].data).toHaveLength(1);
  });

  it('loads JSON file transparently', () => {
    const path = writeTempFile('glossary.json', JSON.stringify({
      model: 'term',
      specs: [
        { id: 'TERM-001', term: 'SSoT', definition: 'Single Source of Truth', category: 'acronym' },
      ],
    }));

    const result = loadYamlSpecs(path, models);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].model.id).toBe('term');
    expect(result.entries[0].data).toHaveLength(1);
  });

  it('throws on unknown model ID', () => {
    const path = writeTempFile('bad.yaml', `
model: nonexistent
specs:
  - id: X-001
`);

    expect(() => loadYamlSpecs(path, models)).toThrow(/Unknown model "nonexistent"/);
  });

  it('throws on schema validation failure with helpful message', () => {
    const path = writeTempFile('invalid.yaml', `
model: term
specs:
  - id: TERM-001
    term: SSoT
    definition: Single Source of Truth
    category: invalid_category
`);

    expect(() => loadYamlSpecs(path, models)).toThrow(/Validation failed.*TERM-001.*term/);
  });

  it('throws on YAML syntax error', () => {
    const path = writeTempFile('broken.yaml', `
model: term
specs:
  - id: TERM-001
    [invalid yaml
`);

    expect(() => loadYamlSpecs(path, models)).toThrow(/Failed to parse/);
  });

  it('validates all specs through Zod schema', () => {
    const path = writeTempFile('valid.yaml', `
model: requirement
specs:
  - id: FR-001
    name: Auth
    type: functional
    priority: must
    description: User authentication
`);

    const result = loadYamlSpecs(path, models);
    const spec = result.entries[0].data[0] as z.infer<typeof RequirementSchema>;
    expect(spec.id).toBe('FR-001');
    expect(spec.type).toBe('functional');
  });
});

describe('NFR-005: loadYamlDir', () => {
  beforeEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  });

  it('loads all YAML files from a directory', () => {
    writeTempFile('glossary.yaml', `
model: term
specs:
  - id: TERM-001
    term: SSoT
    definition: Single Source of Truth
    category: acronym
`);
    writeTempFile('requirements.yaml', `
model: requirement
specs:
  - id: FR-001
    name: Auth
    type: functional
    priority: must
    description: User authentication
`);

    const results = loadYamlDir(testDir, models);
    expect(results).toHaveLength(2);

    const allModelIds = results.flatMap(r => r.entries.map(e => e.model.id));
    expect(allModelIds).toContain('term');
    expect(allModelIds).toContain('requirement');
  });

  it('loads .yml files', () => {
    writeTempFile('glossary.yml', `
model: term
specs:
  - id: TERM-001
    term: SSoT
    definition: Single Source of Truth
    category: acronym
`);

    const results = loadYamlDir(testDir, models);
    expect(results).toHaveLength(1);
  });

  it('loads JSON files alongside YAML', () => {
    writeTempFile('glossary.json', JSON.stringify({
      model: 'term',
      specs: [{ id: 'TERM-001', term: 'SSoT', definition: 'SSoT def', category: 'acronym' }],
    }));

    const results = loadYamlDir(testDir, models);
    expect(results).toHaveLength(1);
  });

  it('ignores _models/ subdirectory', () => {
    writeTempFile('_models/some.yaml', `
model: term
specs: []
`);
    writeTempFile('glossary.yaml', `
model: term
specs:
  - id: TERM-001
    term: SSoT
    definition: Single Source of Truth
    category: acronym
`);

    const results = loadYamlDir(testDir, models);
    expect(results).toHaveLength(1);
  });

  it('ignores non-YAML/JSON files', () => {
    writeTempFile('readme.md', '# Hello');
    writeTempFile('script.ts', 'export default {};');
    writeTempFile('glossary.yaml', `
model: term
specs:
  - id: TERM-001
    term: SSoT
    definition: Single Source of Truth
    category: acronym
`);

    const results = loadYamlDir(testDir, models);
    expect(results).toHaveLength(1);
  });

  it('returns empty array for non-existent directory', () => {
    const results = loadYamlDir(join(testDir, 'nonexistent'), models);
    expect(results).toEqual([]);
  });

  it('returns empty array for directory with no YAML files', () => {
    writeTempFile('readme.md', '# No YAML here');

    const results = loadYamlDir(testDir, models);
    expect(results).toEqual([]);
  });
});
