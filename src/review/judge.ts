/**
 * Judging packets with an LLM through @aaac/runtime.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { AdapterErrorKind } from '@aaac/runtime';
import type { LlmRuntime } from '../agents/orchestrator.js';
import type { PlannedTarget, ResolvedCheck } from './checks.js';
import { buildJudgeSchema, COMMON_FINDING_FIELDS, type ReviewOutput } from './output.js';
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

/** How the judge is reached: the runtime, the adapter, and the limits of each call */
export interface JudgeConnection {
  runtime: Pick<LlmRuntime, 'runTask' | 'createModelResolver' | 'adapterErrorKind'>;
  createAdapter: AdapterFactory;
  adapter: ReviewAdapterName;
  /** Model override (--model) */
  model?: string;
  credentials: CredentialMode;
  /** Upper limit of one judge call, including its one correction */
  timeoutMs: number;
  /** Claude Code executable for the claude adapter (absolute path) */
  claudeExecutable?: string;
}

export interface JudgeRunOptions extends JudgeConnection {
  concurrency: number;
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
}

/** An adapter call failed (network, authentication, usage limit, ...) */
class AdapterFailure extends Error {}

/** Another target's adapter call failed, so this target starts no further call */
class Stopped extends Error {}

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

  const stopped = (): boolean => result.adapterError !== undefined;
  const judgeOne = async (planned: PlannedTarget): Promise<void> => {
    try {
      const record = await judgeTarget(planned, judgeOf(planned.check), emptyDir, options, stopped);
      writeRecord(planned.recordFile, record);
      result.written.push(planned);
    } catch (error) {
      if (error instanceof InvalidAnswer) {
        result.failed.push({ target: planned, reason: error.message });
        return;
      }
      if (error instanceof Stopped) return;
      throw error;
    }
  };

  try {
    let next = 0;
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

async function judgeTarget(
  planned: PlannedTarget,
  judge: JudgeSignature,
  emptyDir: string,
  options: JudgeRunOptions,
  stopped: () => boolean,
): Promise<JudgmentRecord> {
  const { check, target, packet } = planned;
  const usage: Usage = { reported: false, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  const run = <S extends z.ZodType>(model: string | undefined, task: JudgeTask<S>): Promise<z.infer<S>> => {
    if (stopped()) throw new Stopped();
    return runJudgeTask(options, emptyDir, model, usage, task);
  };

  const answer = await run(judge.model, {
    taskId: `review-${check.id}`,
    description: check.description,
    modelClass: check.modelClass,
    request: packet.text,
    schema: buildJudgeSchema(check, { specs: options.registry.specs, contextBody: packet.contextBody }),
  });

  let findings = answerToFindings(check, target.id, answer);

  const { verifyPrompt, verifyModelClass } = check;
  if (verifyPrompt !== undefined && verifyModelClass !== undefined) {
    findings = await Promise.all(findings.map(async (finding): Promise<RecordedFinding> => {
      const verdict = await run(judge.verifyModel, {
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

  const judgedAt = (options.now?.() ?? new Date()).toISOString();
  return assembleRecord(planned, answer, findings, judge, judgedAt, usage.reported ? {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    ...(usage.cacheReadTokens > 0 ? { cacheReadTokens: usage.cacheReadTokens } : {}),
    ...(usage.cacheCreationTokens > 0 ? { cacheCreationTokens: usage.cacheCreationTokens } : {}),
  } : undefined);
}

/**
 * A judge's findings as recorded: fingerprinted, open, project fields under
 * `extra`, and with the declared rule's severity when the check has rules.
 */
export function answerToFindings(
  check: Pick<ResolvedCheck, 'id' | 'rules'>,
  targetId: string,
  answer: ReviewOutput,
): RecordedFinding[] {
  const ruleSeverity = new Map(check.rules?.map(rule => [rule.code, rule.severity]));
  return answer.findings.map(finding => {
    const extra = Object.fromEntries(Object.entries(finding).filter(([key]) => !COMMON_FINDING_FIELDS.includes(key)));
    const severity = ruleSeverity.get(finding.code) ?? finding.severity;
    if (severity === undefined) {
      // The output schema requires either a severity or a declared code
      throw new Error(`Finding ${finding.code} of ${check.id} has no severity`);
    }
    return {
      fingerprint: findingFingerprint(check.id, targetId, finding),
      code: finding.code,
      severity,
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
  usage?: JudgmentRecord['usage'],
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

/**
 * An adapter with no tools, an empty working directory, and a time limit: the
 * judge sees nothing but its request, and a judge that does not answer within
 * the limit is stopped together with its process.
 */
function createJudgeAdapter(connection: JudgeConnection, emptyDir: string, model: string | undefined, timeoutMs: number) {
  return connection.createAdapter(connection.adapter, {
    ...(model !== undefined ? { model } : {}),
    tools: [],
    cwd: emptyDir,
    permissionMode: 'default',
    signal: AbortSignal.timeout(timeoutMs),
    ...(connection.adapter === 'claude' && connection.claudeExecutable
      ? { pathToClaudeCodeExecutable: connection.claudeExecutable }
      : {}),
  });
}

/** What a failed judge call means for the person running review, with how to fix it */
function describeFailure(connection: JudgeConnection, kind: AdapterErrorKind, message: string, timeoutMs: number): string {
  switch (kind) {
    case 'aborted':
      return `the judge did not answer within ${timeoutMs / 1000} s and was stopped (review.timeoutSeconds sets the limit)`;
    case 'authentication':
      return `the ${connection.adapter} credentials were rejected: ${message.replace(/\.+$/, '')}. ${credentialFix(connection)}`;
    default:
      return message;
  }
}

/** How to get working credentials for the adapter */
export function credentialFix(connection: Pick<JudgeConnection, 'adapter' | 'credentials'>): string {
  if (connection.adapter === 'claude' && connection.credentials !== 'api-key') {
    return 'Log in again (run `claude` and enter `/login`), or set CLAUDE_CODE_OAUTH_TOKEN (create one with `claude setup-token`).';
  }
  const variables = connection.adapter === 'claude' ? ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'] : API_KEY_VARIABLES[connection.adapter as 'openai' | 'gemini'];
  return `Check ${variables.join(' / ')}.`;
}

/** Upper limit of the check call that precedes judging */
const PROBE_TIMEOUT_MS = 60_000;

export type ProbeResult =
  | { ok: true }
  | { ok: false; kind: AdapterErrorKind; message: string };

/**
 * Make one short call before judging, so that a judge that cannot start or a
 * login that has expired is reported before any target is judged.
 */
export async function probeJudge(connection: JudgeConnection): Promise<ProbeResult> {
  const emptyDir = mkdtempSync(join(tmpdir(), 'speckeeper-review-'));
  const timeoutMs = Math.min(PROBE_TIMEOUT_MS, connection.timeoutMs);
  try {
    const model = connection.runtime
      .createModelResolver({ fallbackAdapter: connection.adapter, fallbackModel: connection.model, pinnedAdapter: connection.adapter })
      .resolve('fast').model;
    const adapter = await createJudgeAdapter(connection, emptyDir, model, timeoutMs);
    await adapter.send('Reply with OK.', { readonly: true });
    return { ok: true };
  } catch (error) {
    const kind = connection.runtime.adapterErrorKind(error);
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, kind, message: describeFailure(connection, kind, message, timeoutMs) };
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }
}

/** The machine review runs on, as far as starting the judge depends on it */
export interface HostInfo {
  platform: NodeJS.Platform;
  /** CPU architecture Node.js runs as */
  arch: string;
  /** Whether the CPU is Apple silicon (also when Node.js runs as x64 under Rosetta) */
  appleSilicon: boolean;
}

export function currentHost(): HostInfo {
  let appleSilicon = false;
  if (process.platform === 'darwin') {
    try {
      appleSilicon = execFileSync('sysctl', ['-n', 'hw.optional.arm64'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() === '1';
    } catch {
      // sysctl without the key (an Intel Mac) means it is not Apple silicon
    }
  }
  return { platform: process.platform, arch: process.arch, appleSilicon };
}

/**
 * Why the judge cannot start on this machine, or undefined. The Claude Agent
 * SDK runs the Claude Code build for Node's own architecture, and the x64
 * build hangs at start under Rosetta on Apple silicon.
 */
export function hostProblem(adapter: ReviewAdapterName, claudeExecutable: string | undefined, host: HostInfo): string | undefined {
  if (adapter !== 'claude' || claudeExecutable || host.platform !== 'darwin' || host.arch !== 'x64' || !host.appleSilicon) {
    return undefined;
  }
  return 'Node.js runs as x64 on an Apple silicon Mac, so the Claude Agent SDK starts the x64 build of Claude Code, '
    + 'which hangs under Rosetta. Use an arm64 Node.js and install the dependencies again with it '
    + '(for example `nvm install 22`, then `rm -rf node_modules && npm ci`), '
    + 'or set review.claudeExecutable to an arm64 Claude Code.';
}

/** Token usage summed over a target's calls; recorded only when the runtime reported any */
interface Usage {
  reported: boolean;
  inputTokens: number;
  outputTokens: number;
  /** Input read from the prompt cache (not included in inputTokens) */
  cacheReadTokens: number;
  /** Input written to the prompt cache (not included in inputTokens) */
  cacheCreationTokens: number;
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
  usage: Usage,
  task: JudgeTask<S>,
): Promise<z.infer<S>> {
  const handoff = `${task.taskId}-output`;
  let run;
  try {
    const adapter = await createJudgeAdapter(options, emptyDir, model, options.timeoutMs);
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

  if (run.tokenUsage) {
    usage.reported = true;
    usage.inputTokens += run.tokenUsage.inputTokens;
    usage.outputTokens += run.tokenUsage.outputTokens;
    usage.cacheReadTokens += run.tokenUsage.cacheReadTokens ?? 0;
    usage.cacheCreationTokens += run.tokenUsage.cacheCreationTokens ?? 0;
  }

  const outcome = run.outcome;
  switch (outcome.status) {
    case 'success':
      // The runtime validated the data against this schema; parsing again types it
      return task.schema.parse(outcome.data);
    case 'error':
      throw new AdapterFailure(describeFailure(options, outcome.kind ?? 'other', outcome.message, options.timeoutMs));
    case 'validation_error':
      throw new InvalidAnswer(`the answer did not match the output schema after one correction: ${z.prettifyError(outcome.errors)}`);
    case 'escalation':
      throw new InvalidAnswer(`the judge escalated instead of answering: ${outcome.reason}`);
  }
}
