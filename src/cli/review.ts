/**
 * Review Command
 *
 * Judge the declared review checks per target and record the judgments.
 * Results go to stdout; progress and notices go to stderr.
 */
import chalk from 'chalk';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { z } from 'zod';
import { findConfigFile, loadConfig } from '../utils/config-loader.js';
import { EXIT_ADAPTER_ERROR, loadRuntime, type LlmRuntime } from '../agents/orchestrator.js';
import {
  assessRecord,
  changedInputs,
  planReview,
  resolveReviewSetup,
  runOrder,
  staleReasons,
  ReviewConfigError,
  type PlannedTarget,
  type ReviewModel,
  type ReviewPlan,
  type ReviewSetup,
} from '../review/checks.js';
import {
  answerToFindings,
  assembleRecord,
  classifyCredentials,
  currentHost,
  hostProblem,
  judgeTargets,
  probeJudge,
  type HostInfo,
  type JudgeConnection,
  resolveJudgeSignature,
  type AdapterFactory,
} from '../review/judge.js';
import { buildJudgeSchema } from '../review/output.js';
import { listCheckFiles, writeRecord, type JudgmentRecord } from '../review/record.js';
import { buildReviewRegistry } from '../review/registry.js';
import type { ReviewAdapterName, ReviewRegistry } from '../review/types.js';

const EXIT_API_KEY_REFUSED = 13;
/** Upper limit of one judge call when review.timeoutSeconds is not set */
const DEFAULT_TIMEOUT_SECONDS = 600;
const EXIT_JUDGE_UNAVAILABLE = 14;

export interface ReviewCommandOptions {
  config?: string;
  check?: string[];
  target?: string[];
  adapter?: string;
  model?: string;
  concurrency?: string;
  force?: boolean;
  dryRun?: boolean;
  showPacket?: boolean;
  /** The LLM-command flag every command with --adapter carries; same as --show-packet */
  showPrompt?: boolean;
  requireJudge?: boolean;
  allowApiKey?: boolean;
  maxTargets?: string;
  prune?: boolean;
  emit?: string;
  format?: string;
}

/** What the command reaches outside the project; tests substitute it */
export interface ReviewEnvironment {
  env: NodeJS.ProcessEnv;
  cwd: string;
  loadRuntime: () => Promise<Pick<LlmRuntime, 'runTask' | 'createModelResolver' | 'createAdapter' | 'adapterErrorKind'>>;
  /** Overrides the runtime's adapter factory */
  createAdapter?: AdapterFactory;
  /** Overrides the machine the judge would start on */
  host?: HostInfo;
  now?: () => Date;
}

const defaultEnvironment = (): ReviewEnvironment => ({ env: process.env, cwd: process.cwd(), loadRuntime });

const ADAPTERS: ReviewAdapterName[] = ['claude', 'openai', 'gemini', 'mock'];

/** Run the review command; returns the exit code */
export async function reviewCommand(
  opts: ReviewCommandOptions,
  environment: ReviewEnvironment = defaultEnvironment(),
): Promise<number> {
  try {
    return await runReview(opts, environment);
  } catch (error) {
    const exitCode = (error as { exitCode?: number }).exitCode;
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return exitCode ?? 1;
  }
}

