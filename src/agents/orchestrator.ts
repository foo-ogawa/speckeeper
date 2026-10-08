import { resolvedDsl } from "../generated/dsl/dsl-data.js";
import { handoffSchemas } from "../generated/dsl/handoffs.js";
import { taskRegistry } from "../generated/dsl/tasks.js";
import type { AgentTaskResult, AuditConfig, AuditOptions, AuditRunResult, TaskId } from "./types.js";

export const EXIT_RUNTIME_MISSING = 11;
export const EXIT_ADAPTER_ERROR = 12;

/** The LLM runtime every LLM feature runs on */
export type LlmRuntime = typeof import("@aaac/runtime");

/**
 * Load the LLM runtime. It is an optional peer dependency, so a missing
 * runtime is an error with exit code 11 rather than a crash.
 */
export async function loadRuntime(): Promise<LlmRuntime> {
  try {
    return await import("@aaac/runtime");
  } catch {
    throw Object.assign(
      new Error(
        "@aaac/runtime is not installed. " +
        "Install it to use this command, or inspect the prompt without calling the LLM.\n" +
        "  npm install --save-dev @aaac/runtime",
      ),
      { exitCode: EXIT_RUNTIME_MISSING },
    );
  }
}

export async function runAgentTask(
  userRequest: string,
  taskId: TaskId,
  auditConfig: AuditConfig,
  options: AuditOptions,
): Promise<AuditRunResult> {
  const { executeTask } = await loadRuntime();

  const adapterName = auditConfig.adapter ?? "mock";

  let result;
  try {
    result = await executeTask(taskId, {
      request: userRequest,
      adapter: adapterName,
      model: auditConfig.model,
      dsl: resolvedDsl,
      ...(options.logFile
        ? { progressLog: { destination: "file" as const, file: options.logFile, naming: "single" as const } }
        : {}),
      maxFollowUps: 3,
      maxRetries: 1,
      adapterOptions: {
        tools: ["Read", "Glob", "Grep"],
        permissionMode: "bypassPermissions",
      },
    });
  } catch (err) {
    throw Object.assign(err as Error, { exitCode: EXIT_ADAPTER_ERROR });
  }

  const outcome = result.outcome;
  return {
    taskId,
    data: outcome.status === "success" ? parseTaskResult(taskId, outcome.data) : null,
    raw: outcome.status === "error" ? "" : outcome.raw,
    prompt: userRequest,
    status: outcome.status as AuditRunResult["status"],
    errorMessage:
      outcome.status === "error" ? outcome.message :
      outcome.status === "escalation" ? outcome.reason :
      outcome.status === "validation_error" ? outcome.errors?.message :
      undefined,
    followUpsUsed: result.follow_ups_used,
    retriesUsed: result.retries_used,
  };
}

/** A task's output, validated against the result handoff its DSL task declares */
function parseTaskResult(taskId: TaskId, data: unknown): AgentTaskResult {
  const handoff = taskRegistry[taskId].result_handoff;
  const parsed = handoffSchemas[handoff].parse(data);
  if (!("summary" in parsed)) {
    throw Object.assign(new Error(`Task ${taskId} declares ${handoff}, which is not a result handoff`), {
      exitCode: EXIT_ADAPTER_ERROR,
    });
  }
  return parsed;
}
