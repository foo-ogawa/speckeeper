/**
 * Readers for the declared design and contract data, shared by the tests in this
 * directory. Every value is read from a declared source — design/ specs,
 * cli-contract.yaml, artifact-contracts.yaml — so the tests never carry a second
 * copy of a fact that lives somewhere else.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { glob } from 'glob';
import { buildRegistryFromConfig, getSpecsFromConfig } from '../../src/core/model.js';
import design from '../../design/index.ts';
import { REQUIREMENT_MODEL_IDS } from '../../design/_models/requirement.ts';
import { CLICommandModel } from '../../design/_models/cli-command.ts';
import { TestRefModel } from '../../design/_models/test-ref.ts';
import type { CLICommand } from '../../design/_models/cli-command.ts';
import type { TestRef } from '../../design/_models/test-ref.ts';

export const repoRoot = join(import.meta.dirname, '..', '..');

export interface AcceptanceCriterion {
  id: string;
  description: string;
  verificationMethod?: string;
}

export interface RequirementSpec {
  id: string;
  description: string;
  acceptanceCriteria?: AcceptanceCriterion[];
}

export function requirementSpecs(): RequirementSpec[] {
  return REQUIREMENT_MODEL_IDS.flatMap(
    (modelId) => getSpecsFromConfig(design.specs, modelId) as RequirementSpec[],
  );
}

export function requirement(id: string): RequirementSpec {
  const found = requirementSpecs().find((spec) => spec.id === id);
  if (!found) throw new Error(`Requirement ${id} is not defined in design/`);
  return found;
}

export function acceptanceCriterion(id: string): AcceptanceCriterion {
  for (const spec of requirementSpecs()) {
    const found = spec.acceptanceCriteria?.find((ac) => ac.id === id);
    if (found) return found;
  }
  throw new Error(`Acceptance criterion ${id} is not defined in design/`);
}

/**
 * The comma-separated lists a requirement spells out in parentheses, in order.
 * `"... command (lint, check)"` yields `[['lint', 'check']]`.
 * Throws when the text carries no list, so a reworded requirement fails loudly
 * instead of silently narrowing what a test checks.
 */
export function parenthesisedLists(text: string): string[][] {
  const lists = [...text.matchAll(/\(([^)]*)\)/g)].map((match) =>
    match[1]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
  if (lists.length === 0) throw new Error(`No parenthesised list in: ${text}`);
  return lists;
}

export function contractCommandNames(): string[] {
  const contract = parseYaml(readFileSync(join(repoRoot, 'cli-contract.yaml'), 'utf-8')) as {
    command_sets: Record<string, { commands: Record<string, unknown> }>;
  };
  return Object.values(contract.command_sets).flatMap((set) => Object.keys(set.commands));
}

export function cliCommandSpecs(): CLICommand[] {
  return getSpecsFromConfig(design.specs, CLICommandModel.instance.id) as CLICommand[];
}

export function testRefSpecs(): TestRef[] {
  return getSpecsFromConfig(design.specs, TestRefModel.instance.id) as TestRef[];
}

/** Repo-relative paths of the files a declared artifact class covers. */
export function artifactFiles(artifactId: string): string[] {
  const contracts = parseYaml(readFileSync(join(repoRoot, 'artifact-contracts.yaml'), 'utf-8')) as {
    artifacts: Record<string, { path_patterns: string[]; exclude_patterns?: string[] }>;
  };
  const artifact = contracts.artifacts[artifactId];
  if (!artifact) throw new Error(`No artifact "${artifactId}" in artifact-contracts.yaml`);

  return glob
    .sync(artifact.path_patterns, {
      cwd: repoRoot,
      ignore: artifact.exclude_patterns ?? [],
      nodir: true,
    })
    .sort();
}

/** The spec registry the coverage checkers consume, keyed by model id. */
export function specRegistry(): Record<string, Map<string, unknown>> {
  return buildRegistryFromConfig(design.specs);
}
