import { loadConfig } from "../utils/config-loader.js";
import { getSpecsFromConfig } from "../core/model.js";
import type { LintIssue } from "../cli/lint.js";

export interface SpecSummary {
  id: string;
  name?: string;
  description?: string;
  modelType: string;
  relations?: Array<{ type: string; target: string }>;
  [key: string]: unknown;
}

function extractSpecSummaries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  models: any[],
  specs: unknown[] | undefined,
): SpecSummary[] {
  const summaries: SpecSummary[] = [];

  for (const model of models) {
    const modelSpecs = getSpecsFromConfig(
      specs as import("../core/model.js").SpecEntry[] | undefined,
      model.id,
    );

    for (const spec of modelSpecs) {
      const s = spec as Record<string, unknown>;
      summaries.push({
        id: s.id as string,
        name: s.name as string | undefined,
        description: s.description as string | undefined,
        modelType: model.name ?? model.id,
        relations: s.relations as Array<{ type: string; target: string }> | undefined,
      });
    }
  }

  return summaries;
}

function formatSpecForContext(spec: SpecSummary): string {
  const lines: string[] = [];
  lines.push(`### ${spec.id} (${spec.modelType})`);
  if (spec.name) lines.push(`Name: ${spec.name}`);
  if (spec.description) lines.push(`Description: ${spec.description}`);
  if (spec.relations && spec.relations.length > 0) {
    lines.push("Relations:");
    for (const rel of spec.relations) {
      lines.push(`  - ${rel.type} → ${rel.target}`);
    }
  }
  return lines.join("\n");
}

function runLintForContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  models: any[],
  specs: unknown[] | undefined,
): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const model of models) {
    const modelSpecs = getSpecsFromConfig(
      specs as import("../core/model.js").SpecEntry[] | undefined,
      model.id,
    );
    if (modelSpecs.length === 0) continue;

    try {
      const lintResults = model.lintAll(modelSpecs);
      for (const result of lintResults) {
        issues.push({
          rule: result.ruleId,
          severity: result.severity,
          message: result.message,
          specId: result.specId,
          modelType: model.name,
        });
      }
    } catch {
      // lint may not be available for all models
    }
  }

  return issues;
}

