/**
 * Resolving the declared checks and planning a review: which targets exist,
 * what their packets hash to, and which records are missing or stale.
 *
 * `assessRecord` is the one staleness decision; the review command and the
 * lint gate both read it from the plan built here.
 */
import { join } from 'node:path';
import { relationsContext } from './context.js';
import { buildPacket, readPrompt, type Packet, type PacketSource } from './packet.js';
import {
  listRecordFiles,
  readRecord,
  recordPath,
  type JudgeSignature,
  type JudgmentRecord,
} from './record.js';
import type {
  ContextProvider,
  ReviewCheck,
  ReviewConfigInput,
  ReviewGateConfig,
  ReviewModelClass,
  ReviewRegistry,
  ReviewTarget,
} from './types.js';

/** A declared check, ready to build packets */
export interface ResolvedCheck extends PacketSource {
  check: ReviewCheck;
  /** The model that declares the check, when it is declared on a model */
  modelId?: string;
  modelClass: ReviewModelClass;
  verifyModelClass?: ReviewModelClass;
}

/** The review section with its defaults applied and its checks resolved */
export interface ReviewSetup {
  config: ReviewConfigInput;
  rootDir: string;
  /** Absolute record directory */
  dir: string;
  gate: Required<ReviewGateConfig>;
  checks: ResolvedCheck[];
}

/** A model as far as review needs it */
export interface ReviewModel {
  id: string;
  getReviewChecks(): ReviewCheck[];
}

export class ReviewConfigError extends Error {
  readonly exitCode = 1;
}

/** IDs name directories and files, so they are limited to a safe file-name alphabet */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Resolve the review section and every check declared in it or on a model.
 * Returns null when nothing declares a check and there is no review section.
 */
export function resolveReviewSetup(
  config: ReviewConfigInput | undefined,
  models: ReviewModel[],
  rootDir: string,
): ReviewSetup | null {
  const declared: Array<{ check: ReviewCheck; modelId?: string }> = [
    ...(config?.checks ?? []).map(check => ({ check })),
    ...models.flatMap(model => model.getReviewChecks().map(check => ({ check, modelId: model.id }))),
  ];
  if (!config && declared.length === 0) return null;

  const providers = new Map<string, ContextProvider>([['relations', relationsContext()]]);
  const userProviderIds = new Set<string>();
  for (const provider of config?.contextProviders ?? []) {
    if (userProviderIds.has(provider.id)) {
      throw new ReviewConfigError(`review.contextProviders declares "${provider.id}" twice`);
    }
    userProviderIds.add(provider.id);
    providers.set(provider.id, provider);
  }

  const seen = new Set<string>();
  const checks = declared.map(({ check, modelId }): ResolvedCheck => {
    const where = modelId ? `review check "${check.id}" of model ${modelId}` : `review check "${check.id}"`;
    if (!SAFE_ID.test(check.id)) {
      throw new ReviewConfigError(`${where}: the ID must match ${SAFE_ID}`);
    }
    if (seen.has(check.id)) throw new ReviewConfigError(`${where} is declared more than once`);
    seen.add(check.id);
    if (!modelId && !check.select) {
      throw new ReviewConfigError(`${where} is declared in the config and needs select()`);
    }

    let provider: ContextProvider;
    if (check.context === undefined) {
      provider = providers.get('relations')!;
    } else if (typeof check.context === 'string') {
      const found = providers.get(check.context);
      if (!found) throw new ReviewConfigError(`${where}: no context provider "${check.context}"`);
      provider = found;
    } else {
      provider = check.context;
    }

    return {
      check,
      modelId,
      id: check.id,
      description: check.description,
      prompt: readPrompt(check.prompt, rootDir),
      ...(check.verify ? { verifyPrompt: readPrompt(check.verify.prompt, rootDir) } : {}),
      output: check.output,
      provider,
      modelClass: check.modelClass ?? 'standard',
      ...(check.verify ? { verifyModelClass: check.verify.modelClass ?? check.modelClass ?? 'standard' } : {}),
    };
  });

  return {
    config: config ?? {},
    rootDir,
    dir: join(rootDir, config?.dir ?? 'review'),
    gate: {
      stale: config?.gate?.stale ?? 'error',
      openFindings: config?.gate?.openFindings ?? 'error',
      blocking: config?.gate?.blocking ?? ['error'],
      judgeChange: config?.gate?.judgeChange ?? 'ignore',
    },
    checks,
  };
}

