/**
 * Context providers: build the context of one target's packet.
 */
import YAML from 'yaml';
import { compareStrings, traverseReferenceGraph, type ReachedSpec, type ReferenceGraphEdge } from '../core/model.js';
import type { ContextProvider, ContextResult, ReviewRegistry, ReviewTarget } from './types.js';

export interface RelationsContextOptions {
  /** Relations to follow from the target's specs. Default 1 */
  depth?: number;
  /** Follow only these relation types */
  relationTypes?: string[];
  /** Follow only the relations this returns true for (sees type and description) */
  edgeFilter?: (edge: ReferenceGraphEdge) => boolean;
}

/**
 * The built-in `relations` context: the target's specs, followed by the specs
 * reachable from them over the reference graph, in YAML.
 *
 * The specs are found with the traversal impact uses (both directions), so the
 * set of specs whose change makes a record stale is the set impact reports.
 */
export function relationsContext(options: RelationsContextOptions = {}): ContextProvider {
  const depth = options.depth ?? 1;
  const { relationTypes, edgeFilter } = options;
  const follow = (edge: ReferenceGraphEdge): boolean =>
    (relationTypes === undefined || relationTypes.includes(edge.type)) &&
    (edgeFilter === undefined || edgeFilter(edge));

  return {
    id: 'relations',
    build(target: ReviewTarget, registry: ReviewRegistry): ContextResult {
      const targetIds = new Set(target.specIds);
      const related = new Map<string, { reached: ReachedSpec; path: ReferenceGraphEdge[] }>();
      for (const specId of target.specIds) {
        const reachedSpecs = traverseReferenceGraph(registry.graph, specId, { depth, direction: 'both', edgeFilter: follow });
        const via = new Map(reachedSpecs.map(r => [r.id, r.via]));
        for (const reached of reachedSpecs) {
          if (targetIds.has(reached.id)) continue;
          const known = related.get(reached.id);
          if (!known || reached.depth < known.reached.depth) {
            related.set(reached.id, { reached, path: pathBack(reached.id, specId, via) });
          }
        }
      }

      const relatedEntries = [...related.values()].sort((a, b) =>
        a.reached.depth - b.reached.depth || compareStrings(a.reached.id, b.reached.id));

      const body = YAML.stringify({
        target: target.specIds.map(id => registry.specs.get(id)),
        related: relatedEntries.map(({ reached }) => ({
          relation: reached.via,
          depth: reached.depth,
          model: reached.model,
          spec: registry.specs.get(reached.id),
        })),
      }, { lineWidth: 0 });

      return {
        body,
        inputs: [...target.specIds, ...relatedEntries.map(e => e.reached.id)],
        paths: Object.fromEntries(relatedEntries.map(e => [e.reached.id, e.path])),
      };
    },
  };
}

/** The relations from `start` to `id`, following each reached spec's `via` edge back */
function pathBack(id: string, start: string, via: Map<string, ReferenceGraphEdge>): ReferenceGraphEdge[] {
  const steps: ReferenceGraphEdge[] = [];
  for (let current = id, edge = via.get(current); edge && current !== start; edge = via.get(current)) {
    steps.unshift(edge);
    current = edge.to === current ? edge.from : edge.to;
  }
  return steps;
}