export async function buildAuditRequirementsContext(
  configPath: string | undefined,
): Promise<string> {
  const config = await loadConfig(configPath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const models = (config.models || []) as any[];
  const specs = config.specs as unknown[] | undefined;

  const specSummaries = extractSpecSummaries(models, specs);
  const lintIssues = runLintForContext(models, specs);

  const sections: string[] = [];

  sections.push("# Requirement Quality Audit Request");
  sections.push(
    "## Project Configuration\n\n" +
    `- Design directory: ${config.designDir || "design"}\n` +
    `- Models: ${models.length}\n` +
    `- Total specs: ${specSummaries.length}`,
  );

  if (specSummaries.length > 0) {
    sections.push("## Spec Definitions\n");
    for (const spec of specSummaries) {
      sections.push(formatSpecForContext(spec));
    }
  }

  if (lintIssues.length > 0) {
    sections.push("## Existing Lint Issues\n");
    for (const issue of lintIssues) {
      const prefix = issue.specId ? `[${issue.specId}] ` : "";
      sections.push(`- [${issue.severity}] ${prefix}${issue.message} (rule: ${issue.rule})`);
    }
  }

  sections.push(
    "## Instructions\n\n" +
    "Evaluate all specs for:\n" +
    "- Verifiability: Can each requirement be objectively tested?\n" +
    "- Ambiguity: Are there vague terms without quantification?\n" +
    "- Granularity: Is the abstraction level consistent within each model?\n" +
    "- Terminology: Are terms used consistently across models?\n" +
    "- Design mixing: Are implementation details mixed into requirements?\n" +
    "- Completeness: Are there obvious gaps in coverage?\n\n" +
    "Use category vocabulary: verifiability, ambiguity, granularity, terminology, design-mixing, completeness, traceability.",
  );

  return sections.join("\n\n");
}

export async function buildProposeTraceLinksContext(
  configPath: string | undefined,
): Promise<string> {
  const config = await loadConfig(configPath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const models = (config.models || []) as any[];
  const specs = config.specs as unknown[] | undefined;

  const specSummaries = extractSpecSummaries(models, specs);

  const sections: string[] = [];

  sections.push("# Trace Link Proposal Request");
  sections.push(
    "## Project Configuration\n\n" +
    `- Design directory: ${config.designDir || "design"}\n` +
    `- Models: ${models.length}\n` +
    `- Total specs: ${specSummaries.length}`,
  );

  if (specSummaries.length > 0) {
    sections.push("## Spec Definitions\n");
    for (const spec of specSummaries) {
      sections.push(formatSpecForContext(spec));
    }
  }

  const existingRelations: string[] = [];
  for (const spec of specSummaries) {
    if (spec.relations) {
      for (const rel of spec.relations) {
        existingRelations.push(`${spec.id} --[${rel.type}]--> ${rel.target}`);
      }
    }
  }

  if (existingRelations.length > 0) {
    sections.push("## Existing Relations\n\n" + existingRelations.join("\n"));
  }

  // Collect external source info if available
  const sources = config.sources ?? [];
  if (sources.length > 0) {
    sections.push("## Configured External Sources\n");
    for (const source of sources) {
      sections.push(`- Type: ${source.type}, Paths: ${source.paths?.join(", ") ?? "N/A"}`);
    }
  }

  sections.push(
    "## Instructions\n\n" +
    "Analyze the spec definitions and propose candidate traceability links.\n" +
    "For each candidate link, provide:\n" +
    "- from: source spec ID\n" +
    "- relation: relation type (implements, verifiedBy, satisfies, derivedFrom, etc.)\n" +
    "- to: target identifier\n" +
    "- confidence: 0-1 score\n" +
    "- reason: rationale for the proposed link\n\n" +
    "Do NOT duplicate existing relations listed above.\n" +
    "Focus on cross-model links that strengthen traceability.",
  );

  return sections.join("\n\n");
}

export function buildExplainImpactContext(
  stdinJson: string,
  sourceCommand?: string,
): string {
  const sections: string[] = [];

  sections.push("# Impact Explanation Request");

  if (sourceCommand) {
    sections.push(`## Source Command: \`${sourceCommand}\``);
  }

  sections.push(`## Impact Output\n\n\`\`\`json\n${stdinJson}\n\`\`\``);
  sections.push(
    "## Instructions\n\n" +
    "Explain this speckeeper impact analysis output in human-readable form.\n" +
    "The explanation should be suitable for:\n" +
    "- PM and executive stakeholders\n" +
    "- Sprint planning discussions\n" +
    "- Change request documentation\n\n" +
    "Provide:\n" +
    "- A clear summary of what would be affected\n" +
    "- Affected artifacts categorized by type (spec, api, ddl, test, annotation)\n" +
    "- Test considerations for the change\n" +
    "- Release risk assessment (low, medium, high)\n" +
    "- Concrete action items as recommendedActions.",
  );

  return sections.join("\n\n");
}

export async function buildProposeAcceptanceCriteriaContext(
  configPath: string | undefined,
  targetSpecIds?: string[],
): Promise<string> {
  const config = await loadConfig(configPath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const models = (config.models || []) as any[];
  const specs = config.specs as unknown[] | undefined;

  const allSummaries = extractSpecSummaries(models, specs);
  const lintIssues = runLintForContext(models, specs);

  const targetSpecs = targetSpecIds && targetSpecIds.length > 0
    ? allSummaries.filter((s) => targetSpecIds.includes(s.id))
    : allSummaries;

  const sections: string[] = [];

  sections.push("# Acceptance Criteria Proposal Request");
  sections.push(
    "## Project Configuration\n\n" +
    `- Design directory: ${config.designDir || "design"}\n` +
    `- Target specs: ${targetSpecs.length}` +
    (targetSpecIds ? ` (filtered from ${allSummaries.length} total)` : ""),
  );

  if (targetSpecs.length > 0) {
    sections.push("## Target Specs\n");
    for (const spec of targetSpecs) {
      sections.push(formatSpecForContext(spec));
    }
  }

  // Include related specs for cross-reference
  if (targetSpecIds && targetSpecIds.length > 0) {
    const relatedIds = new Set<string>();
    for (const spec of targetSpecs) {
      if (spec.relations) {
        for (const rel of spec.relations) {
          if (!targetSpecIds.includes(rel.target)) {
            relatedIds.add(rel.target);
          }
        }
      }
    }

    const relatedSpecs = allSummaries.filter((s) => relatedIds.has(s.id));
    if (relatedSpecs.length > 0) {
      sections.push("## Related Specs (for context)\n");
      for (const spec of relatedSpecs) {
        sections.push(formatSpecForContext(spec));
      }
    }
  }

  const relevantLintIssues = targetSpecIds
    ? lintIssues.filter((i) => i.specId && targetSpecIds.includes(i.specId))
    : lintIssues;

  if (relevantLintIssues.length > 0) {
    sections.push("## Lint Issues (relevant)\n");
    for (const issue of relevantLintIssues) {
      sections.push(`- [${issue.severity}] [${issue.specId}] ${issue.message}`);
    }
  }

  sections.push(
    "## Instructions\n\n" +
    "For each target spec, propose testable acceptance criteria.\n" +
    "Each proposal should include:\n" +
    "- specId: the spec this applies to\n" +
    "- criteria: array of specific, testable acceptance criteria strings\n" +
    "- rationale: why these criteria are appropriate\n\n" +
    "Criteria must be:\n" +
    "- Specific and unambiguous\n" +
    "- Independently testable\n" +
    "- Written in Given/When/Then or verification format\n" +
    "- Not duplicating existing acceptance criteria if any exist in the spec.",
  );

  return sections.join("\n\n");
}
