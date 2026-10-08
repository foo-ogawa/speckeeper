/**
 * Packet: everything a judge is given for one target, and its hash.
 *
 * The packet hash says whether the input is the same as when a record was
 * judged. The model is not part of it; the judge signature is recorded
 * separately (see staleness).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReviewOutputDefinition } from './output.js';
import { outputJsonSchema } from './output.js';
import type { ReferenceGraphEdge } from '../core/model.js';
import type { ContextProvider, ReviewPrompt, ReviewRegistry, ReviewRule, ReviewTarget } from './types.js';

/** The reviewer's role, shared by every packet */
const REVIEWER_ROLE = [
  'You are a design reviewer. You judge one target of a specification against the check below.',
  'Use only the context in this packet; you have no tools and no other files.',
  'Report each problem as one finding. Cite spec IDs that appear in the context, and quote context text verbatim.',
  'Return no findings when the target passes the check.',
].join('\n');

/** Per-input hashes; they explain why a record is stale, they do not decide it */
export interface InputHashes {
  prompt: string;
  /** Present when the check declares a verifier */
  verifyPrompt?: string;
  /** Present when the check declares rules */
  rules?: string;
  schema: string;
  /** specId → hash of the spec */
  specs: Record<string, string>;
  /** path → hash of the file */
  files: Record<string, string>;
}

export interface Packet {
  checkId: string;
  targetId: string;
  /** The text the judge receives */
  text: string;
  /** The context body inside the text; judge quotes are checked against it */
  contextBody: string;
  hash: string;
  /** Spec IDs the context was built from */
  inputs: string[];
  inputHashes: InputHashes;
  /** How the context reached each input spec (not hashed; explains staleness) */
  paths: Record<string, ReferenceGraphEdge[]>;
}

/** A check with its prompt files read and its context provider resolved */
export interface PacketSource {
  id: string;
  description: string;
  prompt: string;
  verifyPrompt?: string;
  rules?: readonly ReviewRule[];
  output?: ReviewOutputDefinition;
  provider: ContextProvider;
}

/** Read a prompt that may live in a file under the project root */
export function readPrompt(prompt: ReviewPrompt, rootDir: string): string {
  return typeof prompt === 'string' ? prompt : readText(join(rootDir, prompt.file));
}

export async function buildPacket(
  source: PacketSource,
  target: ReviewTarget,
  registry: ReviewRegistry,
  rootDir: string,
): Promise<Packet> {
  const context = await source.provider.build(target, registry);
  const schemaJson = JSON.stringify(outputJsonSchema(source), null, 2);
  const rules = source.rules ?? [];

  const text = [
    '# Review packet',
    '',
    '## Role',
    REVIEWER_ROLE,
    '',
    `## Check: ${source.id}`,
    source.description,
    '',
    `## Target: ${target.id}`,
    '',
    '## Instructions',
    source.prompt.trim(),
    '',
    ...(rules.length > 0
      ? [
          '## Rules',
          'Report every finding under exactly one of these codes. The severity is fixed by the rule; do not give one.',
          ...rules.map(rule => `- ${rule.code} (${rule.severity}): ${rule.description}`),
          '',
        ]
      : []),
    '## Context',
    context.body.trimEnd(),
    '',
    '## Output',
    'Answer with one JSON object that matches this JSON Schema:',
    '```json',
    schemaJson,
    '```',
    '',
  ].join('\n');

  const files: Record<string, string> = {};
  for (const path of [...(context.files ?? [])].sort()) {
    files[path.replace(/\\/g, '/')] = sha256(readText(join(rootDir, path)));
  }

  const specs: Record<string, string> = {};
  for (const id of [...new Set(context.inputs)].sort()) {
    specs[id] = sha256(canonicalJson(registry.specs.get(id) ?? null));
  }

  const inputHashes: InputHashes = {
    prompt: sha256(source.prompt),
    ...(source.verifyPrompt !== undefined ? { verifyPrompt: sha256(source.verifyPrompt) } : {}),
    ...(rules.length > 0 ? { rules: sha256(canonicalJson(rules)) } : {}),
    schema: sha256(schemaJson),
    specs,
    files,
  };

  return {
    checkId: source.id,
    targetId: target.id,
    text,
    contextBody: context.body,
    hash: sha256(canonicalJson({
      check: source.id,
      packet: text,
      verifyPrompt: source.verifyPrompt ?? null,
      files,
    })),
    inputs: Object.keys(specs),
    inputHashes,
    paths: context.paths ?? {},
  };
}

export function sha256(text: string): string {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

/** JSON with object keys sorted at every level, so equal values serialize identically */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter(key => (value as Record<string, unknown>)[key] !== undefined)
        .map(key => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/** Text with line endings normalized, so a checkout's line-ending policy does not change a hash */
function readText(path: string): string {
  return readFileSync(path, 'utf-8').replace(/\r\n/g, '\n');
}
