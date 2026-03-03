/**
 * Checker file generator
 *
 * Generates _checkers/*.ts files for edges from speckeeper-managed nodes
 * to external (non-speckeeper) nodes that require ExternalChecker.
 */
import type {
  MermaidNode,
  ResolvedEdge,
  GeneratedFile,
} from './types.js';
import { isCheckEdge } from './edge-vocabulary.js';
import { resolveModelTemplate, resolveCheckerTemplate } from './template-registry.js';
import { CHECKER_TEMPLATE_FUNCTIONS } from './templates/index.js';

/**
 * Determine which edges need checker generation.
 *
 * An edge qualifies if:
 * 1. Its vocabulary category is 'check' (implements)
 * 2. The source is speckeeper-managed and target is external
 *
 * For test-like targets, a test-checker is generated (verifies test file
 * existence and spec ID references). For artifact targets, an ExternalChecker
 * is generated.
 */
export function findCheckerEdges(
  resolvedEdges: ResolvedEdge[],
  nodes: Map<string, MermaidNode>,
  speckeeperClassName: string,
): ResolvedEdge[] {
  const isSpk = (id: string): boolean =>
    nodes.get(id)?.classes.includes(speckeeperClassName) ?? false;

  return resolvedEdges.filter(edge => {
    if (!isCheckEdge(edge.vocabulary)) return false;
    if (!isSpk(edge.sourceId)) return false;
    if (isSpk(edge.targetId)) return false;
    return true;
  });
}

/**
 * Generate _checkers/*.ts for a single checker edge.
 */
export function generateCheckerFile(
  edge: ResolvedEdge,
  _nodes: Map<string, MermaidNode>,
): GeneratedFile {
  const checkerInfo = resolveCheckerTemplate(edge.targetId);
  const sourceTemplateInfo = resolveModelTemplate(edge.sourceId);

  if (checkerInfo) {
    const templateFn = CHECKER_TEMPLATE_FUNCTIONS[checkerInfo.templateName];
    if (templateFn) {
      return {
        relativePath: `_checkers/${checkerInfo.fileName}.ts`,
        content: templateFn({
          checkerName: checkerInfo.fileName,
          targetType: checkerInfo.targetType,
          sourceModelName: sourceTemplateInfo.modelName,
          sourceModelFile: sourceTemplateInfo.fileName,
          description: `Checks ${sourceTemplateInfo.modelName} against ${edge.targetId}`,
        }),
      };
    }
  }

  const baseFn = CHECKER_TEMPLATE_FUNCTIONS['base-checker'];
  const targetId = edge.targetId.toLowerCase();
  const fileName = `${targetId}-checker`;

  return {
    relativePath: `_checkers/${fileName}.ts`,
    content: baseFn({
      checkerName: fileName,
      targetType: targetId,
      sourceModelName: sourceTemplateInfo.modelName,
      sourceModelFile: sourceTemplateInfo.fileName,
      description: `Checks ${sourceTemplateInfo.modelName} against ${edge.targetId}`,
    }),
  };
}

/**
 * Generate all checker files.
 * De-duplicates by target node ID (multiple edges to the same target → one checker).
 */
export function generateAllCheckerFiles(
  resolvedEdges: ResolvedEdge[],
  nodes: Map<string, MermaidNode>,
  speckeeperClassName: string,
): GeneratedFile[] {
  const checkerEdges = findCheckerEdges(resolvedEdges, nodes, speckeeperClassName);
  const files: GeneratedFile[] = [];
  const generated = new Set<string>();

  for (const edge of checkerEdges) {
    if (generated.has(edge.targetId)) continue;
    generated.add(edge.targetId);
    files.push(generateCheckerFile(edge, nodes));
  }

  return files;
}
