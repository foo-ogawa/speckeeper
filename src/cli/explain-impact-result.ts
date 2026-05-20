import chalk from "chalk";
import { buildExplainImpactContext } from "../agents/context-builder.js";
import {
  runAgentTask,
  computeExitCode,
  formatResult,
  writeOutput,
  EXIT_RUNTIME_MISSING,
  EXIT_ADAPTER_ERROR,
} from "../agents/index.js";
import type { AuditConfig, AuditOptions, ReportFormat } from "../agents/index.js";

export interface CommandExplainImpactOptions {
  adapter?: string;
  model?: string;
  showPrompt?: boolean;
  failOn?: "warning" | "error" | "critical";
  output?: string;
  reportFormat?: ReportFormat;
}

export async function commandExplainImpact(
  opts: CommandExplainImpactOptions,
): Promise<void | string> {
  const stdin = await readStdin();
  if (!stdin.trim()) {
    console.error(chalk.red("Error: No input received on stdin."));
    console.error("Usage: speckeeper impact FR-001 --format json | speckeeper explain-impact");
    process.exit(2);
  }

  const context = buildExplainImpactContext(stdin);

  if (opts.showPrompt) {
    return context;
  }

  const auditConfig: AuditConfig = {
    adapter: opts.adapter,
    model: opts.model,
  };

  const auditOpts: AuditOptions = {
    failOn: opts.failOn,
  };

  try {
    const result = await runAgentTask(
      context,
      "explain-impact-result",
      auditConfig,
      auditOpts,
    );

    const content = formatResult(result, opts.reportFormat ?? "json");
    await writeOutput(content, opts.output);

    const exitCode = computeExitCode(result, auditOpts);
    if (exitCode !== 0) process.exit(exitCode);
  } catch (err: unknown) {
    const exitCode = (err as { exitCode?: number }).exitCode;
    if (exitCode === EXIT_RUNTIME_MISSING) {
      console.error(chalk.red((err as Error).message));
      process.exit(EXIT_RUNTIME_MISSING);
    }
    if (exitCode === EXIT_ADAPTER_ERROR) {
      console.error(chalk.red((err as Error).message));
      process.exit(EXIT_ADAPTER_ERROR);
    }
    throw err;
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", reject);

    if (process.stdin.isTTY) {
      resolve("");
    }
  });
}
