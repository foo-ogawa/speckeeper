/**
 * Template registry
 *
 * Maps mermaid node IDs to model template names and
 * external target node IDs to checker template names.
 *
 * Rule: Node ID = ID Prefix. Multiple node IDs can map to the same
 * template file (e.g. SR/FR/NFR → requirement.ts with 3 Model classes).
 */

import type { ModelLevel } from '../core/relation.js';

// ---------------------------------------------------------------------------
// Model template metadata
// ---------------------------------------------------------------------------

export interface ModelTemplateInfo {
  /** Template identifier */
  templateName: string;
  /** Default model level */
  defaultLevel: ModelLevel;
  /** ID prefix for spec instances (= node ID) */
  defaultIdPrefix: string;
  /** Human-readable model name (PascalCase) */
  modelName: string;
  /** kebab-case file name (without .ts) */
  fileName: string;
}

// ---------------------------------------------------------------------------
// Node ID → template alias mapping
// ---------------------------------------------------------------------------

const NODE_ALIAS: Record<string, string> = {
  // L0
  TERM: 'term',
  CDM: 'entity',
  // L1
  SR: 'requirement',
  FR: 'requirement',
  NFR: 'requirement',
  UC: 'usecase',
  // L2
  LDM: 'logical-entity',
  AT: 'acceptance-test',
  DT: 'data-test',
  VC: 'validation-constraint',
};

/** Metadata per template (used for the file-level info, not per-node) */
const TEMPLATE_META: Record<string, { level: ModelLevel; fileName: string; primaryTypeName: string }> = {
  term:                    { level: 'L0', fileName: 'term', primaryTypeName: 'Term' },
  entity:                  { level: 'L0', fileName: 'entity', primaryTypeName: 'Entity' },
  requirement:             { level: 'L1', fileName: 'requirement', primaryTypeName: 'Requirement' },
  usecase:                 { level: 'L1', fileName: 'usecase', primaryTypeName: 'UseCase' },
  'logical-entity':        { level: 'L2', fileName: 'logical-entity', primaryTypeName: 'LogicalEntity' },
  'acceptance-test':       { level: 'L2', fileName: 'acceptance-test', primaryTypeName: 'AcceptanceTest' },
  'data-test':             { level: 'L2', fileName: 'data-test', primaryTypeName: 'DataTest' },
  'validation-constraint': { level: 'L2', fileName: 'validation-constraint', primaryTypeName: 'ValidationConstraint' },
};

/**
 * Resolve a mermaid node ID to a model template.
 * Node ID = ID Prefix.
 * Unknown node IDs fall back to 'base' template.
 */
export function resolveModelTemplate(nodeId: string): ModelTemplateInfo {
  const templateName = NODE_ALIAS[nodeId];
  if (templateName) {
    const meta = TEMPLATE_META[templateName];
    return {
      templateName,
      defaultLevel: meta.level,
      defaultIdPrefix: nodeId,
      modelName: meta.primaryTypeName,
      fileName: meta.fileName,
    };
  }

  return {
    templateName: 'base',
    defaultLevel: 'L1',
    defaultIdPrefix: nodeId,
    modelName: toPascalCase(nodeId),
    fileName: toKebabCase(nodeId),
  };
}

// ---------------------------------------------------------------------------
// Checker template alias mapping
// ---------------------------------------------------------------------------

export interface CheckerTemplateInfo {
  templateName: string;
  targetType: string;
  fileName: string;
}

const CHECKER_ALIAS: Record<string, CheckerTemplateInfo> = {
  DDL: {
    templateName: 'ddl-checker',
    targetType: 'ddl',
    fileName: 'ddl-checker',
  },
  API: {
    templateName: 'openapi-checker',
    targetType: 'openapi',
    fileName: 'openapi-checker',
  },
  E2ET: {
    templateName: 'test-checker',
    targetType: 'test',
    fileName: 'e2e-test-checker',
  },
  UT: {
    templateName: 'test-checker',
    targetType: 'test',
    fileName: 'unit-test-checker',
  },
  DUT: {
    templateName: 'test-checker',
    targetType: 'test',
    fileName: 'data-unit-test-checker',
  },
  IT: {
    templateName: 'test-checker',
    targetType: 'test',
    fileName: 'integration-test-checker',
  },
};

/**
 * Resolve an external target node ID to a checker template.
 * Returns undefined for unknown targets (will use base-checker).
 */
export function resolveCheckerTemplate(targetNodeId: string): CheckerTemplateInfo | undefined {
  return CHECKER_ALIAS[targetNodeId];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPascalCase(s: string): string {
  return s
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function toKebabCase(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}
