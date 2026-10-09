/**
 * Judgment records: one YAML file per (check, target) under the review directory.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { canonicalJson, sha256 } from './packet.js';
import { compareStrings } from '../core/model.js';
import { normalizeWhitespace, ReviewFindingSchema, type ReviewFinding } from './output.js';

const hashString = z.string().regex(/^sha256:[0-9a-f]{64}$/);

/** The adapter and model(s) a record was judged with */
const JudgeSignatureSchema = z.object({
  adapter: z.string(),
  model: z.string().optional(),
  verifyModel: z.string().optional(),
}).strict();

export type JudgeSignature = z.infer<typeof JudgeSignatureSchema>;

/** A recorded finding: the judge's finding plus what speckeeper and people add to it */
const RecordedFindingSchema = ReviewFindingSchema.extend({
  fingerprint: hashString,
  /** Fields the check's output definition adds to a finding */
  extra: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['open', 'false_positive', 'dismissed']),
  statusNote: z.string().optional(),
  verifier: z.object({
    verdict: z.enum(['confirmed', 'false_positive']),
    rationale: z.string(),
  }).strict().optional(),
}).strict().superRefine((finding, ctx) => {
  if (finding.status === 'dismissed' && !finding.statusNote?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['statusNote'], message: 'a dismissed finding needs a statusNote' });
  }
});

export type RecordedFinding = z.infer<typeof RecordedFindingSchema>;

const InputHashesSchema = z.object({
  prompt: hashString,
  verifyPrompt: hashString.optional(),
  rules: hashString.optional(),
  schema: hashString,
  specs: z.record(z.string(), hashString),
  files: z.record(z.string(), hashString),
}).strict();

const RebaselineSchema = z.object({
  from: hashString,
  to: hashString,
  changedInputs: z.array(z.object({
    input: z.string(),
    from: hashString.nullable(),
    to: hashString.nullable(),
  }).strict()),
  reason: z.string().min(1),
  at: z.string(),
  gitHead: z.string().nullable(),
  gitDirty: z.boolean().nullable(),
}).strict();

const JudgmentRecordSchema = z.object({
  check: z.string(),
  target: z.string(),
  packetHash: hashString,
  inputs: z.array(z.string()),
  inputHashes: InputHashesSchema,
  judge: JudgeSignatureSchema,
  judgedAt: z.string(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    /** Input read from the prompt cache, not counted in inputTokens */
    cacheReadTokens: z.number().optional(),
    /** Input written to the prompt cache, not counted in inputTokens */
    cacheCreationTokens: z.number().optional(),
  }).strict().optional(),
  /** Fields the check's output definition adds to the output as a whole */
  extra: z.record(z.string(), z.unknown()).optional(),
  findings: z.array(RecordedFindingSchema),
  rebaselined: z.array(RebaselineSchema).optional(),
}).strict();

export type JudgmentRecord = z.infer<typeof JudgmentRecordSchema>;

export function recordPath(dir: string, checkId: string, targetId: string): string {
  return join(dir, checkId, `${targetId}.yaml`);
}

