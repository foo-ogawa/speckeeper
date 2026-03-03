/**
 * Model file generator
 *
 * Generates _models/*.ts files for speckeeper-managed nodes
 * by looking up the appropriate template.
 */
import type {
  MermaidNode,
  ResolvedEdge,
  GeneratedFile,
} from './types.js';
import { resolveModelTemplate } from './template-registry.js';
import { MODEL_TEMPLATE_FUNCTIONS } from './templates/index.js';

/**
 * Generate _models/*.ts file for a single speckeeper-managed node.
 *
 * @param node - The mermaid node
 * @param incomingEdges - Edges pointing to this node
 * @param outgoingEdges - Edges from this node
 * @returns GeneratedFile or null if no template matches
 */
export function generateModelFile(
  node: MermaidNode,
  _incomingEdges: ResolvedEdge[],
  _outgoingEdges: ResolvedEdge[],
): GeneratedFile {
  const templateInfo = resolveModelTemplate(node.id);
  const templateFn = MODEL_TEMPLATE_FUNCTIONS[templateInfo.templateName];

  if (!templateFn) {
    const baseFn = MODEL_TEMPLATE_FUNCTIONS['base'];
    return {
      relativePath: `_models/${templateInfo.fileName}.ts`,
      content: baseFn({
        modelId: templateInfo.fileName,
        modelName: templateInfo.modelName,
        idPrefix: templateInfo.defaultIdPrefix,
        level: templateInfo.defaultLevel,
        description: node.label ?? node.id,
      }),
    };
  }

  const content = templateFn({
    modelId: templateInfo.fileName,
    modelName: templateInfo.modelName,
    idPrefix: templateInfo.defaultIdPrefix,
    level: templateInfo.defaultLevel,
    description: node.label ?? node.id,
  });

  return {
    relativePath: `_models/${templateInfo.fileName}.ts`,
    content,
  };
}

/**
 * Generate all model files for speckeeper-managed nodes.
 *
 * Multiple nodes may map to the same template (e.g. SR, FR, NFR → requirement).
 * In that case, only one file is generated (de-duplicated by template name).
 */
export function generateAllModelFiles(
  speckeeperNodes: MermaidNode[],
  resolvedEdges: ResolvedEdge[],
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const generated = new Set<string>();

  for (const node of speckeeperNodes) {
    const templateInfo = resolveModelTemplate(node.id);
    const key = templateInfo.templateName === 'base'
      ? `base:${node.id}`
      : templateInfo.templateName;

    if (generated.has(key)) continue;
    generated.add(key);

    const incoming = resolvedEdges.filter(e => e.targetId === node.id);
    const outgoing = resolvedEdges.filter(e => e.sourceId === node.id);
    files.push(generateModelFile(node, incoming, outgoing));
  }

  return files;
}
