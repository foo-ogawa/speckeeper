/**
 * Types for mermaid flowchart parsing and scaffold generation
 */

/** Arrow direction in mermaid */
export type ArrowDirection = 'forward' | 'bidirectional';

/** Parsed mermaid node */
export interface MermaidNode {
  /** Node ID (e.g. 'SR', 'FR', 'API') */
  id: string;
  /** Display label (e.g. 'システム要求', 'API仕様 openapi SSoT') */
  label: string | undefined;
  /** CSS classes applied (e.g. ['speckeeper']) */
  classes: string[];
}

/** Parsed mermaid edge */
export interface MermaidEdge {
  /** Source node ID */
  sourceId: string;
  /** Target node ID */
  targetId: string;
  /** Raw label text from |...| */
  rawLabel: string | undefined;
  /** Arrow direction */
  direction: ArrowDirection;
}

/** Parsed classDef */
export interface MermaidClassDef {
  /** Class name (e.g. 'speckeeper') */
  name: string;
  /** CSS styles */
  styles: string;
}

/** Class assignment (class NODE1,NODE2 className) */
export interface MermaidClassAssignment {
  /** Node IDs */
  nodeIds: string[];
  /** Class name */
  className: string;
}

/** Result of parsing a mermaid flowchart block */
export interface ParsedFlowchart {
  /** Flowchart direction (TB, LR, etc.) */
  direction: string;
  /** All nodes */
  nodes: Map<string, MermaidNode>;
  /** All edges */
  edges: MermaidEdge[];
  /** Class definitions */
  classDefs: MermaidClassDef[];
  /** Class assignments */
  classAssignments: MermaidClassAssignment[];
}

/** Edge label category determining what speckeeper generates */
export type EdgeCategory =
  | 'lint'       // A: speckeeper lint (reference integrity)
  | 'check'      // B: speckeeper check (external SSOT)
  | 'coverage'   // C: speckeeper check --coverage
  | 'drift'      // D: speckeeper drift (generated file tampering)
  | 'external';  // E: outside speckeeper scope

/** Edge vocabulary entry */
export interface EdgeVocabularyEntry {
  /** Canonical label */
  label: string;
  /** Expected arrow direction */
  expectedDirection: ArrowDirection;
  /** Corresponding speckeeper RelationType (if any) */
  relationType: string | undefined;
  /** Category determining generated code */
  category: EdgeCategory;
  /** Description */
  description: string;
}

/** Normalized edge with resolved vocabulary */
export interface ResolvedEdge extends MermaidEdge {
  /** Normalized label (from vocabulary) */
  normalizedLabel: string;
  /** Matched vocabulary entry */
  vocabulary: EdgeVocabularyEntry;
  /** Modifier text stripped during normalization */
  modifier: string | undefined;
}

/** Validation diagnostic */
export interface ScaffoldDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  /** Related node or edge info */
  context?: string;
}

/** Scaffold generation context for a speckeeper-managed node */
export interface NodeGenerationContext {
  /** Mermaid node */
  node: MermaidNode;
  /** Template name resolved from registry */
  templateName: string;
  /** Incoming edges (where this node is the target) */
  incomingEdges: ResolvedEdge[];
  /** Outgoing edges (where this node is the source) */
  outgoingEdges: ResolvedEdge[];
  /** Whether this node is speckeeper-managed */
  isSpeckeeperManaged: boolean;
}

/** Generated file output */
export interface GeneratedFile {
  /** Relative path from output directory */
  relativePath: string;
  /** File content */
  content: string;
}
