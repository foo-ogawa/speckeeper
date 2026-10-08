/**
 * Judging packets with an LLM through @aaac/runtime.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { LlmRuntime } from '../agents/orchestrator.js';
import type { PlannedTarget, ResolvedCheck } from './checks.js';
import { buildJudgeSchema, ReviewFindingSchema, type ReviewOutput } from './output.js';
import {
  carryOverStatus,
  findingFingerprint,
  writeRecord,
  type JudgeSignature,
  type JudgmentRecord,
  type RecordedFinding,
} from './record.js';
import type { ReviewAdapterName, ReviewModelClass, ReviewRegistry } from './types.js';

/**
 * How an adapter would authenticate in this environment.
 *
 * - `api-key`: an API key from the environment (billed per use)
 * - `token`: a Claude Code OAuth token
 * - `local-login`: the logged-in Claude Code on this machine
 * - `unavailable`: nothing to authenticate with
 * - `none`: the adapter needs no credentials (mock)
 */
export type CredentialMode = 'api-key' | 'token' | 'local-login' | 'unavailable' | 'none';

const API_KEY_VARIABLES: Record<Exclude<ReviewAdapterName, 'claude' | 'mock'>, string[]> = {
  openai: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
};

export function classifyCredentials(adapter: ReviewAdapterName, env: NodeJS.ProcessEnv): CredentialMode {
  const set = (name: string) => (env[name] ?? '') !== '';
  switch (adapter) {
    case 'mock':
      return 'none';
    case 'claude':
      if (set('ANTHROPIC_API_KEY') || set('ANTHROPIC_AUTH_TOKEN')) return 'api-key';
      if (set('CLAUDE_CODE_OAUTH_TOKEN')) return 'token';
      return isTruthy(env.CI) ? 'unavailable' : 'local-login';
    default:
      return API_KEY_VARIABLES[adapter].some(set) ? 'api-key' : 'unavailable';
  }
}

function isTruthy(value: string | undefined): boolean {
  return value !== undefined && value !== '' && value !== '0' && value.toLowerCase() !== 'false';
}

/**
 * The judge a check runs with: the adapter and the models the runtime's model
 * resolver picks for the check's model classes.
 */
export function resolveJudgeSignature(
  runtime: Pick<LlmRuntime, 'createModelResolver'>,
  adapter: ReviewAdapterName,
  model: string | undefined,
  check: ResolvedCheck,
  env: NodeJS.ProcessEnv,
): JudgeSignature {
  const resolver = runtime.createModelResolver({ fallbackAdapter: adapter, fallbackModel: model, pinnedAdapter: adapter, env });
  const judgeModel = resolver.resolve(check.modelClass).model;
  const verifyModel = check.verifyModelClass ? resolver.resolve(check.verifyModelClass).model : undefined;
  return {
    adapter,
    ...(judgeModel !== undefined ? { model: judgeModel } : {}),
    ...(verifyModel !== undefined ? { verifyModel } : {}),
  };
}

const REVIEWER_AGENT = {
  id: 'speckeeper-reviewer',
  role_name: 'Spec reviewer',
  purpose: 'Judge one review packet and answer with findings in the requested JSON shape',
  mode: 'read-only' as const,
  responsibilities: ['Judge the target against the check using only the packet'],
  constraints: ['Use no tools and no information outside the packet'],
};

const VerdictSchema = z.object({
  verdict: z.enum(['confirmed', 'false_positive']),
  rationale: z.string().min(1),
});

/** The adapter factory of the runtime; tests substitute their own */
export type AdapterFactory = LlmRuntime['createAdapter'];

export interface JudgeRunOptions {
  runtime: Pick<LlmRuntime, 'runTask' | 'createModelResolver'>;
  createAdapter: AdapterFactory;
  adapter: ReviewAdapterName;
  /** Model override (--model) */
  model?: string;
  concurrency: number;
  credentials: CredentialMode;
  registry: ReviewRegistry;
  /** Environment the model resolver reads */
  env: NodeJS.ProcessEnv;
  now?: () => Date;
}

export interface JudgeRunResult {
  /** Targets whose record was written */
  written: PlannedTarget[];
  /** Targets whose answer stayed invalid after one correction */
  failed: Array<{ target: PlannedTarget; reason: string }>;
  /** Set when an adapter call failed; no call was started after it */
  adapterError?: string;
  /** Set when the logged-in Claude Code turned out not to be logged in; nothing was judged */
  unavailable?: string;
}