/** The targets a check judges, validated against the design */
export function selectTargets(check: ResolvedCheck, registry: ReviewRegistry): ReviewTarget[] {
  const targets = check.check.select
    ? check.check.select(registry)
    : [...(registry.models[check.modelId!]?.keys() ?? [])].map(id => ({ id, specIds: [id] }));

  const seen = new Set<string>();
  for (const target of targets) {
    const where = `review check "${check.id}", target "${target.id}"`;
    if (!SAFE_ID.test(target.id)) throw new ReviewConfigError(`${where}: the ID must match ${SAFE_ID}`);
    if (seen.has(target.id)) throw new ReviewConfigError(`${where} is selected more than once`);
    seen.add(target.id);
    for (const specId of target.specIds) {
      if (!registry.specs.has(specId)) throw new ReviewConfigError(`${where}: no spec has the ID "${specId}"`);
    }
  }
  return targets;
}

export type TargetState = 'missing' | 'stale' | 'fresh';

/**
 * Whether a record is current for a packet. A record is stale when its
 * packet hash differs, and also when its judge differs under
 * `judgeChange: stale`. This is the only place staleness is decided.
 */
export function assessRecord(
  record: JudgmentRecord | undefined,
  packetHash: string,
  currentJudge: JudgeSignature | undefined,
  judgeChange: ReviewGateConfig['judgeChange'],
): { state: TargetState; judgeChanged: boolean } {
  if (!record) return { state: 'missing', judgeChanged: false };
  const judgeChanged = judgeChange !== 'ignore' && currentJudge !== undefined && !sameJudge(record.judge, currentJudge);
  if (record.packetHash !== packetHash) return { state: 'stale', judgeChanged };
  return { state: judgeChanged && judgeChange === 'stale' ? 'stale' : 'fresh', judgeChanged };
}

function sameJudge(a: JudgeSignature, b: JudgeSignature): boolean {
  return a.adapter === b.adapter && a.model === b.model && a.verifyModel === b.verifyModel;
}

export interface PlannedTarget {
  check: ResolvedCheck;
  target: ReviewTarget;
  packet: Packet;
  recordFile: string;
  record?: JudgmentRecord;
  state: TargetState;
  /** The configured judge (only resolved when judgeChange is not ignore) */
  currentJudge?: JudgeSignature;
  /** The record's judge differs from currentJudge */
  judgeChanged: boolean;
}

/** A record whose check is no longer declared or whose target is no longer selected */
export interface OrphanRecord {
  check: string;
  target: string;
  path: string;
}

export interface ReviewPlan {
  targets: PlannedTarget[];
  orphans: OrphanRecord[];
}

export async function planReview(
  setup: ReviewSetup,
  registry: ReviewRegistry,
  currentJudge?: (check: ResolvedCheck) => JudgeSignature,
): Promise<ReviewPlan> {
  const targets: PlannedTarget[] = [];
  for (const check of setup.checks) {
    const judge = setup.gate.judgeChange !== 'ignore' && currentJudge ? currentJudge(check) : undefined;
    for (const target of selectTargets(check, registry)) {
      const packet = await buildPacket(check, target, registry, setup.rootDir);
      const recordFile = recordPath(setup.dir, check.id, target.id);
      const record = readRecord(recordFile);
      targets.push({
        check,
        target,
        packet,
        recordFile,
        record,
        currentJudge: judge,
        ...assessRecord(record, packet.hash, judge, setup.gate.judgeChange),
      });
    }
  }

  const planned = new Set(targets.map(t => `${t.check.id}/${t.target.id}`));
  const orphans = listRecordFiles(setup.dir).filter(file => !planned.has(`${file.check}/${file.target}`));
  return { targets, orphans };
}

/** One input whose hash differs between a record and the current packet */
export interface ChangedInput {
  /** `prompt`, `verifyPrompt`, `schema`, `spec:<id>` or `file:<path>` */
  input: string;
  from: string | null;
  to: string | null;
}

/** The inputs that changed since a record was judged, to explain why it is stale */
export function changedInputs(record: JudgmentRecord, packet: Packet): ChangedInput[] {
  const before = flattenInputHashes(record.inputHashes);
  const after = flattenInputHashes(packet.inputHashes);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys
    .filter(key => before[key] !== after[key])
    .map(key => ({ input: key, from: before[key] ?? null, to: after[key] ?? null }));
}

function flattenInputHashes(hashes: JudgmentRecord['inputHashes']): Record<string, string> {
  const flat: Record<string, string> = { prompt: hashes.prompt, schema: hashes.schema };
  if (hashes.verifyPrompt) flat.verifyPrompt = hashes.verifyPrompt;
  for (const [id, hash] of Object.entries(hashes.specs)) flat[`spec:${id}`] = hash;
  for (const [path, hash] of Object.entries(hashes.files)) flat[`file:${path}`] = hash;
  return flat;
}

/** Targets in the order a run judges them: missing records first, then stale ones, each by target ID */
export function runOrder(targets: PlannedTarget[]): PlannedTarget[] {
  const rank = { missing: 0, stale: 1, fresh: 2 } as const;
  return [...targets].sort((a, b) =>
    rank[a.state] - rank[b.state] ||
    compare(a.target.id, b.target.id) ||
    compare(a.check.id, b.check.id));
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
