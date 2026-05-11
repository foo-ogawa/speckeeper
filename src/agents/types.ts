import type { RequirementAuditResult } from "../generated/dsl/handoffs.js";

export type TaskId =
  | "audit-requirement-quality"
  | "propose-trace-links"
  | "explain-impact-result"
  | "propose-acceptance-criteria";

export interface AuditConfig {
  adapter?: string;
  model?: string;
  temperature?: number;
}

export interface AuditOptions {
  dryRun?: boolean;
  failOn?: "warning" | "error" | "critical";
}

export interface AuditRunResult {
  taskId: TaskId;
  data: RequirementAuditResult | null;
  raw: string;
  prompt: string;
  dryRun: boolean;
  status: "success" | "error" | "escalation" | "validation_error";
  errorMessage?: string;
  followUpsUsed: number;
  retriesUsed: number;
}
