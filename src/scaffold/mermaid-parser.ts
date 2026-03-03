/**
 * Mermaid flowchart parser
 *
 * Extracts nodes, edges, classDefs, and class assignments
 * from a mermaid flowchart block embedded in Markdown.
 */
import type {
  ArrowDirection,
  MermaidNode,
  MermaidEdge,
  MermaidClassDef,
  MermaidClassAssignment,
  ParsedFlowchart,
} from './types.js';

/**
 * Extract mermaid code blocks from Markdown content
 */
export function extractMermaidBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const regex = /```mermaid\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

/**
 * Parse a mermaid flowchart block into structured data
 */
export function parseFlowchart(mermaidSource: string): ParsedFlowchart {
  const lines = mermaidSource.split('\n');
  const nodes = new Map<string, MermaidNode>();
  const edges: MermaidEdge[] = [];
  const classDefs: MermaidClassDef[] = [];
  const classAssignments: MermaidClassAssignment[] = [];
  let direction = 'TB';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('%%')) continue;

    const flowchartMatch = line.match(/^flowchart\s+(\w+)/);
    if (flowchartMatch) {
      direction = flowchartMatch[1];
      continue;
    }

    if (line.startsWith('graph ')) {
      const gMatch = line.match(/^graph\s+(\w+)/);
      if (gMatch) direction = gMatch[1];
      continue;
    }

    const classDefMatch = line.match(/^classDef\s+(\S+)\s+(.*)/);
    if (classDefMatch) {
      classDefs.push({ name: classDefMatch[1], styles: classDefMatch[2] });
      continue;
    }

    const classAssignMatch = line.match(/^class\s+(\S+)\s+(\S+)/);
    if (classAssignMatch) {
      const nodeIds = classAssignMatch[1].split(',').map(s => s.trim());
      classAssignments.push({ nodeIds, className: classAssignMatch[2] });
      for (const id of nodeIds) {
        ensureNode(nodes, id);
        const node = nodes.get(id)!;
        if (!node.classes.includes(classAssignMatch[2])) {
          node.classes.push(classAssignMatch[2]);
        }
      }
      continue;
    }

    const edgeParsed = tryParseEdgeLine(line);
    if (edgeParsed) {
      for (const { sourceId, sourceLabel, targetId, targetLabel, label, direction: dir } of edgeParsed) {
        ensureNode(nodes, sourceId, sourceLabel);
        ensureNode(nodes, targetId, targetLabel);
        edges.push({
          sourceId,
          targetId,
          rawLabel: label,
          direction: dir,
        });
      }
      continue;
    }

    const standaloneNode = tryParseStandaloneNode(line);
    if (standaloneNode) {
      ensureNode(nodes, standaloneNode.id, standaloneNode.label);
    }
  }

  return { direction, nodes, edges, classDefs, classAssignments };
}

/**
 * Parse Markdown and return the first flowchart found
 */
export function parseMarkdownFlowchart(markdown: string): ParsedFlowchart | null {
  const blocks = extractMermaidBlocks(markdown);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.startsWith('flowchart') || trimmed.startsWith('graph')) {
      return parseFlowchart(trimmed);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureNode(nodes: Map<string, MermaidNode>, id: string, label?: string): void {
  const existing = nodes.get(id);
  if (existing) {
    if (label && !existing.label) {
      existing.label = label;
    }
  } else {
    nodes.set(id, { id, label, classes: [] });
  }
}

/** Node with optional label: ID[Label text] or ID */
const NODE_PATTERN = /([A-Za-z_]\w*)(?:\[([^\]]*)\])?/;

interface ParsedEdgeResult {
  sourceId: string;
  sourceLabel: string | undefined;
  targetId: string;
  targetLabel: string | undefined;
  label: string | undefined;
  direction: ArrowDirection;
}

/**
 * Try to parse an edge line. Returns array of edges (a line can have chained edges).
 *
 * Supported arrow patterns:
 *   -->   --->   ---->         forward
 *   <-->  <--->  <---->        bidirectional
 *   -.->                       forward (dotted)
 *   ==>                        forward (thick)
 *   -->|label|                 forward with label
 *   <-->|label|                bidirectional with label
 */
function tryParseEdgeLine(line: string): ParsedEdgeResult[] | null {
  // Arrow patterns, ordered longest-first to avoid partial matches
  const arrowPatterns = [
    { regex: /<-{2,}>/, direction: 'bidirectional' as ArrowDirection },
    { regex: /<={2,}>/, direction: 'bidirectional' as ArrowDirection },
    { regex: /-{2,}>/, direction: 'forward' as ArrowDirection },
    { regex: /={2,}>/, direction: 'forward' as ArrowDirection },
    { regex: /-\.->/, direction: 'forward' as ArrowDirection },
  ];

  // Try to find any arrow in the line
  let bestMatch: {
    index: number;
    length: number;
    direction: ArrowDirection;
  } | null = null;

  for (const ap of arrowPatterns) {
    const m = line.match(ap.regex);
    if (m && m.index !== undefined) {
      if (!bestMatch || m.index < bestMatch.index) {
        bestMatch = { index: m.index, length: m[0].length, direction: ap.direction };
      }
    }
  }

  if (!bestMatch) return null;

  // Split line at the arrow
  const leftPart = line.substring(0, bestMatch.index).trim();
  const rightPart = line.substring(bestMatch.index + bestMatch.length).trim();

  // Extract source node from left part
  const sourceMatch = leftPart.match(NODE_PATTERN);
  if (!sourceMatch) return null;
  const sourceId = sourceMatch[1];
  const sourceLabel = sourceMatch[2] || undefined;

  // Right part may be: |label| TargetNode  or  just TargetNode
  let label: string | undefined;
  let targetStr = rightPart;

  const labelMatch = rightPart.match(/^\|([^|]*)\|\s*(.*)/);
  if (labelMatch) {
    label = labelMatch[1].trim();
    targetStr = labelMatch[2];
  }

  // Extract target node
  const targetMatch = targetStr.match(NODE_PATTERN);
  if (!targetMatch) return null;
  const targetId = targetMatch[1];
  const targetLabel = targetMatch[2] || undefined;

  return [{
    sourceId,
    sourceLabel,
    targetId,
    targetLabel,
    label,
    direction: bestMatch.direction,
  }];
}

function tryParseStandaloneNode(line: string): { id: string; label: string | undefined } | null {
  const m = line.match(/^([A-Za-z_]\w*)\[([^\]]*)\]\s*$/);
  if (m) {
    return { id: m[1], label: m[2] };
  }
  return null;
}
