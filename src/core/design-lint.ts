/**
 * Common lint items
 *
 * Checks that hold across every model, so they cannot be expressed as a
 * `LintRule` (which sees one spec at a time): ID uniqueness, reference
 * integrity, relation level constraints, circular references, orphan elements,
 * the phase gate, and the review gate.
 *
 * Results are `LintResult`s, the same shape a model's own rules produce, so the
 * lint command reports both through one path.
 */
import { buildReferenceGraph, type LintResult, type SpecEntry } from './model.js';
import {
  detectCycles,
  RELATION_CONSTRAINTS,
  RELATION_TYPES,
  validateRelationLevel,
  type ModelLevel,
  type RelationType,
} from './relation.js';
import type { ReviewSetup } from '../review/checks.js';
import { REVIEW_LINT_RULES, runReviewGate } from '../review/gate.js';
import { buildReviewRegistry } from '../review/registry.js';
import {
  getPhaseIndex,
  isSlotUnresolved,
  PhaseSchema,
  type ConcretizationSlot,
  type Phase,
} from '../types/common.js';

/** Rule IDs of the common lint items */
export const COMMON_LINT_RULES = {
  /** Every element has an ID no other element uses */
  idUnique: 'id-unique',
  /** Every relation target resolves to a declared element */
  refExists: 'ref-exists',
  /** Every relation joins levels its type allows */
  relationLevel: 'relation-level',
  /** No cycle runs through one-way relations */
  relationCycle: 'relation-cycle',
  /** Every element takes part in at least one relation */
  orphan: 'orphan',
  /** No TBD is left unresolved once its deadline phase is reached */
  phaseTbd: 'phase-tbd',
  /** Review records: missing or stale, open blocking findings, orphaned records, judge changes */
  ...REVIEW_LINT_RULES,
} as const;

export interface DesignLintOptions {
  /**
   * Phase the gate runs against. Without one there is no deadline to compare
   * against, so the phase gate reports nothing.
   */
  phase?: Phase;
  /** The review setup; the review gate runs when it is given */
  review?: ReviewSetup;
  /** The registered models; the relation level check reads their levels */
  models?: ReadonlyArray<{ id: string; level?: ModelLevel }>;
}

/** The slot field the phase gate reads off a spec */
interface SlotBearingSpec {
  id: string;
  concretizationSlots?: ConcretizationSlot[];
}

/**
 * Parse a phase name coming from the CLI or the config file.
 * Throws on an unknown name so a misspelled phase fails instead of running a
 * gate that can never match.
 */