/** Read a record; a malformed record throws, naming the file */
export function readRecord(path: string): JudgmentRecord | undefined {
  if (!existsSync(path)) return undefined;
  const parsed = JudgmentRecordSchema.safeParse(parseYaml(readFileSync(path, 'utf-8')));
  if (!parsed.success) {
    throw new Error(`Invalid review record ${path}: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/**
 * Every `<dir>/<check>/<target><suffix>` file, as (check, target, path):
 * records (`.yaml`) under the review directory, results (`.result.yaml`)
 * under an emit directory.
 */
export function listCheckFiles(dir: string, suffix: string): Array<{ check: string; target: string; path: string }> {
  if (!existsSync(dir)) return [];
  const files: Array<{ check: string; target: string; path: string }> = [];
  for (const check of readdirSync(dir, { withFileTypes: true })) {
    if (!check.isDirectory()) continue;
    for (const file of readdirSync(join(dir, check.name), { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith(suffix)) continue;
      files.push({ check: check.name, target: file.name.slice(0, -suffix.length), path: join(dir, check.name, file.name) });
    }
  }
  return files.sort((a, b) => compareStrings(a.path, b.path));
}

/**
 * Write a record with a fixed key order and sorted lists, so that the same
 * judgment always produces the same file and a change shows as a small diff.
 */
export function writeRecord(path: string, record: JudgmentRecord): void {
  const valid = JudgmentRecordSchema.parse(record);
  const ordered = {
    check: valid.check,
    target: valid.target,
    packetHash: valid.packetHash,
    inputs: [...valid.inputs].sort(compareStrings),
    inputHashes: {
      prompt: valid.inputHashes.prompt,
      ...(valid.inputHashes.verifyPrompt ? { verifyPrompt: valid.inputHashes.verifyPrompt } : {}),
      ...(valid.inputHashes.rules ? { rules: valid.inputHashes.rules } : {}),
      schema: valid.inputHashes.schema,
      specs: sortedRecord(valid.inputHashes.specs),
      files: sortedRecord(valid.inputHashes.files),
    },
    judge: {
      adapter: valid.judge.adapter,
      ...(valid.judge.model !== undefined ? { model: valid.judge.model } : {}),
      ...(valid.judge.verifyModel !== undefined ? { verifyModel: valid.judge.verifyModel } : {}),
    },
    judgedAt: valid.judgedAt,
    ...(valid.usage ? {
      usage: {
        inputTokens: valid.usage.inputTokens,
        outputTokens: valid.usage.outputTokens,
        ...(valid.usage.cacheReadTokens !== undefined ? { cacheReadTokens: valid.usage.cacheReadTokens } : {}),
        ...(valid.usage.cacheCreationTokens !== undefined ? { cacheCreationTokens: valid.usage.cacheCreationTokens } : {}),
      },
    } : {}),
    ...(valid.extra && Object.keys(valid.extra).length > 0 ? { extra: sortedRecord(valid.extra) } : {}),
    findings: [...valid.findings].sort(compareFindings).map(orderFinding),
    ...(valid.rebaselined && valid.rebaselined.length > 0 ? { rebaselined: valid.rebaselined } : {}),
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyYaml(ordered, { lineWidth: 0 }), 'utf-8');
}

/**
 * The identity of a finding across judgments, made by speckeeper from the
 * structured fields only. The message is left out because its wording changes
 * from one judgment to the next.
 */
export function findingFingerprint(
  checkId: string,
  targetId: string,
  finding: Pick<ReviewFinding, 'code' | 'subject' | 'location' | 'evidence'>,
): string {
  return sha256(canonicalJson({
    check: checkId,
    target: targetId,
    code: finding.code,
    subject: finding.subject ?? normalizeWhitespace(finding.location?.quote ?? ''),
    evidence: [...(finding.evidence ?? [])].sort(compareStrings),
  }));
}

/**
 * Carry the status a person set on a finding over to a new judgment.
 *
 * Only a fingerprint that occurs exactly once in both the old and the new
 * findings carries over; every other new finding keeps the status the new
 * judgment gave it. A status the old verifier set (false_positive with the
 * verifier's own false_positive verdict) is not a person's decision: the new
 * judgment decides it again. A wrongly carried status would silence a finding
 * that should be reported, so every ambiguity resolves towards reporting.
 */
export function carryOverStatus(previous: RecordedFinding[], next: RecordedFinding[]): RecordedFinding[] {
  const count = (findings: RecordedFinding[]) => {
    const counts = new Map<string, number>();
    for (const f of findings) counts.set(f.fingerprint, (counts.get(f.fingerprint) ?? 0) + 1);
    return counts;
  };
  const before = count(previous);
  const after = count(next);
  return next.map(finding => {
    if (before.get(finding.fingerprint) !== 1 || after.get(finding.fingerprint) !== 1) return finding;
    const old = previous.find(f => f.fingerprint === finding.fingerprint)!;
    const setByVerifier = old.status === 'false_positive' && old.verifier?.verdict === 'false_positive';
    if (old.status === 'open' || setByVerifier) return finding;
    const carried: RecordedFinding = { ...finding, status: old.status };
    if (old.statusNote !== undefined) carried.statusNote = old.statusNote;
    else delete carried.statusNote;
    return carried;
  });
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

function compareFindings(a: RecordedFinding, b: RecordedFinding): number {
  return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    compareStrings(a.code, b.code) ||
    compareStrings(a.subject ?? '', b.subject ?? '') ||
    compareStrings(a.fingerprint, b.fingerprint) ||
    compareStrings(a.message, b.message);
}

function orderFinding(f: RecordedFinding): Record<string, unknown> {
  return {
    fingerprint: f.fingerprint,
    code: f.code,
    severity: f.severity,
    message: f.message,
    ...(f.subject !== undefined ? { subject: f.subject } : {}),
    ...(f.location !== undefined ? { location: f.location } : {}),
    ...(f.evidence !== undefined ? { evidence: [...f.evidence].sort(compareStrings) } : {}),
    ...(f.suggestion !== undefined ? { suggestion: f.suggestion } : {}),
    ...(f.extra !== undefined && Object.keys(f.extra).length > 0 ? { extra: sortedRecord(f.extra) } : {}),
    status: f.status,
    ...(f.statusNote !== undefined ? { statusNote: f.statusNote } : {}),
    ...(f.verifier !== undefined ? { verifier: f.verifier } : {}),
  };
}

function sortedRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.keys(record).sort(compareStrings).map(key => [key, record[key]]));
}

