/**
 * Review: per-target LLM judgments, declared next to the models they judge.
 *
 * A check selects targets, builds one packet per target, and hands it to a
 * judge. The judgment is recorded per (check, target) together with the hash
 * of the packet, so lint can tell from the records alone whether every target
 * has a current judgment and whether any blocking finding is open.
 */
import type { ReferenceGraph, ReferenceGraphEdge } from '../core/model.js';
import type { ReviewOutputDefinition } from './output.js';

/** The design a check selects from and a context provider reads */
export interface ReviewRegistry {
  /** modelId → specId → spec (the shape coverage checkers receive) */
  models: Record<string, Map<string, unknown>>;
  /** Every spec and relation (the graph impact traverses) */
  graph: ReferenceGraph;
  /** specId → spec */
  specs: Map<string, unknown>;
}

/** One unit a check judges */
export interface ReviewTarget {
  /** Target ID; names the record file, so it must be a safe file name */
  id: string;
  /** Specs the target is about */
  specIds: string[];
}

/** What a context provider hands to the packet for one target */
export interface ContextResult {
  /** Context text placed in the packet; the same input must give the same body */
  body: string;
  /** IDs of the specs the body was built from */
  inputs: string[];
  /** Paths (relative to the project root) of other files the body was built from */
  files?: string[];
  /**
   * How the provider reached each input spec from the target's specs, as the
   * relations it followed. Not hashed; it only explains which relation made a
   * changed spec part of the context.
   */
  paths?: Record<string, ReferenceGraphEdge[]>;
}

export interface ContextProvider {
  id: string;
  build(target: ReviewTarget, registry: ReviewRegistry): ContextResult | Promise<ContextResult>;
}

/** Prompt text inline, or read from a file relative to the project root */
export type ReviewPrompt = string | { file: string };

export type ReviewModelClass = 'fast' | 'standard' | 'thinking';

/** One point a check reviews: findings carry its code and get its severity */
export interface ReviewRule {
  /** Finding code; the judge may only use declared codes */
  code: string;
  /** Severity every finding of this rule is recorded with (the judge does not choose it) */
  severity: 'error' | 'warning' | 'info';
  /** What the rule reports */
  description: string;
}

export interface ReviewCheck {
  /** Check ID; names the record directory */
  id: string;
  /** What the check judges */
  description: string;
  /**
   * The targets to judge. Required for a check declared in the config; a
   * check declared on a model defaults to one target per spec of that model.
   */
  select?: (registry: ReviewRegistry) => ReviewTarget[];
  /** Context provider, or the ID of one (built-in: `relations`). Default `relations` */
  context?: string | ContextProvider;
  prompt: ReviewPrompt;
  /**
   * The points the check reviews. When given, the judge reports findings only
   * under these codes and each finding's severity is its rule's. When omitted,
   * the judge chooses the code and the severity.
   */
  rules?: ReviewRule[];
  /** Output shape; the common finding shape when omitted */
  output?: ReviewOutputDefinition;
  /** Default `standard` */
  modelClass?: ReviewModelClass;
  /** Re-check each finding in a separate call */
  verify?: { prompt: ReviewPrompt; modelClass?: ReviewModelClass };
}

export type ReviewAdapterName = 'claude' | 'openai' | 'gemini' | 'mock';

export type ReviewGateSeverity = 'error' | 'warning' | 'off';

export interface ReviewGateConfig {
  /** Severity of REVIEW-001 (missing or stale record). Default `error` */
  stale?: ReviewGateSeverity;
  /** Severity of REVIEW-002 (open blocking finding). Default `error` */
  openFindings?: ReviewGateSeverity;
  /** Finding severities REVIEW-002 counts. Default `['error']` */
  blocking?: Array<'error' | 'warning' | 'info'>;
  /**
   * What a record judged by a different adapter or model means.
   * `ignore` (default): nothing; `warning`: REVIEW-004; `stale`: the record is stale.
   */
  judgeChange?: 'ignore' | 'warning' | 'stale';
}

export interface ReviewConfigInput {
  checks?: ReviewCheck[];
  /** Context providers checks can name by ID */
  contextProviders?: ContextProvider[];
  /** Record directory, relative to the project root. Default `review` */
  dir?: string;
  /** Default `claude` */
  adapter?: ReviewAdapterName;
  /** When false, refuse to judge with an API key (exit 13). Default true */
  allowApiKey?: boolean;
  /** Upper limit of one judge call in seconds, including its one correction. Default 600 */
  timeoutSeconds?: number;
  /**
   * Claude Code executable the claude adapter runs, instead of the one the
   * Claude Agent SDK selects for Node's own architecture. Relative to the project root.
   */
  claudeExecutable?: string;
  gate?: ReviewGateConfig;
}
