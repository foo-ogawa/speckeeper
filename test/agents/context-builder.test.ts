import { describe, it, expect } from "vitest";
import { buildExplainImpactContext } from "../../src/agents/context-builder.js";

describe("buildExplainImpactContext", () => {
  it("wraps stdin JSON in context", () => {
    const json = JSON.stringify({
      target: "FR-001",
      targetType: "requirement",
      impactedNodes: [
        { id: "UC-001", type: "usecase", depth: 1, impactType: "direct" },
      ],
    });
    const ctx = buildExplainImpactContext(json, "impact FR-001");

    expect(ctx).toContain("# Impact Explanation Request");
    expect(ctx).toContain("Source Command: `impact FR-001`");
    expect(ctx).toContain("```json");
    expect(ctx).toContain(json);
  });

  it("works without source command", () => {
    const json = JSON.stringify({ target: "REQ-001", impactedNodes: [] });
    const ctx = buildExplainImpactContext(json);

    expect(ctx).toContain("# Impact Explanation Request");
    expect(ctx).not.toContain("Source Command");
  });

  it("includes impact output section", () => {
    const json = JSON.stringify({ target: "ENT-ORDER", impactedNodes: [] });
    const ctx = buildExplainImpactContext(json);

    expect(ctx).toContain("## Impact Output");
    expect(ctx).toContain("ENT-ORDER");
  });
});
