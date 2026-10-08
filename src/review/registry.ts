import { buildReferenceGraph, buildRegistryFromConfig, type SpecEntry } from '../core/model.js';
import type { ReviewRegistry } from './types.js';

/** The registry checks select from and context providers read, built from config.specs */
export function buildReviewRegistry(specEntries: SpecEntry[] | undefined): ReviewRegistry {
  const models = buildRegistryFromConfig(specEntries);
  const specs = new Map<string, unknown>();
  for (const map of Object.values(models)) {
    for (const [id, spec] of map) specs.set(id, spec);
  }
  return { models, graph: buildReferenceGraph(specEntries), specs };
}