/** An adapter call failed (network, authentication, usage limit, ...) */
class AdapterFailure extends Error {}

/** A judge's answer stayed invalid after its correction */
class InvalidAnswer extends Error {}

/**
 * Judge the targets and write their records.
 *
 * Adapters are created without tools and with an empty working directory, so
 * the judge sees nothing but the packet. On an adapter failure no further
 * call is started; the calls already running finish and their records are kept.
 */
export async function judgeTargets(targets: PlannedTarget[], options: JudgeRunOptions): Promise<JudgeRunResult> {
  const result: JudgeRunResult = { written: [], failed: [] };
  const emptyDir = mkdtempSync(join(tmpdir(), 'speckeeper-review-'));
  const judges = new Map<string, JudgeSignature>();
  const judgeOf = (check: ResolvedCheck): JudgeSignature => {
    let judge = judges.get(check.id);
    if (!judge) {
      judge = resolveJudgeSignature(options.runtime, options.adapter, options.model, check, options.env);
      judges.set(check.id, judge);
    }
    return judge;
  };

  const judgeOne = async (planned: PlannedTarget): Promise<void> => {
    try {
      const record = await judgeTarget(planned, judgeOf(planned.check), emptyDir, options);
      writeRecord(planned.recordFile, record);
      result.written.push(planned);
    } catch (error) {
      if (error instanceof InvalidAnswer) {
        result.failed.push({ target: planned, reason: error.message });
        return;
      }
      throw error;
    }
  };

  try {
    let next = 0;
    if (options.credentials === 'local-login' && targets.length > 0) {
      // The login is only known to work once a call succeeds, so the first
      // target runs alone: a login failure then judges nothing at all.
      next = 1;
      try {
        await judgeOne(targets[0]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isAuthenticationFailure(message)) {
          result.unavailable = message;
          return result;
        }
        result.adapterError = message;
        return result;
      }
    }

    const worker = async (): Promise<void> => {
      while (result.adapterError === undefined && next < targets.length) {
        const planned = targets[next++];
        try {
          await judgeOne(planned);
        } catch (error) {
          result.adapterError ??= error instanceof Error ? error.message : String(error);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, worker));
    return result;
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }
}

/**
 * Whether an adapter error says the logged-in Claude Code is not logged in.
 * The runtime reports it as an ordinary adapter error, so the message is the
 * only signal.
 */
function isAuthenticationFailure(message: string): boolean {
  return /not logged in|\/login|invalid api key|authentication|unauthori[sz]ed|\b401\b/i.test(message);
}

async function judgeTarget(
  planned: PlannedTarget,
  judge: JudgeSignature,
  emptyDir: string,
  options: JudgeRunOptions,
): Promise<JudgmentRecord> {
  const { check, target, packet } = planned;
  const usage = { inputTokens: 0, outputTokens: 0 };

  const answer = await runJudgeTask(options, emptyDir, judge.model, usage, {
    taskId: `review-${check.id}`,
    description: check.description,
    modelClass: check.modelClass,
    request: packet.text,
    schema: buildJudgeSchema(check.output, { specs: options.registry.specs, contextBody: packet.contextBody }),
  });

  let findings = answerToFindings(check.id, target.id, answer);

  const { verifyPrompt, verifyModelClass } = check;
  if (verifyPrompt !== undefined && verifyModelClass !== undefined) {
    findings = await Promise.all(findings.map(async (finding): Promise<RecordedFinding> => {
      const verdict = await runJudgeTask(options, emptyDir, judge.verifyModel, usage, {
        taskId: `review-${check.id}-verify`,
        description: `Verify one finding of ${check.id}`,
        modelClass: verifyModelClass,
        request: verificationRequest(verifyPrompt, packet.contextBody, finding),
        schema: VerdictSchema,
      });
      return {
        ...finding,
        ...(verdict.verdict === 'false_positive' ? { status: 'false_positive' as const } : {}),
        verifier: { verdict: verdict.verdict, rationale: verdict.rationale },
      };
    }));
  }

  return assembleRecord(planned, answer, findings, judge, (options.now?.() ?? new Date()).toISOString(), usage);
}

const COMMON_FINDING_FIELDS = new Set(Object.keys(ReviewFindingSchema.shape));

/** A judge's findings as recorded: fingerprinted, open, project fields under `extra` */
export function answerToFindings(checkId: string, targetId: string, answer: ReviewOutput): RecordedFinding[] {
  return answer.findings.map(finding => {
    const extra = Object.fromEntries(Object.entries(finding).filter(([key]) => !COMMON_FINDING_FIELDS.has(key)));
    return {
      fingerprint: findingFingerprint(checkId, targetId, finding),
      code: finding.code,
      severity: finding.severity,
      message: finding.message,
      ...(finding.subject !== undefined ? { subject: finding.subject } : {}),
      ...(finding.location !== undefined ? { location: finding.location } : {}),
      ...(finding.evidence !== undefined ? { evidence: finding.evidence } : {}),
      ...(finding.suggestion !== undefined ? { suggestion: finding.suggestion } : {}),
      ...(Object.keys(extra).length > 0 ? { extra } : {}),
      status: 'open' as const,
    };
  });
}

/** The record of a judgment, carrying statuses over from the target's previous record */
export function assembleRecord(
  planned: PlannedTarget,
  answer: ReviewOutput,
  findings: RecordedFinding[],
  judge: JudgeSignature,
  judgedAt: string,
  usage?: { inputTokens: number; outputTokens: number },
): JudgmentRecord {
  const extra = Object.fromEntries(Object.entries(answer).filter(([key]) => key !== 'findings'));
  return {
    check: planned.check.id,
    target: planned.target.id,
    packetHash: planned.packet.hash,
    inputs: planned.packet.inputs,
    inputHashes: planned.packet.inputHashes,
    judge,
    judgedAt,
    ...(usage ? { usage } : {}),
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
    findings: planned.record ? carryOverStatus(planned.record.findings, findings) : findings,
  };
}

function verificationRequest(prompt: string, contextBody: string, finding: RecordedFinding): string {
  const { fingerprint: _fingerprint, status: _status, ...shown } = finding;
  return [
    '# Verification request',
    '',
    '## Instructions',
    prompt.trim(),
    '',
    '## Context',
    contextBody.trimEnd(),
    '',
    '## Finding',
    '```json',
    JSON.stringify(shown, null, 2),
    '```',
    '',
    'Answer `confirmed` when the context supports the finding, `false_positive` when it does not, with your rationale.',
  ].join('\n');
}

interface JudgeTask<S extends z.ZodType> {
  taskId: string;
  description: string;
  modelClass: ReviewModelClass;
  request: string;
  schema: S;
}

/** Run one task with one correction allowed; returns the validated answer */
async function runJudgeTask<S extends z.ZodType>(
  options: JudgeRunOptions,
  emptyDir: string,
  model: string | undefined,
  usage: { inputTokens: number; outputTokens: number },
  task: JudgeTask<S>,
): Promise<z.infer<S>> {
  const handoff = `${task.taskId}-output`;
  let run;
  try {
    const adapter = await options.createAdapter(options.adapter, {
      ...(model !== undefined ? { model } : {}),
      tools: [],
      cwd: emptyDir,
      permissionMode: 'default',
    });
    run = await options.runtime.runTask(adapter, task.taskId, { user_request: task.request }, {
      maxFollowUps: 1,
      maxRetries: 0,
      agentRegistry: { [REVIEWER_AGENT.id]: REVIEWER_AGENT },
      taskRegistry: {
        [task.taskId]: {
          id: task.taskId,
          description: task.description,
          target_agent: REVIEWER_AGENT.id,
          result_handoff: handoff,
          completion_criteria: [],
          model_class: task.modelClass,
        },
      },
      handoffSchemas: { [handoff]: task.schema },
      envelopeAdapter: options.adapter,
      ...(model !== undefined ? { envelopeModel: model } : {}),
    });
  } catch (error) {
    throw new AdapterFailure(error instanceof Error ? error.message : String(error));
  }

  usage.inputTokens += run.tokenUsage?.inputTokens ?? 0;
  usage.outputTokens += run.tokenUsage?.outputTokens ?? 0;

  const outcome = run.outcome;
  switch (outcome.status) {
    case 'success':
      // The runtime validated the data against this schema; parsing again types it
      return task.schema.parse(outcome.data);
    case 'error':
      throw new AdapterFailure(outcome.message);
    case 'validation_error':
      throw new InvalidAnswer(`the answer did not match the output schema after one correction: ${z.prettifyError(outcome.errors)}`);
    case 'escalation':
      throw new InvalidAnswer(`the judge escalated instead of answering: ${outcome.reason}`);
  }
}
