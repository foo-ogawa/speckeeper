import { buildReferenceGraph, buildRegistryFromConfig, type SpecEntry } from '../core/model.js';
import type { ReviewRegistry } from './types.js';

/** The registry checks select from and context providers read, built from config.specs */
export function buildReviewRegistry(specEntries: SpecEntry[] | undefined): ReviewRegistry {
  const content = specEntries?.map(entry => ({ ...entry, data: entry.data.map(withoutSourceFile) }));
  const models = buildRegistryFromConfig(content);
  const specs = new Map<string, unknown>();
  for (const map of Object.values(models)) {
    for (const [id, spec] of map) specs.set(id, spec);
  }
  return { models, graph: buildReferenceGraph(content), specs };
}

/**
 * The spec without the file the loader read it from, so a spec judges and
 * hashes the same wherever the checkout is.
 */
function withoutSourceFile(spec: unknown): unknown {
  if (typeof spec !== 'object' || spec === null || !('_sourceFile' in spec)) return spec;
  return Object.fromEntries(Object.entries(spec).filter(([key]) => key !== '_sourceFile'));
}
