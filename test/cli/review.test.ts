/**
 * Review: per-target LLM judgments
 *
 * The real @aaac/runtime runTask judges every packet; only the adapter is a
 * fake that answers from the packet it receives. Records are written to a
 * temporary project directory.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import YAML from 'yaml';
import { Model, buildReferenceGraph, traverseReferenceGraph, type SpecEntry } from '../../src/core/model.js';
import { defineReviewOutput, relationsContext } from '../../src/review/index.js';
import type { ContextProvider, ReviewCheck, ReviewConfigInput } from '../../src/review/types.js';
import { buildReviewRegistry } from '../../src/review/registry.js';
import { buildPacket } from '../../src/review/packet.js';
import { resolveReviewSetup } from '../../src/review/checks.js';
import { carryOverStatus, findingFingerprint, readRecord, writeRecord, type RecordedFinding } from '../../src/review/record.js';
import { runDesignLint, COMMON_LINT_RULES } from '../../src/core/design-lint.js';

vi.mock('../../src/utils/config-loader.js', () => ({ loadConfig: vi.fn(), findConfigFile: vi.fn(() => null) }));

const { loadConfig } = await import('../../src/utils/config-loader.js');
const mockedLoadConfig = vi.mocked(loadConfig);
const { reviewCommand, reviewIngestCommand, reviewRebaselineCommand } = await import('../../src/cli/review.js');

// ============================================================================
// Fixtures
// ============================================================================

const RequirementSchema = z.object({
  id: z.string(),
  description: z.string(),
  acceptanceCriteria: z.array(z.object({ id: z.string(), description: z.string() })).optional(),
  relations: z.array(z.object({ type: z.string(), target: z.string(), description: z.string().optional() })).optional(),
});

function requirementModel(checks: ReviewCheck[]): Model<typeof RequirementSchema> {
  class RequirementModel extends Model<typeof RequirementSchema> {
    readonly id = 'requirement';
    readonly name = 'Requirement';
    readonly idPrefix = 'REQ';
    readonly schema = RequirementSchema;
    protected reviewChecks = checks;
  }
  return new RequirementModel();
}

function design(overrides: { requirements?: unknown[]; usecases?: unknown[] } = {}): SpecEntry[] {
  return [
    {
      model: { id: 'requirement', register: () => {} },
      data: overrides.requirements ?? [
        {
          id: 'REQ-001',
          description: 'The system exports reports.',
          acceptanceCriteria: [{ id: 'REQ-001-01', description: 'Reports export quickly' }],
          relations: [{ type: 'satisfies', target: 'UC-001' }],
        },
        { id: 'REQ-002', description: 'The system imports data.', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      ],
    },
    { model: { id: 'usecase', register: () => {} }, data: overrides.usecases ?? [{ id: 'UC-001', description: 'Manage reports' }] },
  ];
}

const verifiability: ReviewCheck = {
  id: 'req-verifiability',
  description: 'Each acceptance criterion can be verified',
  prompt: 'Report acceptance criteria that cannot be verified.',
};

interface Project {
  dir: string;
  models: unknown[];
  specs: SpecEntry[];
  review?: ReviewConfigInput;
}

let project: Project;

function useProject(p: Omit<Project, 'dir'>): void {
  project = { ...p, dir: project.dir };
  mockedLoadConfig.mockImplementation(async () => ({
    srcDir: 'src',
    designDir: 'design',
    docsDir: 'docs',
    specsDir: 'specs',
    models: project.models,
    specs: project.specs,
    review: project.review,
  }));
}

// ----------------------------------------------------------------------------
// Fake adapter: answers each call from the packet it receives
// ----------------------------------------------------------------------------

interface Call {
  target: string;
  prompt: string;
  followUp: boolean;
  verify: boolean;
}

type Answer = (call: Call) => unknown | Promise<unknown>;

function fakeJudge(answer: Answer, usage: { inputTokens: number; outputTokens: number } | null = { inputTokens: 100, outputTokens: 20 }) {
  const created: Array<{ name: string; options: Record<string, unknown>; cwdEntries: string[] }> = [];
  const calls: Call[] = [];
  const createAdapter = vi.fn(async (name: string, options?: Record<string, unknown>) => {
    created.push({ name, options: options ?? {}, cwdEntries: readdirSync(String(options?.cwd)) });
    let first: Call | undefined;
    const respond = async (call: Call): Promise<string> => {
      calls.push(call);
      const result = await answer(call);
      if (result instanceof Error) throw result;
      return typeof result === 'string' ? result : JSON.stringify(result);
    };
    return {
      async send(prompt: string) {
        first = {
          target: /## Target: (\S+)/.exec(prompt)?.[1] ?? '',
          prompt,
          followUp: false,
          verify: prompt.includes('# Verification request'),
        };
        return respond(first);
      },
      async followUp(message: string) {
        return respond({ ...first!, prompt: message, followUp: true });
      },
      ...(usage ? { getLastTokenUsage: () => usage } : {}),
    };
  });
  return { createAdapter, created, calls };
}

const noFindings: Answer = () => ({ findings: [] });

function environment(judge: ReturnType<typeof fakeJudge>, env: NodeJS.ProcessEnv = { CLAUDE_CODE_OAUTH_TOKEN: 'token' }) {
  return {
    env,
    cwd: project.dir,
    loadRuntime: () => import('@aaac/runtime'),
    createAdapter: judge.createAdapter as never,
    now: () => new Date('2026-10-09T10:00:00Z'),
  };
}

function recordFile(check: string, target: string): string {
  return join(project.dir, 'review', check, `${target}.yaml`);
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let stdoutSpy: ReturnType<typeof vi.spyOn>;

const stdout = (): string =>
  [...logSpy.mock.calls.map(c => String(c[0])), ...stdoutSpy.mock.calls.map(c => String(c[0]))].join('\n');
const stderr = (): string => errorSpy.mock.calls.map(c => String(c[0])).join('\n');

// Loading the runtime is a one-off cost; it belongs to no single test's time budget
beforeAll(async () => {
  await import('@aaac/runtime');
}, 60_000);

beforeEach(() => {
  project = { dir: mkdtempSync(join(tmpdir(), 'speckeeper-review-test-')), models: [], specs: [] };
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(project.dir, { recursive: true, force: true });
});

// ============================================================================
// Declaration
// ============================================================================

describe('FR-1200 review check declaration', () => {
  it('FR-1200-01 plans checks declared in config review.checks and in a model\'s reviewChecks', async () => {
    useProject({
      models: [requirementModel([verifiability])],
      specs: design(),
      review: {
        checks: [{
          id: 'usecase-coverage',
          description: 'Each use case is satisfied',
          select: registry => [...registry.models.usecase.keys()].map(id => ({ id, specIds: [id] })),
          prompt: 'Report use cases no requirement satisfies.',
        }],
      },
    });

    expect(await reviewCommand({ dryRun: true, format: 'json' }, environment(fakeJudge(noFindings)))).toBe(0);

    const run = (JSON.parse(stdout()) as { run: Array<{ check: string; target: string }> }).run;
    expect(run.map(r => `${r.check}/${r.target}`)).toEqual([
      'req-verifiability/REQ-001',
      'req-verifiability/REQ-002',
      'usecase-coverage/UC-001',
    ]);
  });

  it('FR-1200-02 defaults a model check to one target per spec, and a select() target may span several specs', async () => {
    const pair: ReviewCheck = {
      ...verifiability,
      id: 'req-pair',
      select: () => [{ id: 'REQ-001-vs-REQ-002', specIds: ['REQ-001', 'REQ-002'] }],
    };
    useProject({ models: [requirementModel([verifiability, pair])], specs: design() });

    await reviewCommand({ dryRun: true, format: 'json' }, environment(fakeJudge(noFindings)));

    const run = (JSON.parse(stdout()) as { run: Array<{ check: string; target: string }> }).run;
    expect(run.filter(r => r.check === 'req-verifiability').map(r => r.target)).toEqual(['REQ-001', 'REQ-002']);
    expect(run.filter(r => r.check === 'req-pair').map(r => r.target)).toEqual(['REQ-001-vs-REQ-002']);
  });

  it('FR-1200-02 rejects a config check without select() and a target naming an unknown spec', async () => {
    const run = async (review: ReviewConfigInput) => {
      useProject({ models: [], specs: design(), review });
      return reviewCommand({ dryRun: true }, environment(fakeJudge(noFindings)));
    };

    expect(await run({ checks: [{ ...verifiability }] })).toBe(1);
    expect(stderr()).toContain('needs select()');
    expect(await run({ checks: [{ ...verifiability, select: () => [{ id: 'X', specIds: ['REQ-404'] }] }] })).toBe(1);
    expect(stderr()).toContain('no spec has the ID "REQ-404"');
  });

  it('FR-1200-03 lets defineReviewOutput add only extra fields, and records them under extra', async () => {
    expect(() => defineReviewOutput({ findingExtra: { severity: z.string() } })).toThrow('redefines a common finding field');
    expect(() => defineReviewOutput({ extra: { findings: z.array(z.string()) } })).toThrow('redefines a common output field');

    const output = defineReviewOutput({ findingExtra: { reason: z.string() }, extra: { score: z.number() } });
    useProject({ models: [requirementModel([{ ...verifiability, output }])], specs: design() });
    const judge = fakeJudge(({ target }) => ({
      score: 0.5,
      findings: target === 'REQ-001'
        ? [{ code: 'AC-VAGUE', severity: 'warning', message: 'Vague', subject: 'REQ-001#acceptanceCriteria[0]', reason: 'no number' }]
        : [],
    }));

    expect(await reviewCommand({}, environment(judge))).toBe(0);

    const record = readRecord(recordFile('req-verifiability', 'REQ-001'))!;
    expect(record.extra).toEqual({ score: 0.5 });
    expect(record.findings[0].extra).toEqual({ reason: 'no number' });
  });
});

// ============================================================================
// Context providers
// ============================================================================

describe('FR-1201 review context provider', () => {
  it('FR-1201-01 accepts an async provider and hashes the files it reports', async () => {
    writeFileSync(join(project.dir, 'glossary.md'), 'Report: a document.\n');
    const provider: ContextProvider = {
      id: 'glossary',
      build: async target => ({ body: `${target.id}\n${readFileSync(join(project.dir, 'glossary.md'), 'utf-8')}`, inputs: target.specIds, files: ['glossary.md'] }),
    };
    useProject({
      models: [requirementModel([{ ...verifiability, context: 'glossary' }])],
      specs: design(),
      review: { contextProviders: [provider] },
    });

    expect(await reviewCommand({}, environment(fakeJudge(noFindings)))).toBe(0);
    const record = readRecord(recordFile('req-verifiability', 'REQ-001'))!;
    expect(record.inputs).toEqual(['REQ-001']);
    expect(Object.keys(record.inputHashes.files)).toEqual(['glossary.md']);

    writeFileSync(join(project.dir, 'glossary.md'), 'Report: a document with a title.\n');
    logSpy.mockClear();
    await reviewCommand({ dryRun: true, format: 'json' }, environment(fakeJudge(noFindings)));
    const run = (JSON.parse(stdout()) as { run: Array<{ target: string; reasons: string[] }> }).run;
    expect(run.find(r => r.target === 'REQ-001')!.reasons).toEqual(['file:glossary.md changed']);
  });

  it('FR-1201-02 the relations provider follows the impact traversal with depth, relation types and an edge filter, in a stable order', async () => {
    const specs = design({
      requirements: [
        {
          id: 'REQ-001',
          description: 'Root',
          relations: [
            { type: 'satisfies', target: 'UC-001' },
            { type: 'relatedTo', target: 'REQ-002', description: 'source: workshop notes' },
            { type: 'refines', target: 'REQ-003' },
          ],
        },
        { id: 'REQ-002', description: 'Sibling' },
        { id: 'REQ-003', description: 'Parent', relations: [{ type: 'satisfies', target: 'UC-002' }] },
      ],
      usecases: [{ id: 'UC-001', description: 'One' }, { id: 'UC-002', description: 'Two' }],
    });
    const registry = buildReviewRegistry(specs);
    const target = { id: 'REQ-001', specIds: ['REQ-001'] };

    const all = await relationsContext({ depth: 2 }).build(target, registry);
    const impactOrder = traverseReferenceGraph(buildReferenceGraph(specs), 'REQ-001', { depth: 2, direction: 'both' }).map(r => r.id);
    expect(all.inputs).toEqual(['REQ-001', ...impactOrder]);
    expect(all.inputs).toEqual(['REQ-001', 'REQ-002', 'REQ-003', 'UC-001', 'UC-002']);

    expect((await relationsContext().build(target, registry)).inputs).toEqual(['REQ-001', 'REQ-002', 'REQ-003', 'UC-001']);
    expect((await relationsContext({ relationTypes: ['satisfies'] }).build(target, registry)).inputs).toEqual(['REQ-001', 'UC-001']);
    const noProvenance = relationsContext({ edgeFilter: edge => !edge.description?.startsWith('source:') });
    expect((await noProvenance.build(target, registry)).inputs).toEqual(['REQ-001', 'REQ-003', 'UC-001']);

    const reversed = buildReviewRegistry([...specs].reverse());
    expect((await relationsContext({ depth: 2 }).build(target, reversed)).body).toBe(all.body);
  });
});

// ============================================================================
// Packet
// ============================================================================

describe('FR-1202 review packet hash', () => {
  it('FR-1202-01 NFR-017-01 the same specs and config give the same hash regardless of order, line endings and concurrency', async () => {
    writeFileSync(join(project.dir, 'prompt-lf.md'), 'Report vague criteria.\nBe brief.\n');
    writeFileSync(join(project.dir, 'prompt-crlf.md'), 'Report vague criteria.\r\nBe brief.\r\n');
    const hashOf = async (promptFile: string, specs: SpecEntry[]) => {
      const setup = resolveReviewSetup(undefined, [requirementModel([{ ...verifiability, prompt: { file: promptFile } }])], project.dir)!;
      const registry = buildReviewRegistry(specs);
      const packets = await Promise.all(['REQ-002', 'REQ-001'].map(id =>
        buildPacket(setup.checks[0], { id, specIds: [id] }, registry, project.dir)));
      return Object.fromEntries(packets.map(p => [p.targetId, p.hash]));
    };

    const base = await hashOf('prompt-lf.md', design());
    expect(await hashOf('prompt-lf.md', design())).toEqual(base);
    expect(await hashOf('prompt-crlf.md', design())).toEqual(base);
    expect(await hashOf('prompt-lf.md', [...design()].reverse())).toEqual(base);
    expect(base['REQ-001']).not.toBe(base['REQ-002']);
  });

  it('FR-1202-02 --show-packet prints the packet without calling the LLM', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    const judge = fakeJudge(noFindings);

    expect(await reviewCommand({ showPacket: true, target: ['REQ-001'] }, environment(judge))).toBe(0);

    expect(stdout()).toContain('## Check: req-verifiability');
    expect(stdout()).toContain('## Target: REQ-001');
    expect(stdout()).toContain('Report acceptance criteria that cannot be verified.');
    expect(stdout()).not.toContain('## Target: REQ-002');
    expect(judge.createAdapter).not.toHaveBeenCalled();
  });

  it('FR-1202-03 records the judge signature apart from the packet hash, which does not depend on the model', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });

    await reviewCommand({ model: 'claude-model-a', target: ['REQ-001'] }, environment(fakeJudge(noFindings)));
    const first = readRecord(recordFile('req-verifiability', 'REQ-001'))!;
    await reviewCommand({ model: 'claude-model-b', target: ['REQ-001'], force: true }, environment(fakeJudge(noFindings)));
    const second = readRecord(recordFile('req-verifiability', 'REQ-001'))!;

    expect(first.judge).toEqual({ adapter: 'claude', model: 'claude-model-a' });
    expect(second.judge).toEqual({ adapter: 'claude', model: 'claude-model-b' });
    expect(second.packetHash).toBe(first.packetHash);
  });
});

// ============================================================================
// Judge execution
// ============================================================================

describe('FR-1203 review judge execution', () => {
  it('FR-1203-01 creates each adapter without tools and with an empty temporary working directory', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    const judge = fakeJudge(noFindings);

    await reviewCommand({}, environment(judge));

    expect(judge.created).toHaveLength(2);
    for (const { name, options, cwdEntries } of judge.created) {
      expect(name).toBe('claude');
      expect(options.tools).toEqual([]);
      expect(options.permissionMode).toBe('default');
      expect(String(options.cwd)).not.toBe(project.dir);
      expect(cwdEntries).toEqual([]);
    }
  });

  it('FR-1203-02 corrects a malformed answer once, and reports a target whose answer stays malformed', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    const judge = fakeJudge(({ target, followUp }) => {
      if (target === 'REQ-001') return followUp ? { findings: [] } : 'not json at all';
      return { findings: [{ code: 'X', severity: 'error' }] };
    });

    expect(await reviewCommand({}, environment(judge))).toBe(1);

    expect(judge.calls.filter(c => c.target === 'REQ-001').map(c => c.followUp)).toEqual([false, true]);
    expect(judge.calls.filter(c => c.target === 'REQ-002').map(c => c.followUp)).toEqual([false, true]);
    expect(existsSync(recordFile('req-verifiability', 'REQ-001'))).toBe(true);
    expect(existsSync(recordFile('req-verifiability', 'REQ-002'))).toBe(false);
    expect(stdout()).toContain('req-verifiability / REQ-002: the answer did not match the output schema after one correction');
  });

  it('FR-1203-03 stops starting calls after an adapter error and keeps the records already written', async () => {
    useProject({
      models: [requirementModel([verifiability])],
      specs: design({ requirements: ['REQ-001', 'REQ-002', 'REQ-003'].map(id => ({ id, description: id })) }),
    });
    const judge = fakeJudge(({ target }) => (target === 'REQ-002' ? new Error('429 rate limit exceeded') : { findings: [] }));

    expect(await reviewCommand({ concurrency: '1' }, environment(judge))).toBe(12);

    expect(judge.calls.map(c => c.target)).toEqual(['REQ-001', 'REQ-002']);
    expect(existsSync(recordFile('req-verifiability', 'REQ-001'))).toBe(true);
    expect(existsSync(recordFile('req-verifiability', 'REQ-003'))).toBe(false);
    expect(stdout()).toContain('429 rate limit exceeded');
  });

  it('FR-1203-04 records no usage when the runtime reports none', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });

    await reviewCommand({ target: ['REQ-001'] }, environment(fakeJudge(noFindings, null)));

    expect(readRecord(recordFile('req-verifiability', 'REQ-001'))!.usage).toBeUndefined();
  });

  it('FR-1203-03 starts no verifier call once the adapter call of another target failed', async () => {
    useProject({
      models: [requirementModel([{ ...verifiability, verify: { prompt: 'Check the finding.' } }])],
      specs: design(),
    });
    let failed!: () => void;
    const failure = new Promise<void>(resolve => { failed = resolve; });
    const judge = fakeJudge(async ({ target, verify }) => {
      if (target === 'REQ-001') {
        failed();
        return new Error('usage limit reached');
      }
      if (verify) return { verdict: 'confirmed', rationale: 'r' };
      await failure;
      return { findings: [{ code: 'C', severity: 'error', message: 'm' }] };
    });

    expect(await reviewCommand({ concurrency: '2' }, environment(judge))).toBe(12);

    expect(judge.calls.filter(c => c.verify)).toEqual([]);
    expect(existsSync(recordFile('req-verifiability', 'REQ-002'))).toBe(false);
  });

  it('FR-1203-04 stores the token usage the runtime reports', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });

    await reviewCommand({ target: ['REQ-001'] }, environment(fakeJudge(noFindings, { inputTokens: 1234, outputTokens: 56 })));

    expect(readRecord(recordFile('req-verifiability', 'REQ-001'))!.usage).toEqual({ inputTokens: 1234, outputTokens: 56 });
  });
});

// ============================================================================
// Credentials
// ============================================================================

describe('FR-1204 review credential policy', () => {
  beforeEach(() => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
  });

  it('FR-1204-01 skips with exit 0 and touches no record when CI has no credentials', async () => {
    const judge = fakeJudge(noFindings);

    expect(await reviewCommand({}, environment(judge, { CI: 'true' }))).toBe(0);

    expect(stderr()).toContain('review skipped: no credentials for the claude adapter');
    expect(judge.createAdapter).not.toHaveBeenCalled();
    expect(existsSync(join(project.dir, 'review'))).toBe(false);
  });

  it('FR-1204-01 skips when the logged-in Claude Code turns out not to be logged in', async () => {
    const judge = fakeJudge(() => new Error('Invalid API key · Please run /login'));

    expect(await reviewCommand({}, environment(judge, {}))).toBe(0);

    expect(judge.calls).toHaveLength(1);
    expect(stderr()).toContain('the logged-in Claude Code could not be used');
    expect(existsSync(join(project.dir, 'review'))).toBe(false);
  });

  it('FR-1204-02 --require-judge turns an unavailable judge into exit 14', async () => {
    expect(await reviewCommand({ requireJudge: true }, environment(fakeJudge(noFindings), { CI: '1' }))).toBe(14);
    expect(await reviewCommand({ requireJudge: true }, environment(fakeJudge(noFindings), { OPENAI_API_KEY: '' }), )).toBe(0);
  });

  it('FR-1204-03 refuses API-key billing with exit 13 when allowApiKey is false, unless --allow-api-key is given', async () => {
    project.review = { allowApiKey: false };
    const judge = fakeJudge(noFindings);

    expect(await reviewCommand({}, environment(judge, { ANTHROPIC_API_KEY: 'sk-test' }))).toBe(13);
    expect(judge.createAdapter).not.toHaveBeenCalled();

    expect(await reviewCommand({ allowApiKey: true }, environment(judge, { ANTHROPIC_API_KEY: 'sk-test' }))).toBe(0);
    expect(judge.createAdapter).toHaveBeenCalled();
  });
});

// ============================================================================
// Output schema
// ============================================================================

describe('FR-1205 review output schema', () => {
  beforeEach(() => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
  });

  async function judgeWith(finding: Record<string, unknown>): Promise<{ exit: number; followUps: number }> {
    const judge = fakeJudge(({ target }) => ({
      findings: target === 'REQ-001' ? [{ code: 'C', severity: 'warning', message: 'm', ...finding }] : [],
    }));
    const exit = await reviewCommand({ target: ['REQ-001'], force: true }, environment(judge));
    return { exit, followUps: judge.calls.filter(c => c.followUp).length };
  }

  it('FR-1205-01 accepts the lint severities and rejects any other', async () => {
    for (const severity of ['error', 'warning', 'info']) {
      expect((await judgeWith({ severity })).exit).toBe(0);
    }
    expect(await judgeWith({ severity: 'critical' })).toEqual({ exit: 1, followUps: 1 });
  });

  it('FR-1205-02 treats an unknown spec ID or field path in subject or evidence as a schema mismatch', async () => {
    expect((await judgeWith({ subject: 'REQ-001#acceptanceCriteria[0].description', evidence: ['UC-001'] })).exit).toBe(0);
    expect(await judgeWith({ evidence: ['UC-404'] })).toEqual({ exit: 1, followUps: 1 });
    expect(await judgeWith({ subject: 'REQ-404' })).toEqual({ exit: 1, followUps: 1 });
    expect(await judgeWith({ subject: 'REQ-001#acceptanceCriteria[5]' })).toEqual({ exit: 1, followUps: 1 });
  });

  it('FR-1205-03 accepts a quote found in the context after collapsing whitespace, and rejects one that is not there', async () => {
    expect((await judgeWith({ location: { quote: 'The   system\n exports reports.' } })).exit).toBe(0);
    expect(await judgeWith({ location: { quote: 'The system deletes reports.' } })).toEqual({ exit: 1, followUps: 1 });
  });
});

// ============================================================================
// Incremental selection
// ============================================================================

describe('FR-1206 incremental review selection', () => {
  it('FR-1206-01 skips an unchanged target without calling the LLM', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    await reviewCommand({}, environment(fakeJudge(noFindings)));

    const again = fakeJudge(noFindings);
    expect(await reviewCommand({}, environment(again))).toBe(0);

    expect(again.createAdapter).not.toHaveBeenCalled();
    expect(stdout()).toContain('Every selected target has a current record');
  });

  it('FR-1206-02 --dry-run gives the changed inputs with the relation path, and estimates tokens from recorded usage', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    await reviewCommand({}, environment(fakeJudge(noFindings, { inputTokens: 300, outputTokens: 100 })));

    project.specs = design({ usecases: [{ id: 'UC-001', description: 'Manage and archive reports' }] });
    logSpy.mockClear();
    expect(await reviewCommand({ dryRun: true, format: 'json' }, environment(fakeJudge(noFindings)))).toBe(0);

    const result = JSON.parse(stdout()) as { run: Array<{ target: string; reasons: string[] }>; skip: unknown[]; estimatedTokens: number };
    expect(result.run).toEqual([
      { check: 'req-verifiability', target: 'REQ-001', reasons: ['spec:UC-001 changed (REQ-001 -satisfies-> UC-001)'] },
      { check: 'req-verifiability', target: 'REQ-002', reasons: ['spec:UC-001 changed (REQ-002 -satisfies-> UC-001)'] },
    ]);
    expect(result.skip).toEqual([]);
    expect(result.estimatedTokens).toBe(800);
  });

  it('FR-1206-02 lists the skipped targets with their reasons and averages recorded usage over every record of the check', async () => {
    useProject({
      models: [requirementModel([verifiability])],
      specs: design({ requirements: ['REQ-001', 'REQ-002', 'REQ-003'].map(id => ({ id, description: id })) }),
    });
    await reviewCommand({ target: ['REQ-001'] }, environment(fakeJudge(noFindings, { inputTokens: 300, outputTokens: 100 })));

    logSpy.mockClear();
    await reviewCommand({ dryRun: true, format: 'json', target: ['REQ-002'] }, environment(fakeJudge(noFindings)));
    expect((JSON.parse(stdout()) as { estimatedTokens: number }).estimatedTokens).toBe(400);

    logSpy.mockClear();
    await reviewCommand({ dryRun: true, format: 'json', maxTargets: '1' }, environment(fakeJudge(noFindings)));
    const result = JSON.parse(stdout()) as { run: Array<{ target: string }>; skip: Array<{ target: string; reasons: string[] }> };
    expect(result.run.map(r => r.target)).toEqual(['REQ-002']);
    expect(result.skip).toEqual([
      { check: 'req-verifiability', target: 'REQ-001', reasons: ['current'] },
      { check: 'req-verifiability', target: 'REQ-003', reasons: ['beyond --max-targets'] },
    ]);

    logSpy.mockClear();
    await reviewCommand({ dryRun: true, format: 'json', force: true, maxTargets: '1' }, environment(fakeJudge(noFindings)));
    const forced = JSON.parse(stdout()) as { run: Array<{ target: string; reasons: string[] }>; skip: Array<{ target: string; reasons: string[] }> };
    expect(forced.run).toEqual([{ check: 'req-verifiability', target: 'REQ-002', reasons: ['no record'] }]);
    expect(forced.skip.map(r => [r.target, r.reasons])).toEqual([['REQ-001', ['beyond --max-targets']], ['REQ-003', ['beyond --max-targets']]]);
  });

  it('FR-1206-02 names the relation the context followed to a changed spec, not one the context leaves out', async () => {
    const specs = (uc: string) => design({
      requirements: [{
        id: 'REQ-001',
        description: 'Root',
        relations: [
          { type: 'relatedTo', target: 'UC-001', description: 'source: workshop notes' },
          { type: 'satisfies', target: 'UC-001' },
        ],
      }],
      usecases: [{ id: 'UC-001', description: uc }],
    });
    useProject({
      models: [requirementModel([{ ...verifiability, context: relationsContext({ edgeFilter: e => !e.description?.startsWith('source:') }) }])],
      specs: specs('One'),
    });
    await reviewCommand({}, environment(fakeJudge(noFindings)));

    project.specs = specs('One, revised');
    logSpy.mockClear();
    await reviewCommand({ dryRun: true, format: 'json' }, environment(fakeJudge(noFindings)));

    expect((JSON.parse(stdout()) as { run: Array<{ reasons: string[] }> }).run[0].reasons)
      .toEqual(['spec:UC-001 changed (REQ-001 -satisfies-> UC-001)']);
  });

  it('FR-1206-03 --max-targets splits a run in a stable order without judging a target twice', async () => {
    useProject({
      models: [requirementModel([verifiability])],
      specs: design({ requirements: ['REQ-003', 'REQ-001', 'REQ-002'].map(id => ({ id, description: id })) }),
    });
    const judge = fakeJudge(noFindings);

    await reviewCommand({ maxTargets: '2' }, environment(judge));
    await reviewCommand({ maxTargets: '2' }, environment(judge));
    await reviewCommand({ maxTargets: '2' }, environment(judge));

    expect(judge.calls.map(c => c.target)).toEqual(['REQ-001', 'REQ-002', 'REQ-003']);
  });
});

// ============================================================================
// Verifier
// ============================================================================

describe('FR-1207 review verifier', () => {
  it('FR-1207-01 keeps a false positive with its text, status and the verifier rationale', async () => {
    useProject({
      models: [requirementModel([{ ...verifiability, verify: { prompt: 'Check the finding against the context.' } }])],
      specs: design(),
    });
    const judge = fakeJudge(({ target, verify, prompt }) => {
      if (verify) {
        return prompt.includes('"code": "AC-VAGUE"')
          ? { verdict: 'false_positive', rationale: 'The criterion names a measurable target.' }
          : { verdict: 'confirmed', rationale: 'Supported.' };
      }
      return {
        findings: target === 'REQ-001'
          ? [
              { code: 'AC-VAGUE', severity: 'warning', message: 'Quickly is vague', subject: 'REQ-001#acceptanceCriteria[0]' },
              { code: 'AC-MISSING', severity: 'error', message: 'No failure case', subject: 'REQ-001' },
            ]
          : [],
      };
    });

    expect(await reviewCommand({}, environment(judge))).toBe(0);

    const findings = readRecord(recordFile('req-verifiability', 'REQ-001'))!.findings;
    expect(findings.map(f => [f.code, f.status, f.verifier?.verdict])).toEqual([
      ['AC-MISSING', 'open', 'confirmed'],
      ['AC-VAGUE', 'false_positive', 'false_positive'],
    ]);
    expect(findings[1].message).toBe('Quickly is vague');
    expect(findings[1].verifier?.rationale).toBe('The criterion names a measurable target.');
  });
});

// ============================================================================
// Records
// ============================================================================

describe('FR-1207 verifier verdicts across judgments', () => {
  it('FR-1207-01 decides the verifier false positive again on the next judgment', async () => {
    useProject({
      models: [requirementModel([{ ...verifiability, verify: { prompt: 'Check the finding.' } }])],
      specs: design(),
    });
    let verdict = 'false_positive';
    const answer: Answer = ({ target, verify }) => {
      if (verify) return { verdict, rationale: `verdict ${verdict}` };
      return { findings: target === 'REQ-001' ? [{ code: 'C', severity: 'error', message: 'm', subject: 'REQ-001' }] : [] };
    };
    await reviewCommand({ target: ['REQ-001'] }, environment(fakeJudge(answer)));
    expect(readRecord(recordFile('req-verifiability', 'REQ-001'))!.findings[0].status).toBe('false_positive');

    verdict = 'confirmed';
    await reviewCommand({ target: ['REQ-001'], force: true }, environment(fakeJudge(answer)));

    const finding = readRecord(recordFile('req-verifiability', 'REQ-001'))!.findings[0];
    expect([finding.status, finding.verifier?.verdict]).toEqual(['open', 'confirmed']);
  });
});

describe('FR-1213 review rules', () => {
  const rules = [
    { code: 'AC-VAGUE', severity: 'warning' as const, description: 'A criterion without a number or a decision rule' },
    { code: 'AC-NO-ERROR', severity: 'error' as const, description: 'No criterion for the error case' },
  ];
  const withRules: ReviewCheck = { ...verifiability, rules };

  it('FR-1213-01 lists the rules in the packet and makes the record stale when a rule changes', async () => {
    useProject({ models: [requirementModel([withRules])], specs: design() });
    await reviewCommand({ showPacket: true, target: ['REQ-001'] }, environment(fakeJudge(noFindings)));
    expect(stdout()).toContain('## Rules');
    expect(stdout()).toContain('- AC-VAGUE (warning): A criterion without a number or a decision rule');
    expect(stdout()).toContain('- AC-NO-ERROR (error): No criterion for the error case');

    await reviewCommand({ target: ['REQ-001'] }, environment(fakeJudge(noFindings)));
    expect(readRecord(recordFile('req-verifiability', 'REQ-001'))!.inputHashes.rules).toMatch(/^sha256:/);

    project.models = [requirementModel([{ ...withRules, rules: [...rules, { code: 'AC-DUP', severity: 'info', description: 'Duplicate criteria' }] }])];
    logSpy.mockClear();
    stdoutSpy.mockClear();
    await reviewCommand({ dryRun: true, format: 'json', target: ['REQ-001'] }, environment(fakeJudge(noFindings)));
    expect((JSON.parse(stdout()) as { run: Array<{ reasons: string[] }> }).run[0].reasons).toEqual(['rules changed', 'schema changed']);
  });

  it('FR-1213-01 rejects empty rules, a malformed rule and a code declared twice', async () => {
    const run = async (badRules: unknown) => {
      useProject({ models: [requirementModel([{ ...verifiability, rules: badRules as never }])], specs: design() });
      return reviewCommand({ dryRun: true }, environment(fakeJudge(noFindings)));
    };

    expect(await run([])).toBe(1);
    expect(await run([{ code: 'X', severity: 'fatal', description: 'd' }])).toBe(1);
    expect(await run([rules[0], { ...rules[0] }])).toBe(1);
    expect(stderr()).toContain('rule code "AC-VAGUE" is declared twice');
  });

  it('FR-1213-02 treats a code that is not a declared rule as a schema mismatch', async () => {
    useProject({ models: [requirementModel([withRules])], specs: design() });
    const judge = fakeJudge(({ target, followUp }) => ({
      findings: target === 'REQ-001'
        ? [{ code: followUp ? 'AC-VAGUE' : 'AC-OTHER', message: 'Quickly is vague' }]
        : [{ code: 'AC-MADE-UP', message: 'm' }],
    }));

    expect(await reviewCommand({}, environment(judge))).toBe(1);

    expect(readRecord(recordFile('req-verifiability', 'REQ-001'))!.findings.map(f => f.code)).toEqual(['AC-VAGUE']);
    expect(existsSync(recordFile('req-verifiability', 'REQ-002'))).toBe(false);
  });

  it('FR-1213-03 records the severity of the rule, not one the judge gives', async () => {
    useProject({ models: [requirementModel([withRules])], specs: design() });
    const judge = fakeJudge(({ target }) => ({
      findings: target === 'REQ-001'
        ? [{ code: 'AC-NO-ERROR', message: 'No failure case' }, { code: 'AC-VAGUE', message: 'Vague' }]
        : [],
    }));

    expect(await reviewCommand({}, environment(judge))).toBe(0);

    expect(readRecord(recordFile('req-verifiability', 'REQ-001'))!.findings.map(f => [f.code, f.severity]))
      .toEqual([['AC-NO-ERROR', 'error'], ['AC-VAGUE', 'warning']]);
    // The judge is shown no severity to give
    expect(judge.calls[0].prompt).not.toContain('"severity"');
  });

  it('FR-1213-03 an ingested result takes its severity from the rule as well', async () => {
    useProject({ models: [requirementModel([withRules])], specs: design() });
    await reviewCommand({ emit: 'packets', target: ['REQ-001'] }, environment(fakeJudge(noFindings)));
    const [entry] = (YAML.parse(readFileSync(join(project.dir, 'packets', 'index.yaml'), 'utf-8')) as {
      packets: Array<{ packetHash: string; result: string }>;
    }).packets;
    writeFileSync(join(project.dir, 'packets', entry.result), YAML.stringify({
      packetHash: entry.packetHash,
      output: { findings: [{ code: 'AC-NO-ERROR', message: 'No failure case' }] },
    }));

    expect(await reviewIngestCommand(join(project.dir, 'packets'), {}, { cwd: project.dir })).toBe(0);

    expect(readRecord(recordFile('req-verifiability', 'REQ-001'))!.findings.map(f => f.severity)).toEqual(['error']);
  });

  it('FR-1213-04 a check without rules lets the judge choose the code and the severity', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    const judge = fakeJudge(({ target }) => ({
      findings: target === 'REQ-001' ? [{ code: 'ANYTHING', severity: 'info', message: 'm' }] : [],
    }));

    expect(await reviewCommand({}, environment(judge))).toBe(0);

    expect(readRecord(recordFile('req-verifiability', 'REQ-001'))!.findings.map(f => [f.code, f.severity])).toEqual([['ANYTHING', 'info']]);
    expect(judge.calls[0].prompt).not.toContain('## Rules');
  });
});

describe('FR-1208 judgment record store', () => {
  const finding = (code: string, extra: Partial<RecordedFinding> = {}): RecordedFinding => ({
    fingerprint: findingFingerprint('c', 't', { code, severity: 'warning', message: 'm', subject: 'REQ-001' }),
    code,
    severity: 'warning',
    message: 'm',
    subject: 'REQ-001',
    status: 'open',
    ...extra,
  });

  it('FR-1208-01 writes records with a fixed key order and sorted lists', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    const answer: Answer = ({ target }) => ({
      findings: target === 'REQ-001'
        ? [
            { code: 'B', severity: 'warning', message: 'b', evidence: ['UC-001', 'REQ-002'] },
            { code: 'A', severity: 'error', message: 'a' },
          ]
        : [],
    });
    await reviewCommand({ target: ['REQ-001'] }, environment(fakeJudge(answer)));
    const first = readFileSync(recordFile('req-verifiability', 'REQ-001'), 'utf-8');
    await reviewCommand({ target: ['REQ-001'], force: true }, environment(fakeJudge(answer)));
    const second = readFileSync(recordFile('req-verifiability', 'REQ-001'), 'utf-8');

    expect(second).toBe(first);
    const parsed = YAML.parse(first) as Record<string, unknown> & { findings: Array<{ code: string; evidence?: string[] }> };
    expect(Object.keys(parsed)).toEqual(['check', 'target', 'packetHash', 'inputs', 'inputHashes', 'judge', 'judgedAt', 'usage', 'findings']);
    expect(parsed.findings.map(f => f.code)).toEqual(['A', 'B']);
    expect(parsed.findings[1].evidence).toEqual(['REQ-002', 'UC-001']);
  });

  it('FR-1208-02 makes the fingerprint from check, target, code, subject or quote, and sorted evidence, never the message', () => {
    const base = { code: 'C', severity: 'warning' as const, message: 'one wording', subject: 'REQ-001', evidence: ['A', 'B'] };
    const fp = findingFingerprint('check', 'target', base);

    expect(findingFingerprint('check', 'target', { ...base, message: 'another wording' })).toBe(fp);
    expect(findingFingerprint('check', 'target', { ...base, evidence: ['B', 'A'] })).toBe(fp);
    expect(findingFingerprint('check', 'target', { ...base, code: 'D' })).not.toBe(fp);
    expect(findingFingerprint('check', 'other', base)).not.toBe(fp);
    const quoted = { code: 'C', severity: 'warning' as const, message: 'm', location: { quote: 'exports  reports' } };
    expect(findingFingerprint('c', 't', quoted)).toBe(findingFingerprint('c', 't', { ...quoted, location: { quote: 'exports reports' } }));
  });

  it('FR-1208-03 a dismissed finding needs a statusNote', () => {
    const path = join(project.dir, 'review', 'c', 't.yaml');
    const record = {
      check: 'c',
      target: 't',
      packetHash: `sha256:${'0'.repeat(64)}`,
      inputs: [],
      inputHashes: { prompt: `sha256:${'1'.repeat(64)}`, schema: `sha256:${'2'.repeat(64)}`, specs: {}, files: {} },
      judge: { adapter: 'claude' },
      judgedAt: '2026-10-09T10:00:00.000Z',
      findings: [finding('C', { status: 'dismissed', statusNote: 'Accepted by the product owner' })],
    };
    writeRecord(path, record);
    expect(readRecord(path)!.findings[0].status).toBe('dismissed');

    mkdirSync(join(project.dir, 'review', 'c'), { recursive: true });
    writeFileSync(path, YAML.stringify({ ...record, findings: [finding('C', { status: 'dismissed' })] }));
    expect(() => readRecord(path)).toThrow('a dismissed finding needs a statusNote');
  });

  it('FR-1208-04 stores per-input hashes for the prompt, the schema, each spec and each file', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    await reviewCommand({ target: ['REQ-001'] }, environment(fakeJudge(noFindings)));

    const { inputHashes, inputs } = readRecord(recordFile('req-verifiability', 'REQ-001'))!;
    expect(inputs).toEqual(['REQ-001', 'UC-001']);
    expect(Object.keys(inputHashes)).toEqual(['prompt', 'schema', 'specs', 'files']);
    expect(Object.keys(inputHashes.specs)).toEqual(['REQ-001', 'UC-001']);
    expect(inputHashes.files).toEqual({});
  });

  it('FR-1208-05 carries a status over only for a one-to-one fingerprint match', () => {
    const dismissed = finding('C', { status: 'dismissed', statusNote: 'ok' });
    expect(carryOverStatus([dismissed], [finding('C')])).toEqual([dismissed]);

    const twiceBefore = [dismissed, { ...dismissed }];
    expect(carryOverStatus(twiceBefore, [finding('C')])[0].status).toBe('open');
    expect(carryOverStatus([dismissed], [finding('C'), finding('C')]).map(f => f.status)).toEqual(['open', 'open']);
    expect(carryOverStatus([dismissed], [finding('D')])[0].status).toBe('open');
  });

  it('FR-1208-05 keeps a person\'s dismissal across a re-judgment of a changed target', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    const answer: Answer = ({ target }) => ({
      findings: target === 'REQ-001' ? [{ code: 'C', severity: 'error', message: 'first wording', subject: 'REQ-001' }] : [],
    });
    await reviewCommand({ target: ['REQ-001'] }, environment(fakeJudge(answer)));
    const path = recordFile('req-verifiability', 'REQ-001');
    const record = readRecord(path)!;
    writeRecord(path, { ...record, findings: [{ ...record.findings[0], status: 'dismissed', statusNote: 'Out of scope' }] });

    project.specs = design({ usecases: [{ id: 'UC-001', description: 'Manage reports for auditors' }] });
    await reviewCommand({ target: ['REQ-001'] }, environment(fakeJudge(answer)));

    expect(readRecord(path)!.findings.map(f => [f.status, f.statusNote])).toEqual([['dismissed', 'Out of scope']]);
  });
});

// ============================================================================
// Gate
// ============================================================================

describe('FR-1209 review gate in lint', () => {
  async function gate(review: ReviewConfigInput = {}, env: Record<string, string> = {}) {
    const saved = { ...process.env };
    for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_API_KEY', 'GEMINI_API_KEY']) {
      delete process.env[key];
    }
    Object.assign(process.env, env);
    try {
      const setup = resolveReviewSetup(review, project.models as never, project.dir)!;
      return await runDesignLint(project.specs, { review: setup });
    } finally {
      process.env = saved;
    }
  }
  const codes = (results: Awaited<ReturnType<typeof gate>>) =>
    results.filter(r => r.ruleId.startsWith('REVIEW-')).map(r => `${r.ruleId} ${r.severity} ${r.specId ?? '-'}`);

  it('FR-1209-01 NFR-016-01 evaluates missing, stale and open-finding records with no credential and no LLM', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    expect(codes(await gate())).toEqual(['REVIEW-001 error REQ-001', 'REVIEW-001 error REQ-002']);

    await reviewCommand({}, environment(fakeJudge(({ target }) => ({
      findings: target === 'REQ-001'
        ? [{ code: 'A', severity: 'error', message: 'blocking', subject: 'REQ-001' }, { code: 'B', severity: 'warning', message: 'minor' }]
        : [],
    }))));
    expect(codes(await gate())).toEqual(['REVIEW-002 error REQ-001']);

    project.specs = design({ requirements: [
      { id: 'REQ-001', description: 'The system exports reports.', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      { id: 'REQ-002', description: 'The system imports data quickly.', relations: [{ type: 'satisfies', target: 'UC-001' }] },
    ] });
    const results = await gate();
    expect(codes(results)).toEqual(['REVIEW-001 error REQ-001', 'REVIEW-002 error REQ-001', 'REVIEW-001 error REQ-002']);
    expect(results.find(r => r.specId === 'REQ-002')!.message).toContain('spec:REQ-002 changed');
  });

  it('FR-1209-02 lets the gate severities be error, warning or off', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    await reviewCommand({ target: ['REQ-001'] }, environment(fakeJudge(() => ({
      findings: [{ code: 'B', severity: 'warning', message: 'minor' }],
    }))));

    expect(codes(await gate({ gate: { stale: 'warning' } }))).toEqual(['REVIEW-001 warning REQ-002']);
    expect(codes(await gate({ gate: { stale: 'off', blocking: ['error', 'warning'] } }))).toEqual(['REVIEW-002 error REQ-001']);
    expect(codes(await gate({ gate: { stale: 'off', openFindings: 'off', blocking: ['warning'] } }))).toEqual([]);
  });

  it('FR-1209-03 warns on records whose check or target is gone, and review --prune removes them', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    await reviewCommand({}, environment(fakeJudge(noFindings)));
    project.specs = design({ requirements: [{ id: 'REQ-001', description: 'The system exports reports.', acceptanceCriteria: [{ id: 'REQ-001-01', description: 'Reports export quickly' }], relations: [{ type: 'satisfies', target: 'UC-001' }] }] });

    const results = await gate();
    expect(codes(results)).toEqual(['REVIEW-003 warning -']);
    expect(results[results.length - 1].message).toContain(join('review', 'req-verifiability', 'REQ-002.yaml'));

    expect(await reviewCommand({ prune: true, dryRun: true }, environment(fakeJudge(noFindings)))).toBe(0);
    expect(existsSync(recordFile('req-verifiability', 'REQ-002'))).toBe(true);
    expect(await reviewCommand({ prune: true }, environment(fakeJudge(noFindings)))).toBe(0);
    expect(existsSync(recordFile('req-verifiability', 'REQ-002'))).toBe(false);
    expect(existsSync(recordFile('req-verifiability', 'REQ-001'))).toBe(true);
  });

  it('FR-1209-04 judgeChange ignore, warning and stale treat a record judged by another model in turn', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    await reviewCommand({ target: ['REQ-001'] }, environment(fakeJudge(noFindings), {
      CLAUDE_CODE_OAUTH_TOKEN: 't',
      AGENT_RUNTIME_MODEL_STANDARD: 'claude-old',
    }));
    const configured = { AGENT_RUNTIME_MODEL_STANDARD: 'claude-new' };
    const onlyReq1 = (results: Awaited<ReturnType<typeof gate>>) => codes(results).filter(c => c.endsWith('REQ-001'));

    expect(onlyReq1(await gate({ gate: { judgeChange: 'ignore' } }, configured))).toEqual([]);
    expect(onlyReq1(await gate({ gate: { judgeChange: 'warning' } }, configured))).toEqual(['REVIEW-004 warning REQ-001']);
    const staleByJudge = await gate({ gate: { judgeChange: 'stale' } }, configured);
    expect(onlyReq1(staleByJudge)).toEqual(['REVIEW-001 error REQ-001']);
    const message = staleByJudge.find(r => r.specId === 'REQ-001')!.message;
    expect(message).toContain('judged by claude / claude-old');
    expect(message).not.toContain('rebaseline');

    project.review = { gate: { judgeChange: 'stale' } };
    const rejudge = fakeJudge(noFindings);
    await reviewCommand({ target: ['REQ-001'] }, environment(rejudge, { CLAUDE_CODE_OAUTH_TOKEN: 't', ...configured }));
    expect(rejudge.calls.map(c => c.target)).toEqual(['REQ-001']);
    expect(readRecord(recordFile('req-verifiability', 'REQ-001'))!.judge).toEqual({ adapter: 'claude', model: 'claude-new' });
  });

  it('FR-1209-01 lists the review rule IDs among the common lint items', () => {
    expect(COMMON_LINT_RULES).toMatchObject({
      stale: 'REVIEW-001',
      openFindings: 'REVIEW-002',
      orphanRecord: 'REVIEW-003',
      judgeChange: 'REVIEW-004',
    });
  });
});

// ============================================================================
// Emit and ingest
// ============================================================================

describe('FR-1210 manual review emit and ingest', () => {
  it('FR-1210-01 records a result for the current packet and rejects one whose packet hash is no longer current', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });
    expect(await reviewCommand({ emit: 'packets' }, environment(fakeJudge(noFindings)))).toBe(0);

    const index = YAML.parse(readFileSync(join(project.dir, 'packets', 'index.yaml'), 'utf-8')) as {
      packets: Array<{ target: string; packetHash: string; packet: string; result: string }>;
    };
    expect(index.packets.map(p => p.target)).toEqual(['REQ-001', 'REQ-002']);
    expect(readFileSync(join(project.dir, 'packets', index.packets[0].packet), 'utf-8')).toContain('## Target: REQ-001');
    for (const entry of index.packets) {
      writeFileSync(join(project.dir, 'packets', entry.result), YAML.stringify({
        packetHash: entry.packetHash,
        output: { findings: [{ code: 'MANUAL', severity: 'info', message: `checked ${entry.target}` }] },
      }));
    }

    project.specs = design({ requirements: [
      { id: 'REQ-001', description: 'The system exports reports.', acceptanceCriteria: [{ id: 'REQ-001-01', description: 'Reports export quickly' }], relations: [{ type: 'satisfies', target: 'UC-001' }] },
      { id: 'REQ-002', description: 'The system imports data in bulk.', relations: [{ type: 'satisfies', target: 'UC-001' }] },
    ] });

    expect(await reviewIngestCommand(join(project.dir, 'packets'), {}, { cwd: project.dir })).toBe(1);

    const ingested = readRecord(recordFile('req-verifiability', 'REQ-001'))!;
    expect(ingested.judge).toEqual({ adapter: 'manual' });
    expect(ingested.findings[0].message).toBe('checked REQ-001');
    expect(existsSync(recordFile('req-verifiability', 'REQ-002'))).toBe(false);
    expect(stdout()).toContain('REQ-002.result.yaml: answers packet');
  });
});

// ============================================================================
// Rebaseline
// ============================================================================

describe('review subcommands on the command line', () => {
  it('FR-1212-02 hands review rebaseline and review ingest the options written after them', async () => {
    const { createProgram } = await import('../../src/generated/program.js');
    const received: Record<string, unknown> = {};
    const handlers = new Proxy({}, {
      get: (_target, name: string) => async (...args: unknown[]) => { received[name] = args.slice(0, -1); },
    });

    await createProgram(handlers as never, '0.0.0').parseAsync([
      'node', 'speckeeper', 'review', 'rebaseline', '--reason', 'typo', '--dry-run', '--check', 'c1', '--target', 'T1',
    ]);
    await createProgram(handlers as never, '0.0.0').parseAsync(['node', 'speckeeper', 'review', 'ingest', 'out', '-c', 'my.config.ts']);
    await createProgram(handlers as never, '0.0.0').parseAsync(['node', 'speckeeper', 'review', '--dry-run', '--check', 'c1']);

    expect(received.reviewRebaseline).toEqual([{ reason: 'typo', dryRun: true, check: ['c1'], target: ['T1'] }]);
    expect(received.reviewIngest).toEqual(['out', { config: 'my.config.ts' }]);
    expect(received.review).toMatchObject([{ dryRun: true, check: ['c1'] }]);
  });
});

describe('FR-1212 review rebaseline', () => {
  it('FR-1212-01 replaces the hashes, keeps the findings, and records the change without a personal identity', async () => {
    execFileSync('git', ['init', '-q'], { cwd: project.dir });
    execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: project.dir });
    writeFileSync(join(project.dir, 'prompt.md'), 'Report vague criteria.\n');
    useProject({ models: [requirementModel([{ ...verifiability, prompt: { file: 'prompt.md' } }])], specs: design() });
    await reviewCommand({ target: ['REQ-001'] }, environment(fakeJudge(() => ({
      findings: [{ code: 'C', severity: 'error', message: 'kept', subject: 'REQ-001' }],
    }))));
    const before = readRecord(recordFile('req-verifiability', 'REQ-001'))!;

    writeFileSync(join(project.dir, 'prompt.md'), 'Report vague acceptance criteria.\n');
    expect(await reviewRebaselineCommand({ reason: 'reworded the prompt', target: ['REQ-001'] }, {
      cwd: project.dir,
      now: () => new Date('2026-10-12T09:00:00Z'),
    })).toBe(0);

    const after = readRecord(recordFile('req-verifiability', 'REQ-001'))!;
    expect(after.packetHash).not.toBe(before.packetHash);
    expect(after.inputHashes.prompt).not.toBe(before.inputHashes.prompt);
    expect(after.findings).toEqual(before.findings);
    expect(after.judgedAt).toBe(before.judgedAt);
    const entry = after.rebaselined![0];
    expect(entry).toMatchObject({
      from: before.packetHash,
      to: after.packetHash,
      changedInputs: [{ input: 'prompt', from: before.inputHashes.prompt, to: after.inputHashes.prompt }],
      reason: 'reworded the prompt',
      at: '2026-10-12T09:00:00.000Z',
      gitDirty: true,
    });
    expect(entry.gitHead).toMatch(/^[0-9a-f]{40}$/);
    const raw = readFileSync(recordFile('req-verifiability', 'REQ-001'), 'utf-8');
    expect(raw).not.toMatch(/t@example\.com|author|user/);

    const setup = resolveReviewSetup(undefined, project.models as never, project.dir)!;
    expect(codes(await runDesignLint(project.specs, { review: setup })).filter(c => c.endsWith('REQ-001'))).toEqual(['REVIEW-002 error REQ-001']);
  });

  it('FR-1212-02 needs --reason and leaves targets without a record alone', async () => {
    useProject({ models: [requirementModel([verifiability])], specs: design() });

    expect(await reviewRebaselineCommand({ reason: '  ' }, { cwd: project.dir })).toBe(1);
    expect(stderr()).toContain('needs --reason');

    expect(await reviewRebaselineCommand({ reason: 'nothing judged yet' }, { cwd: project.dir })).toBe(0);
    expect(stdout()).toContain('Rebaselined 0 record(s)');
    expect(stdout()).toContain('2 target(s) have no record to rebaseline');
    expect(existsSync(join(project.dir, 'review'))).toBe(false);
  });
});

function codes(results: Array<{ ruleId: string; severity: string; specId?: string }>): string[] {
  return results.filter(r => r.ruleId.startsWith('REVIEW-')).map(r => `${r.ruleId} ${r.severity} ${r.specId ?? '-'}`);
}
