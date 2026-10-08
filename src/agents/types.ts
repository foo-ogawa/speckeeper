import type {
  AcceptanceCriteriaResult,
  ImpactExplainResult,
  RequirementAuditResult,
  TraceLinkResult,
} from "../generated/dsl/handoffs.js";

export type TaskId =
  | "audit-requirement-quality"
  | "propose-trace-links"
  | "explain-impact-result"
  | "propose-acceptance-criteria";

/** The result handoff of an LLM command's task */
export type AgentTaskResult = RequirementAuditResult | TraceLinkResult | ImpactExplainResult | AcceptanceCriteriaResult;

export interface AuditConfig {
  adapter?: string;
  model?: string;
  temperature?: number;
}

export interface AuditOptions {
  failOn?: "warning" | "error" | "critical";
  logFile?: string;
  showPrompt?: boolean;
}

export interface AuditRunResult {
  taskId: TaskId;
  /** The task's result, validated against its result handoff */
  data: AgentTaskResult | null;
  raw: string;
  prompt: string;
  status: "success" | "error" | "escalation" | "validation_error";
  errorMessage?: string;
  followUpsUsed: number;
  retriesUsed: number;
}
