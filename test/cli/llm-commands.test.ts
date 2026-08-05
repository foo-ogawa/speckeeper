/**
 * LLM-backed commands
 *
 * The four commands share one shape: they build a context string and, when
 * --show-prompt is set, return it instead of reaching the runtime. They are
 * covered together so the shared behaviour is asserted once.
 *
 * The runtime is reached through a single dynamic import in
 * src/agents/orchestrator.ts, so mocking that module is what lets these tests
 * assert that no LLM call happens.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { join } from 'node:path';

const executeTask = vi.fn();
vi.mock('agent-contracts-runtime', () => ({ executeTask }));

const repoRoot = join(import.meta.dirname, '..', '..');
const configPath = join(repoRoot, 'speckeeper.config.ts');

/** Spec ids the project actually declares, read from the design data itself. */
async function declaredSpecIds(): Promise<string[]> {
  const { getSpecsFromConfig } = await import('../../src/core/model.js');
  const design = (await import('../../design/index.ts')).default;
  const ids: string[] = [];
  for (const model of design.models) {
    for (const spec of getSpecsFromConfig(design.specs, model.id) as { id: string }[]) {
      ids.push(spec.id);
    }
  }
  return ids;
}

const impactJson = JSON.stringify({ target: 'FR-100', impactedNodes: [{ id: 'UC-001' }] });

/**
 * The commands that answer --show-prompt, each with the invocation that reaches
 * it. The shared assertion lives in one helper; only the titles are spelled out,
 * because the traceability checker matches them literally in this source.
 */
const showPrompt = {
  auditRequirements: async () => {
    const { commandAuditRequirements } = await import('../../src/cli/audit-requirements.js');
    return commandAuditRequirements({ config: configPath, showPrompt: true });
  },
  proposeTraceLinks: async () => {
    const { commandProposeTraceLinks } = await import('../../src/cli/propose-trace-links.js');
    return commandProposeTraceLinks({ config: configPath, showPrompt: true });
  },
  explainImpact: async () => {
    vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      Readable.from([Buffer.from(impactJson)]) as never,
    );
    const { commandExplainImpact } = await import('../../src/cli/explain-impact-result.js');
    return commandExplainImpact({ showPrompt: true });
  },
  proposeAcceptanceCriteria: async () => {
    const { commandProposeAcceptanceCriteria } = await import(
      '../../src/cli/propose-acceptance-criteria.js'
    );
    return commandProposeAcceptanceCriteria(['FR-100'], { config: configPath, showPrompt: true });
  },
};

async function expectPromptWithoutLlm(run: () => Promise<void | string>): Promise<void> {
  const output = await run();

  expect(typeof output).toBe('string');
  expect((output as string).length).toBeGreaterThan(100);
  expect(executeTask).not.toHaveBeenCalled();
}

describe('--show-prompt returns the prompt without reaching the runtime', () => {
  beforeEach(() => {
    executeTask.mockReset();
    vi.restoreAllMocks();
  });

  it('FR-1100-03 audit-requirements --show-prompt prints the prompt and calls no LLM', async () => {
    await expectPromptWithoutLlm(showPrompt.auditRequirements);
  }, 60_000);

  it('FR-1101-03 propose-trace-links --show-prompt prints the prompt and calls no LLM', async () => {
    await expectPromptWithoutLlm(showPrompt.proposeTraceLinks);
  }, 60_000);

  it('FR-1102-03 explain-impact --show-prompt prints the prompt and calls no LLM', async () => {
    await expectPromptWithoutLlm(showPrompt.explainImpact);
  }, 60_000);

  it('FR-1103-03 propose-acceptance-criteria --show-prompt prints the prompt and calls no LLM', async () => {
    await expectPromptWithoutLlm(showPrompt.proposeAcceptanceCriteria);
  }, 60_000);
});

