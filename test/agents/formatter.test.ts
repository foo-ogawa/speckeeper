import { describe, it, expect } from "vitest";
import { computeExitCode, formatResultText, formatResultJson } from "../../src/agents/formatter.js";
import type { AuditRunResult } from "../../src/agents/types.js";

function makeResult(overrides: Partial<AuditRunResult> = {}): AuditRunResult {
  return {
    taskId: "audit-requirement-quality",
    data: {
      summary: "Specs look well-defined",
      riskLevel: "low",
      findings: [],
    },
    raw: "",
    prompt: "test prompt",
    dryRun: false,
    status: "success",
    followUpsUsed: 0,
    retriesUsed: 0,
    ...overrides,
  };
}

describe("computeExitCode", () => {
  it("returns 0 for dry run", () => {
    const result = makeResult({ dryRun: true });
    expect(computeExitCode(result, {})).toBe(0);
  });

  it("returns 1 for non-success status", () => {
    const result = makeResult({ status: "error", data: null });
    expect(computeExitCode(result, {})).toBe(1);
  });

  it("returns 0 when no findings exceed threshold", () => {
    const result = makeResult({
      data: {
        summary: "OK",
        riskLevel: "low",
        findings: [
          { severity: "info", category: "completeness", message: "Consider adding more detail" },
          { severity: "warning", category: "ambiguity", message: "Minor ambiguity" },
        ],
      },
    });
    expect(computeExitCode(result, { failOn: "error" })).toBe(0);
  });

  it("returns 10 when findings exceed threshold", () => {
    const result = makeResult({
      data: {
        summary: "Issues found",
        riskLevel: "high",
        findings: [
          { severity: "error", category: "verifiability", message: "Not testable" },
        ],
      },
    });
    expect(computeExitCode(result, { failOn: "error" })).toBe(10);
  });

  it("respects failOn=warning threshold", () => {
    const result = makeResult({
      data: {
        summary: "Minor issues",
        riskLevel: "medium",
        findings: [
          { severity: "warning", category: "ambiguity", message: "Vague term used" },
        ],
      },
    });
    expect(computeExitCode(result, { failOn: "warning" })).toBe(10);
  });

  it("respects failOn=critical threshold", () => {
    const result = makeResult({
      data: {
        summary: "Errors present but not critical",
        riskLevel: "high",
        findings: [
          { severity: "error", category: "verifiability", message: "Not testable" },
        ],
      },
    });
    expect(computeExitCode(result, { failOn: "critical" })).toBe(0);
  });
});

describe("formatResultText", () => {
  it("returns prompt for dry run", () => {
    const result = makeResult({ dryRun: true, prompt: "my prompt" });
    expect(formatResultText(result)).toBe("my prompt");
  });

  it("formats findings with severity icons", () => {
    const result = makeResult({
      data: {
        summary: "Issues found",
        riskLevel: "high",
        findings: [
          {
            severity: "critical",
            category: "verifiability",
            message: "Cannot be tested",
            recommendation: "Add measurable criteria",
            location: "FR-001",
          },
        ],
      },
    });
    const text = formatResultText(result);
    expect(text).toContain("Risk Level: HIGH");
    expect(text).toContain("[verifiability] Cannot be tested");
    expect(text).toContain("Location: FR-001");
    expect(text).toContain("Recommendation: Add measurable criteria");
  });

  it("shows error message on failure", () => {
    const result = makeResult({ status: "error", data: null, errorMessage: "LLM failed" });
    expect(formatResultText(result)).toBe("LLM failed");
  });

  it("formats recommended actions", () => {
    const result = makeResult({
      data: {
        summary: "Review needed",
        riskLevel: "medium",
        findings: [],
        recommendedActions: [
          { kind: "run_command", title: "Re-run lint", command: "speckeeper lint" },
        ],
      },
    });
    const text = formatResultText(result);
    expect(text).toContain("[run_command] Re-run lint");
    expect(text).toContain("$ speckeeper lint");
  });
});

describe("formatResultJson", () => {
  it("returns prompt JSON for dry run", () => {
    const result = makeResult({ dryRun: true, prompt: "p" });
    const json = JSON.parse(formatResultJson(result));
    expect(json.dryRun).toBe(true);
    expect(json.prompt).toBe("p");
  });

  it("returns data JSON on success", () => {
    const result = makeResult();
    const json = JSON.parse(formatResultJson(result));
    expect(json.summary).toBe("Specs look well-defined");
    expect(json.riskLevel).toBe("low");
  });

  it("returns error JSON on failure", () => {
    const result = makeResult({ status: "error", data: null, errorMessage: "oops" });
    const json = JSON.parse(formatResultJson(result));
    expect(json.error).toBe("oops");
  });
});
