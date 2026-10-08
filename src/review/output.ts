/**
 * The output a judge returns for one packet.
 *
 * speckeeper owns the finding shape; a project adds fields only through
 * `defineReviewOutput`. The same definition yields the JSON Schema shown in the
 * packet (and hashed into it) and the zod schema the judge's answer is
 * validated with.
 */
import { z } from 'zod';
import type { ReviewRule } from './types.js';

const SEVERITIES = ['error', 'warning', 'info'] as const;

export const ReviewFindingSchema = z.object({
  /** Finding code; the project decides the vocabulary */
  code: z.string().min(1),
  /** Same scale as lint results */
  severity: z.enum(SEVERITIES),
  message: z.string().min(1),
  /** What the finding is about: a spec ID, or `ID#field path` (e.g. `REQ-012#acceptanceCriteria[1]`) */
  subject: z.string().min(1).optional(),
  location: z.object({
    file: z.string().optional(),
    line: z.number().int().optional(),
    /** Text quoted from the packet's context */
    quote: z.string().optional(),
  }).optional(),
  /** IDs of the specs the finding rests on */
  evidence: z.array(z.string()).optional(),
  suggestion: z.string().optional(),
});

export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;

/** The finding fields speckeeper owns; anything else on a finding comes from the check's output definition */
export const COMMON_FINDING_FIELDS: readonly string[] = Object.keys(ReviewFindingSchema.shape);
const COMMON_OUTPUT_FIELDS = ['findings'];

/** Fields a project adds to the common output, made with `defineReviewOutput` */
export interface ReviewOutputDefinition {
  readonly kind: 'review-output';
  /** Fields added to each finding */
  readonly findingExtra: z.ZodRawShape;
  /** Fields added to the output as a whole */
  readonly extra: z.ZodRawShape;
}

/**
 * Declare the fields a check adds to the common output.
 *
 * @example
 * ```ts
 * const output = defineReviewOutput({
 *   findingExtra: { reason: z.string() },
 *   extra: { consistencyScore: z.number() },
 * });
 * ```
 */
export function defineReviewOutput(input: {
  findingExtra?: z.ZodRawShape;
  extra?: z.ZodRawShape;
}): ReviewOutputDefinition {
  const findingExtra = input.findingExtra ?? {};
  const extra = input.extra ?? {};
  for (const key of Object.keys(findingExtra)) {
    if (COMMON_FINDING_FIELDS.includes(key)) {
      throw new Error(`defineReviewOutput: findingExtra.${key} redefines a common finding field`);
    }
  }
  for (const key of Object.keys(extra)) {
    if (COMMON_OUTPUT_FIELDS.includes(key)) {
      throw new Error(`defineReviewOutput: extra.${key} redefines a common output field`);
    }
  }
  return { kind: 'review-output', findingExtra, extra };
}

const COMMON_OUTPUT: ReviewOutputDefinition = defineReviewOutput({});

/** What decides the shape of a check's output */
export interface ReviewOutputShape {
  output?: ReviewOutputDefinition;
  rules?: readonly ReviewRule[];
}

/** A finding as a judge answers it: without a severity when the check declares rules */
export type ReviewAnswerFinding = Omit<ReviewFinding, 'severity'> & {
  severity?: ReviewFinding['severity'];
} & Record<string, unknown>;

/** A judge's answer: the common findings plus the fields the check adds */
export type ReviewOutput = { findings: ReviewAnswerFinding[] } & Record<string, unknown>;

/**
 * The output schema of a check, before any check against the design or the
 * packet. With rules, a finding's code is one of the declared codes and the
 * judge gives no severity (the rule fixes it).
 */
export function buildOutputSchema(shape: ReviewOutputShape = {}): z.ZodType<ReviewOutput> {
  const definition = shape.output ?? COMMON_OUTPUT;
  const codes = shape.rules?.map(rule => rule.code);
  const finding = codes && codes.length > 0
    ? ReviewFindingSchema.omit({ severity: true }).extend({ code: z.enum(codes as [string, ...string[]]) })
    : ReviewFindingSchema;
  // Intersections keep the common fields typed; zod renders them as one object in JSON Schema
  return z.object({
    findings: z.array(finding.and(z.object(definition.findingExtra))),
  }).and(z.object(definition.extra));
}

/** JSON Schema of a check's output, as shown in the packet and hashed into it */
export function outputJsonSchema(shape?: ReviewOutputShape): unknown {
  return z.toJSONSchema(buildOutputSchema(shape));
}

/** Everything a judge's answer is checked against beyond its shape */
export interface JudgeOutputScope {
  /** Every spec in the design, by ID */
  specs: Map<string, unknown>;
  /** The packet's context body */
  contextBody: string;
}

/**
 * The schema a judge's answer must satisfy: the output shape, plus subject and
 * evidence naming specs (and fields) that exist and quotes taken from the
 * packet's context. A violation is a schema mismatch, so the judge gets the
 * same one correction as for a malformed answer.
 */
export function buildJudgeSchema(shape: ReviewOutputShape, scope: JudgeOutputScope) {
  const context = normalizeWhitespace(scope.contextBody);
  return buildOutputSchema(shape).superRefine((output, ctx) => {
    output.findings.forEach((finding, index) => {
      const at = ['findings', index];
      if (finding.subject !== undefined) {
        const problem = checkSubject(finding.subject, scope.specs);
        if (problem) ctx.addIssue({ code: 'custom', path: [...at, 'subject'], message: problem });
      }
      for (const [i, id] of (finding.evidence ?? []).entries()) {
        if (!scope.specs.has(id)) {
          ctx.addIssue({ code: 'custom', path: [...at, 'evidence', i], message: `No spec has the ID "${id}"` });
        }
      }
      const quote = finding.location?.quote;
      if (quote !== undefined && !context.includes(normalizeWhitespace(quote))) {
        ctx.addIssue({
          code: 'custom',
          path: [...at, 'location', 'quote'],
          message: 'The quote does not appear in the context; quote the context text verbatim',
        });
      }
    });
  });
}

/** Collapse runs of whitespace so a quote matches across line breaks and indentation */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Why a subject does not name an existing spec or field, or null when it does */
function checkSubject(subject: string, specs: Map<string, unknown>): string | null {
  const hash = subject.indexOf('#');
  const id = hash === -1 ? subject : subject.slice(0, hash);
  if (!specs.has(id)) return `No spec has the ID "${id}"`;
  if (hash === -1) return null;

  const path = subject.slice(hash + 1);
  let value: unknown = specs.get(id);
  for (const segment of path.split('.')) {
    const match = /^([^[\]]+)((?:\[\d+\])*)$/.exec(segment);
    if (!match) return `"${path}" is not a field path (use name.name[index])`;
    value = isRecord(value) ? value[match[1]] : undefined;
    for (const index of match[2].match(/\d+/g) ?? []) {
      value = Array.isArray(value) ? value[Number(index)] : undefined;
    }
    if (value === undefined) return `${id} has no field "${path}"`;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