async function runReview(opts: ReviewCommandOptions, environment: ReviewEnvironment): Promise<number> {
  const context = await loadReviewContext(opts.config, environment.cwd);
  const { setup, registry } = context;
  const adapter = parseAdapter(opts.adapter ?? setup.config.adapter ?? 'claude');
  const json = opts.format === 'json';

  // The plan covers every check, so records of checks left out by --check are not orphans
  const runtimeForJudge = setup.gate.judgeChange === 'ignore' ? undefined : await environment.loadRuntime();
  const plan = await planReview(setup, registry, runtimeForJudge
    ? check => resolveJudgeSignature(runtimeForJudge, adapter, opts.model, check, environment.env)
    : undefined);

  if (opts.prune) return prune(plan, setup, opts.dryRun ?? false, json);

  const selected = selectPlanned(plan, opts.check, opts.target);

  if (opts.showPacket || opts.showPrompt) {
    process.stdout.write(selected.map(t => t.packet.text).join('\n---\n\n'));
    return 0;
  }

  const ordered = runOrder(selected.filter(t => opts.force || t.state !== 'fresh'));
  const maxTargets = opts.maxTargets !== undefined ? parsePositive(opts.maxTargets, '--max-targets') : undefined;
  const toRun = maxTargets !== undefined ? ordered.slice(0, maxTargets) : ordered;

  if (opts.emit) return emit(toRun, opts.emit, environment.cwd, json);
  if (opts.dryRun) return dryRun(selected, toRun, plan.targets, opts.force ?? false, json);

  if (toRun.length === 0) {
    report(json, { judged: [], failed: [] }, '  ✓ Every selected target has a current record');
    return 0;
  }

  const credentials = classifyCredentials(adapter, environment.env);
  if (credentials === 'unavailable') {
    return skipJudge(`no credentials for the ${adapter} adapter in this environment`, opts.requireJudge ?? false);
  }
  if (credentials === 'api-key' && setup.config.allowApiKey === false && !opts.allowApiKey) {
    console.error(chalk.red(
      `review: the ${adapter} adapter would use an API key, and review.allowApiKey is false. ` +
      'Unset the key, or pass --allow-api-key for this run.',
    ));
    return EXIT_API_KEY_REFUSED;
  }

  const claudeExecutable = setup.config.claudeExecutable !== undefined
    ? resolve(environment.cwd, setup.config.claudeExecutable)
    : undefined;
  const problem = hostProblem(adapter, claudeExecutable, environment.host ?? currentHost());
  if (problem) {
    console.error(chalk.red(`review: ${problem}`));
    return EXIT_ADAPTER_ERROR;
  }

  const runtime = runtimeForJudge ?? await environment.loadRuntime();
  const connection: JudgeConnection = {
    runtime,
    createAdapter: environment.createAdapter ?? runtime.createAdapter,
    adapter,
    model: opts.model,
    credentials,
    timeoutMs: (setup.config.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000,
    ...(claudeExecutable ? { claudeExecutable } : {}),
  };

  if (credentials !== 'none') {
    const probe = await probeJudge(connection);
    if (!probe.ok) {
      if (probe.kind === 'authentication') return skipJudge(probe.message, opts.requireJudge ?? false);
      console.error(chalk.red(`review: the judge could not be reached before judging: ${probe.message}`));
      return EXIT_ADAPTER_ERROR;
    }
  }

  console.error(chalk.gray(`  Judging ${toRun.length} target(s) with ${adapter} (${credentials})...`));
  const result = await judgeTargets(toRun, {
    ...connection,
    concurrency: parsePositive(opts.concurrency ?? '2', '--concurrency'),
    registry,
    env: environment.env,
    now: environment.now,
  });

  report(json, {
    judged: result.written.map(t => ({ check: t.check.id, target: t.target.id })),
    failed: result.failed.map(f => ({ check: f.target.check.id, target: f.target.target.id, reason: f.reason })),
    ...(result.adapterError !== undefined ? { adapterError: result.adapterError } : {}),
  }, [
    `  ✓ Recorded ${result.written.length} judgment(s)`,
    ...result.failed.map(f => chalk.red(`  ✗ ${f.target.check.id} / ${f.target.target.id}: ${f.reason}`)),
    ...(result.adapterError !== undefined
      ? [chalk.red(`  ✗ Stopped after an adapter error: ${result.adapterError}`), chalk.gray('    Records written so far are kept; run again to judge the rest.')]
      : []),
  ].join('\n'));

  if (result.adapterError !== undefined) return EXIT_ADAPTER_ERROR;
  return result.failed.length > 0 ? 1 : 0;
}

// ============================================================================
// review ingest / review rebaseline
// ============================================================================

export interface ReviewIngestOptions {
  config?: string;
}

/** Record results produced outside speckeeper for packets from `review --emit` */
export async function reviewIngestCommand(
  dir: string,
  opts: ReviewIngestOptions,
  environment: Pick<ReviewEnvironment, 'cwd' | 'now'> = { cwd: process.cwd() },
): Promise<number> {
  try {
    const { setup, registry } = await loadReviewContext(opts.config, environment.cwd);
    const plan = await planReview(setup, registry);
    const byKey = new Map(plan.targets.map(t => [`${t.check.id}/${t.target.id}`, t]));
    const ResultFileSchema = z.object({ packetHash: z.string(), output: z.unknown() }).strict();

    let recorded = 0;
    const rejected: string[] = [];
    const resultDir = resolve(environment.cwd, dir);
    if (!existsSync(resultDir)) throw new ReviewConfigError(`review ingest: ${resultDir} does not exist`);
    for (const { check, target, path } of listCheckFiles(resultDir, '.result.yaml')) {
      const planned = byKey.get(`${check}/${target}`);
      if (!planned) {
        rejected.push(`${path}: check "${check}" has no target "${target}"`);
        continue;
      }
      const file = ResultFileSchema.safeParse(parseYaml(readFileSync(path, 'utf-8')));
      if (!file.success) {
        rejected.push(`${path}: ${z.prettifyError(file.error)}`);
        continue;
      }
      if (file.data.packetHash !== planned.packet.hash) {
        rejected.push(`${path}: answers packet ${file.data.packetHash}, the current packet is ${planned.packet.hash}`);
        continue;
      }
      const answer = buildJudgeSchema(planned.check, { specs: registry.specs, contextBody: planned.packet.contextBody })
        .safeParse(file.data.output);
      if (!answer.success) {
        rejected.push(`${path}: ${z.prettifyError(answer.error)}`);
        continue;
      }
      const findings = answerToFindings(planned.check, target, answer.data);
      const judgedAt = (environment.now?.() ?? new Date()).toISOString();
      writeRecord(planned.recordFile, assembleRecord(planned, answer.data, findings, { adapter: 'manual' }, judgedAt));
      recorded++;
    }

    console.log(`  ✓ Recorded ${recorded} result(s)`);
    for (const reason of rejected) console.log(chalk.red(`  ✗ ${reason}`));
    return rejected.length > 0 ? 1 : 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return (error as { exitCode?: number }).exitCode ?? 1;
  }
}

export interface ReviewRebaselineOptions {
  config?: string;
  reason?: string;
  check?: string[];
  target?: string[];
  dryRun?: boolean;
}

/** Accept stale records as current: new packet and input hashes, findings kept, the change recorded */
export async function reviewRebaselineCommand(
  opts: ReviewRebaselineOptions,
  environment: Pick<ReviewEnvironment, 'cwd' | 'now'> = { cwd: process.cwd() },
): Promise<number> {
  try {
    if (!opts.reason?.trim()) throw new ReviewConfigError('review rebaseline needs --reason');
    const { setup, registry, designDir, configFile } = await loadReviewContext(opts.config, environment.cwd);
    const plan = await planReview(setup, registry);
    const selected = selectPlanned(plan, opts.check, opts.target);

    // Only a changed packet can be accepted; a changed judge has to judge again
    const candidates = selected.filter(
      (t): t is PlannedTarget & { record: JudgmentRecord } =>
        t.record !== undefined && assessRecord(t.record, t.packet.hash, undefined, 'ignore').state === 'stale',
    );
    const withoutRecord = selected.filter(t => t.record === undefined).length;

    if (opts.dryRun) {
      for (const t of candidates) {
        console.log(`  ${t.check.id} / ${t.target.id}`);
        for (const c of changedInputs(t.record, t.packet)) console.log(chalk.gray(`    ${c.input}`));
      }
    } else if (candidates.length > 0) {
      const at = (environment.now?.() ?? new Date()).toISOString();
      const git = gitState(environment.cwd, [
        designDir,
        ...(configFile ? [configFile] : []),
        ...new Set(candidates.flatMap(inputPaths)),
      ]);
      for (const t of candidates) {
        writeRecord(t.recordFile, {
          ...t.record,
          packetHash: t.packet.hash,
          inputs: t.packet.inputs,
          inputHashes: t.packet.inputHashes,
          rebaselined: [...(t.record.rebaselined ?? []), {
            from: t.record.packetHash,
            to: t.packet.hash,
            changedInputs: changedInputs(t.record, t.packet),
            reason: opts.reason.trim(),
            at,
            ...git,
          }],
        });
      }
    }

    console.log(`  ${opts.dryRun ? 'Would rebaseline' : 'Rebaselined'} ${candidates.length} record(s)`);
    if (withoutRecord > 0) {
      console.log(chalk.gray(`  ${withoutRecord} target(s) have no record to rebaseline; judge them with "speckeeper review"`));
    }
    return 0;
  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return (error as { exitCode?: number }).exitCode ?? 1;
  }
}

// ============================================================================
// Helpers
// ============================================================================

interface ReviewContext {
  setup: ReviewSetup;
  registry: ReviewRegistry;
  /** Design directory, relative to the project root */
  designDir: string;
  /** The config file the project uses, when one is found */
  configFile?: string;
}

async function loadReviewContext(configPath: string | undefined, cwd: string): Promise<ReviewContext> {
  const config = await loadConfig(configPath, cwd);
  const setup = resolveReviewSetup(config.review, (config.models ?? []) as ReviewModel[], cwd);
  if (!setup) throw new ReviewConfigError('No review checks are declared (config review.checks or a model\'s reviewChecks)');
  const configFile = configPath ?? findConfigFile(cwd) ?? undefined;
  return {
    setup,
    registry: buildReviewRegistry(config.specs),
    designDir: config.designDir ?? 'design',
    ...(configFile ? { configFile } : {}),
  };
}

function parseAdapter(name: string): ReviewAdapterName {
  const adapter = ADAPTERS.find(a => a === name);
  if (!adapter) throw new ReviewConfigError(`Unknown adapter "${name}". Available: ${ADAPTERS.join(', ')}`);
  return adapter;
}

function parsePositive(value: string, option: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new ReviewConfigError(`${option} must be a positive integer, got "${value}"`);
  return n;
}

/** The planned targets --check and --target select; an unknown ID is an error */
function selectPlanned(plan: ReviewPlan, checks: string[] | undefined, targets: string[] | undefined): PlannedTarget[] {
  const checkIds = new Set(plan.targets.map(t => t.check.id));
  for (const id of checks ?? []) {
    if (!checkIds.has(id)) throw new ReviewConfigError(`--check ${id}: no such review check`);
  }
  const byCheck = plan.targets.filter(t => !checks || checks.includes(t.check.id));
  const targetIds = new Set(byCheck.map(t => t.target.id));
  for (const id of targets ?? []) {
    if (!targetIds.has(id)) throw new ReviewConfigError(`--target ${id}: no selected check judges this target`);
  }
  return byCheck.filter(t => !targets || targets.includes(t.target.id));
}

function skipJudge(reason: string, requireJudge: boolean): number {
  if (requireJudge) {
    console.error(chalk.red(`review: ${reason}, and --require-judge was given`));
    return EXIT_JUDGE_UNAVAILABLE;
  }
  console.error(chalk.yellow(`review skipped: ${sentence(reason)} Records were not touched.`));
  return 0;
}

/** Text ending in exactly one period */
function sentence(text: string): string {
  return `${text.replace(/\.+$/, '')}.`;
}

function report(json: boolean, data: unknown, text: string): void {
  console.log(json ? JSON.stringify(data, null, 2) : text);
}

function prune(plan: ReviewPlan, setup: ReviewSetup, dryRun: boolean, json: boolean): number {
  const paths = plan.orphans.map(o => relative(setup.rootDir, o.path));
  if (!dryRun) for (const orphan of plan.orphans) rmSync(orphan.path);
  report(json, { [dryRun ? 'wouldRemove' : 'removed']: paths }, [
    `  ${dryRun ? 'Would remove' : 'Removed'} ${paths.length} record(s)`,
    ...paths.map(p => chalk.gray(`    ${p}`)),
  ].join('\n'));
  return 0;
}

function emit(toRun: PlannedTarget[], dir: string, cwd: string, json: boolean): number {
  const root = resolve(cwd, dir);
  const packets = toRun.map(t => {
    const packet = `${t.check.id}/${t.target.id}.packet.md`;
    const result = `${t.check.id}/${t.target.id}.result.yaml`;
    mkdirSync(join(root, t.check.id), { recursive: true });
    writeFileSync(join(root, packet), t.packet.text, 'utf-8');
    return { check: t.check.id, target: t.target.id, packetHash: t.packet.hash, packet, result };
  });
  writeFileSync(join(root, 'index.yaml'), stringifyYaml({
    resultFormat: 'Write each result to its `result` path as YAML: `packetHash` (copied from this index) and `output` (the JSON object the packet asks for). Then run `speckeeper review ingest <dir>`.',
    packets,
  }, { lineWidth: 0 }), 'utf-8');
  report(json, { emitted: packets }, `  Wrote ${packets.length} packet(s) to ${dir}/ (see ${dir}/index.yaml)`);
  return 0;
}

function dryRun(
  selected: PlannedTarget[],
  toRun: PlannedTarget[],
  all: PlannedTarget[],
  force: boolean,
  json: boolean,
): number {
  const running = new Set(toRun);
  const reasonsOf = (t: PlannedTarget): string[] => {
    if (!t.record) return ['no record'];
    if (t.state === 'fresh') return ['forced'];
    return staleReasons(t.record, t.packet, true);
  };

  const estimate = estimateTokens(toRun, all);
  const approximated = estimate.approximated > 0
    ? ` (${estimate.approximated} target(s) of a check with no recorded usage are estimated from the packet text; the actual usage can differ widely)`
    : '';
  const run = toRun.map(t => ({ check: t.check.id, target: t.target.id, reasons: reasonsOf(t) }));
  const skip = selected.filter(t => !running.has(t)).map(t => ({
    check: t.check.id,
    target: t.target.id,
    reasons: [t.state === 'fresh' && !force ? 'current' : 'beyond --max-targets'],
  }));

  report(json, { run, skip, estimatedTokens: estimate.tokens, approximatedTargets: estimate.approximated }, [
    `  Would judge ${run.length} target(s), ≈ ${estimate.tokens} tokens${approximated}:`,
    ...run.map(r => `    ${r.check} / ${r.target}: ${r.reasons.join('; ')}`),
    `  Would skip ${skip.length} target(s):`,
    ...skip.map(r => chalk.gray(`    ${r.check} / ${r.target}: ${r.reasons.join('; ')}`)),
  ].join('\n'));
  return 0;
}

/**
 * Tokens a run would use: per check, the average recorded usage over every
 * record of that check (cached input included), or an estimate from the packet
 * text when the check has no recorded usage. Returns how many targets were
 * estimated from the text.
 */
function estimateTokens(toRun: PlannedTarget[], all: PlannedTarget[]): { tokens: number; approximated: number } {
  const average = new Map<string, number>();
  for (const checkId of new Set(toRun.map(t => t.check.id))) {
    const usages = all
      .filter(t => t.check.id === checkId)
      .flatMap(t => (t.record?.usage ? [totalTokens(t.record.usage)] : []));
    if (usages.length > 0) average.set(checkId, usages.reduce((a, b) => a + b, 0) / usages.length);
  }
  let tokens = 0;
  let approximated = 0;
  for (const t of toRun) {
    const recorded = average.get(t.check.id);
    if (recorded === undefined) approximated++;
    tokens += recorded ?? textTokens(t.packet.text);
  }
  return { tokens: Math.round(tokens), approximated };
}

function totalTokens(usage: NonNullable<JudgmentRecord['usage']>): number {
  return usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheCreationTokens ?? 0);
}

