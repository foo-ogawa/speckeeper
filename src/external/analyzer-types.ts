/**
 * Type definitions aligned with agent-contracts-analyzer v0.1.1 external insight API.
 * Used when the private git package is not installed (e.g. CI without org credentials).
 * When installed, types are structurally identical to `agent-contracts-analyzer`.
 */

export type PropagationDirection = 'forward' | 'backward' | 'both';

export interface SymbolAnchor {
  symbolId: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface ExternalEvidence {
  kind: string;
  detail: string;
  filePath?: string;
  line?: number;
  endLine?: number;
  symbolId?: string;
  llmConfidence?: number;
}

export interface ExternalEdge {
  from: string;
  to: string;
  kind: string;
  propagation: PropagationDirection;
  weight?: number;
  metadata?: Record<string, unknown>;
  evidence?: ExternalEvidence[];
}

export interface AnchorMapping {
  domainId: string;
  filePaths: string[];
  symbolIds?: string[];
  symbols?: SymbolAnchor[];
  artifactId?: string;
}

export interface ExternalInsight {
  source: string;
  sourceVersion?: string;
  generatedAt?: string;
  edges: ExternalEdge[];
  anchorMapping?: AnchorMapping[];
}

export interface InsightQuery {
  projectRoot: string;
  changedFiles?: string[];
  changedSymbols?: string[];
  artifactIds?: string[];
  evidencePolicy?: {
    exclude?: string[];
  };
}

export interface InsightProvider {
  readonly name: string;
  provide(query: InsightQuery): Promise<ExternalInsight>;
}
