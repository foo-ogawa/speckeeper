/**
 * Context providers: build the context of one target's packet.
 */
import YAML from 'yaml';
import { traverseReferenceGraph, type ReferenceGraphEdge } from '../core/model.js';
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
      const related = new Map<string, { depth: number; via: ReferenceGraphEdge; model: string }>();
      for (const specId of target.specIds) {
        for (const reached of traverseReferenceGraph(registry.graph, specId, { depth, direction: 'both', edgeFilter: follow })) {
          if (targetIds.has(reached.id)) continue;
          const known = related.get(reached.id);
          if (!known || reached.depth < known.depth) related.set(reached.id, reached);
        }
      }

      const relatedIds = [...related.keys()].sort((a, b) =>
        related.get(a)!.depth - related.get(b)!.depth || (a < b ? -1 : a > b ? 1 : 0));

      const body = YAML.stringify({
        target: target.specIds.map(id => registry.specs.get(id)),
        related: relatedIds.map(id => {
          const { depth: distance, via, model } = related.get(id)!;
          return { relation: via, depth: distance, model, spec: registry.specs.get(id) };
        }),
      }, { lineWidth: 0 });

      return { body, inputs: [...target.specIds, ...relatedIds] };
    },
  };
}