/**
 * Rough token count of a text: about four ASCII characters a token, and about
 * one token for each other character (CJK text runs close to one a character).
 */
function textTokens(text: string): number {
  let ascii = 0;
  let other = 0;
  for (const char of text) {
    if (char.charCodeAt(0) < 0x80) ascii++;
    else other++;
  }
  return ascii / 4 + other;
}

/** Prompt and context files a target's packet was built from, relative to the project root */
function inputPaths(t: PlannedTarget): string[] {
  const prompts = [t.check.check.prompt, t.check.check.verify?.prompt]
    .flatMap(p => (p !== undefined && typeof p !== 'string' ? [p.file] : []));
  return [...prompts, ...Object.keys(t.packet.inputHashes.files)];
}

/** HEAD, and whether any of the paths has uncommitted changes; null outside a git work tree */
function gitState(cwd: string, paths: string[]): { gitHead: string | null; gitDirty: boolean | null } {
  try {
    const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const existing = paths.filter(p => existsSync(join(cwd, p)) || existsSync(p));
    const status = existing.length > 0
      ? execFileSync('git', ['status', '--porcelain', '--', ...existing], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
      : '';
    return { gitHead, gitDirty: status.trim() !== '' };
  } catch {
    return { gitHead: null, gitDirty: null };
  }
}