export function parsePhase(value: string, origin: string): Phase {
  const parsed = PhaseSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Unknown phase "${value}" (${origin}). Valid phases: ${PhaseSchema.options.join(', ')}`,
    );
  }
  return parsed.data;
}

/**
 * Run every common lint item over the whole design.
 *
 * Async because the review gate builds each target's packet, and a context
 * provider may be async.
 */
export async function runDesignLint(
  specs: SpecEntry[] | undefined,
  options: DesignLintOptions = {},
): Promise<LintResult[]> {
  const graph = buildReferenceGraph(specs);

  return [
    ...checkIdUniqueness(graph.nodes),
    ...checkReferenceIntegrity(graph.nodes, graph.edges),
    ...checkRelationLevels(graph.nodes, graph.edges, options.models ?? []),
    ...checkRelationCycles(graph.nodes, graph.edges),
    ...checkOrphans(graph.nodes, graph.edges),
    ...checkPhaseGate(specs, options.phase),
    ...(options.review ? await runReviewGate(options.review, buildReviewRegistry(specs)) : []),
  ];
}

/**
 * ID uniqueness: an ID used by more than one element makes every lookup by that
 * ID ambiguous, so each reuse is reported against the element that reused it.
 */
function checkIdUniqueness(
  nodes: ReturnType<typeof buildReferenceGraph>['nodes'],
): LintResult[] {
  const modelsById = new Map<string, string[]>();
  for (const node of nodes) {
    const models = modelsById.get(node.id) ?? [];
    models.push(node.model);
    modelsById.set(node.id, models);
  }

  const issues: LintResult[] = [];
  for (const [id, models] of modelsById) {
    if (models.length < 2) continue;
    issues.push({
      ruleId: COMMON_LINT_RULES.idUnique,
      severity: 'error',
      message: `ID "${id}" is declared ${models.length} times (${models.join(', ')}); every element must have a unique id`,
      specId: id,
    });
  }
  return issues;
}

/**
 * Reference integrity: every relation target must resolve to a declared
 * element. Every dangling reference is reported, so renaming an ID surfaces all
 * the places that still point at the old one.
 */
function checkReferenceIntegrity(
  nodes: ReturnType<typeof buildReferenceGraph>['nodes'],
  edges: ReturnType<typeof buildReferenceGraph>['edges'],
): LintResult[] {
  const declaredIds = new Set(nodes.map(node => node.id));

  return edges
    .filter(edge => !declaredIds.has(edge.to))
    .map(edge => ({
      ruleId: COMMON_LINT_RULES.refExists,
      severity: 'error' as const,
      message: `Relation '${edge.type}' of "${edge.from}" targets "${edge.to}", which is not declared by any model`,
      specId: edge.from,
    }));
}

type GraphNodes = ReturnType<typeof buildReferenceGraph>['nodes'];
type GraphEdges = ReturnType<typeof buildReferenceGraph>['edges'];

/** The relations between declared elements, with a type the relation constraints define */
function declaredRelations(nodes: GraphNodes, edges: GraphEdges): Array<GraphEdges[number] & { type: RelationType }> {
  const declaredIds = new Set(nodes.map(node => node.id));
  return edges.filter((edge): edge is GraphEdges[number] & { type: RelationType } =>
    declaredIds.has(edge.to) && (RELATION_TYPES as readonly string[]).includes(edge.type));
}

/**
 * Relation level constraints: each relation type allows only some target
 * levels and a direction between the levels of its source and target model
 * (RELATION_CONSTRAINTS). A relation that touches a model without a level is
 * not checked.
 */
function checkRelationLevels(
  nodes: GraphNodes,
  edges: GraphEdges,
  models: ReadonlyArray<{ id: string; level?: ModelLevel }>,
): LintResult[] {
  const levelOfModel = new Map(models.map(model => [model.id, model.level]));
  const levelOf = new Map(nodes.map(node => [node.id, levelOfModel.get(node.model)]));

  return declaredRelations(nodes, edges).flatMap(edge => {
    const violation = validateRelationLevel(levelOf.get(edge.from), edge.from, { type: edge.type, target: edge.to }, levelOf.get(edge.to));
    return violation
      ? [{
          ruleId: COMMON_LINT_RULES.relationLevel,
          severity: 'error' as const,
          message: `Relation '${edge.type}' of "${edge.from}" to "${edge.to}": ${violation.message}`,
          specId: edge.from,
        }]
      : [];
  });
}

/**
 * Circular references: a cycle through one-way relations means every element
 * on it is, through the others, a refinement or dependency of itself. A
 * bidirectional relation (relatedTo, traces — propagation both) links both
 * ways by definition, so it never closes a cycle.
 */
function checkRelationCycles(nodes: GraphNodes, edges: GraphEdges): LintResult[] {
  const oneWay = declaredRelations(nodes, edges).filter(edge => RELATION_CONSTRAINTS[edge.type].propagation !== 'both');

  return detectCycles(oneWay.map(edge => ({ sourceId: edge.from, targetId: edge.to, type: edge.type }))).map(cycle => ({
    ruleId: COMMON_LINT_RULES.relationCycle,
    severity: 'error' as const,
    message: cycle.message,
    specId: cycle.sourceId,
  }));
}

/**
 * Orphan elements: an element that neither references another element nor is
 * referenced by one sits outside the traceability graph.
 */
function checkOrphans(
  nodes: ReturnType<typeof buildReferenceGraph>['nodes'],
  edges: ReturnType<typeof buildReferenceGraph>['edges'],
): LintResult[] {
  const declaredIds = new Set(nodes.map(node => node.id));
  const related = new Set<string>();
  for (const edge of edges) {
    related.add(edge.from);
    if (declaredIds.has(edge.to)) related.add(edge.to);
  }

  return nodes
    .filter(node => !related.has(node.id))
    .map(node => ({
      ruleId: COMMON_LINT_RULES.orphan,
      severity: 'info' as const,
      message: `"${node.id}" (${node.model}) takes part in no relation`,
      specId: node.id,
    }));
}

/**
 * Phase gate: a concretization slot may hold a TBD until its deadline phase is
 * reached. Once the gate phase is at or past that deadline, an unresolved slot
 * is an error.
 */
function checkPhaseGate(specs: SpecEntry[] | undefined, phase: Phase | undefined): LintResult[] {
  if (!phase) return [];

  const gateIndex = getPhaseIndex(phase);
  const issues: LintResult[] = [];

  for (const entry of specs ?? []) {
    for (const spec of entry.data) {
      const { id, concretizationSlots } = spec as SlotBearingSpec;
      for (const slot of concretizationSlots ?? []) {
        if (getPhaseIndex(slot.mustDecideBy) > gateIndex) continue;
        if (!isSlotUnresolved(slot)) continue;
        issues.push({
          ruleId: COMMON_LINT_RULES.phaseTbd,
          severity: 'error',
          message: `"${id}" leaves ${slot.field} unresolved; it must be decided by phase ${slot.mustDecideBy} and the gate is at ${phase}`,
          specId: id,
        });
      }
    }
  }

  return issues;
}