describe('FR-1100: audit-requirements prompt construction', () => {
  beforeEach(() => {
    executeTask.mockReset();
    vi.restoreAllMocks();
  });

  it('FR-1100-01 builds the prompt from every registered spec', async () => {
    const { commandAuditRequirements } = await import('../../src/cli/audit-requirements.js');
    const prompt = (await commandAuditRequirements({
      config: configPath,
      showPrompt: true,
    })) as string;

    const ids = await declaredSpecIds();
    expect(ids.length).toBeGreaterThan(100);

    const missing = ids.filter((id) => !prompt.includes(id));
    expect(missing).toEqual([]);
  }, 60_000);

  it('FR-1100-05 renders a distinct report for each --report-format value', async () => {
    const { formatResult } = await import('../../src/agents/formatter.js');
    const result = {
      status: 'success' as const,
      data: {
        summary: 'one finding',
        riskLevel: 'low',
        findings: [
          { specId: 'FR-100', severity: 'warning', category: 'clarity', message: 'vague' },
        ],
      },
      follow_ups_used: 0,
      retries_used: 0,
    };

    const json = formatResult(result as never, 'json');
    const yaml = formatResult(result as never, 'yaml');
    const text = formatResult(result as never, 'text');

    // json parses as JSON and carries the finding; the other two do not.
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)).toMatchObject({ summary: 'one finding' });
    expect(() => JSON.parse(yaml)).toThrow();
    expect(() => JSON.parse(text)).toThrow();

    // yaml uses key: value lines, text is the human report.
    expect(yaml).toMatch(/^\s*summary:/m);
    expect(new Set([json, yaml, text]).size).toBe(3);
  });
});

describe('FR-1101: propose-trace-links', () => {
  beforeEach(() => {
    executeTask.mockReset();
    vi.restoreAllMocks();
  });

  it('FR-1101-01 analyses every declared spec and lists the relations already present', async () => {
    const { commandProposeTraceLinks } = await import('../../src/cli/propose-trace-links.js');
    const prompt = (await commandProposeTraceLinks({
      config: configPath,
      showPrompt: true,
    })) as string;

    const ids = await declaredSpecIds();
    const missing = ids.filter((id) => !prompt.includes(id));
    expect(missing).toEqual([]);
    expect(prompt).toContain('Existing Relations');
  }, 60_000);

  it('FR-1101-02 requires source, target, relation type and confidence on every proposed link', async () => {
    const { TraceLinkResultSchema } = await import('../../src/generated/dsl/handoffs.js');
    const complete = {
      from: 'FR-100',
      relation: 'implements',
      to: 'api.openApi.operation.getUser',
      confidence: 0.8,
      reason: 'operationId matches the requirement',
    };
    const base = { summary: 's', riskLevel: 'low', findings: [], candidateLinks: [complete] };

    expect(TraceLinkResultSchema.safeParse(base).success).toBe(true);

    for (const field of ['from', 'relation', 'to', 'confidence'] as const) {
      const withoutField: Record<string, unknown> = { ...complete };
      delete withoutField[field];
      const parsed = TraceLinkResultSchema.safeParse({ ...base, candidateLinks: [withoutField] });
      expect(parsed.success, `a link without ${field} must be rejected`).toBe(false);
    }

    // confidence is a probability, not a free number.
    expect(
      TraceLinkResultSchema.safeParse({ ...base, candidateLinks: [{ ...complete, confidence: 2 }] })
        .success,
    ).toBe(false);
  });
});

describe('FR-1103: propose-acceptance-criteria', () => {
  beforeEach(() => {
    executeTask.mockReset();
    vi.restoreAllMocks();
  });

  it('FR-1103-01 narrows the prompt to the specs named on the command line', async () => {
    const { commandProposeAcceptanceCriteria } = await import(
      '../../src/cli/propose-acceptance-criteria.js'
    );
    const ids = await declaredSpecIds();
    const target = 'FR-100';
    expect(ids).toContain(target);

    const prompt = (await commandProposeAcceptanceCriteria([target], {
      config: configPath,
      showPrompt: true,
    })) as string;

    expect(prompt).toContain(target);

    // A spec that was not named must not be carried into the prompt.
    const other = ids.find((id) => id !== target && !target.startsWith(id) && !id.startsWith(target));
    expect(other).toBeDefined();
    expect(prompt).not.toContain(other as string);
  }, 60_000);
});
