/**
 * Definition and validation of model relations
 */
import { z } from 'zod';

// ============================================================================
// Model Levels
// ============================================================================

/**
 * Model abstraction level
 * 
 * - L0: Business + Domain Analysis (Why / Problem space)
 *       Desired outcomes/value, business flows, actors, terminology, business rules
 * - L1: Requirements (What)
 *       Functional/non-functional requirements, constraints, acceptance criteria
 * - L2: Design (How / Direction)
 *       Architecture, component breakdown, domain model, key sequences
 * - L3: Detailed Design/Implementation (How to build / Concrete artifacts)
 *       Screen/API/DB definitions, external SSOT references
 */
export type ModelLevel = 'L0' | 'L1' | 'L2' | 'L3';

/**
 * Get numeric index of level
 */
export function getLevelIndex(level: ModelLevel): number {
  return ['L0', 'L1', 'L2', 'L3'].indexOf(level);
}

// ============================================================================
// Relation Types
// ============================================================================

/**
 * Relation types
 */
export const RELATION_TYPES = [
  'dependsOn',
  'uses',
  'includes',
  'implements',
  'refines',
  'verifies',
  'verifiedBy',
  'satisfies',
  'traces',
  'relatedTo',
] as const;

export type RelationType = typeof RELATION_TYPES[number];

/**
 * Relation schema
 */
export const RelationSchema = z.object({
  /** Relation type */
  type: z.enum(RELATION_TYPES),
  /** Target ID */
  target: z.string(),
  /** Description (optional) */
  description: z.string().optional(),
});

/**
 * Relation field to add to model schemas
 * Usage: schema.extend({ relations: RelationsFieldSchema })
 */
export const RelationsFieldSchema = z.array(RelationSchema).optional();

export type Relation = z.infer<typeof RelationSchema>;

// ============================================================================
// Relation Constraints
// ============================================================================

/**
 * Definition of relation constraints
 */
export interface RelationConstraint {
  /** Allowed target levels (all levels allowed if not specified) */
  allowedTargetLevels?: ModelLevel[];
  /** Level constraint rule */
  levelRule: 'source>target' | 'source>=target' | 'same' | 'any';
  /** Direction of impact propagation */
  propagation: 'forward' | 'backward' | 'both';
}

/**
 * Constraint definitions per relation type
 * 
 * Level hierarchy:
 *   L0 (Business) → L1 (Requirements) → L2 (Design) → L3 (Implementation)
 *   Abstract ───────────────────────────→ Concrete
 */
export const RELATION_CONSTRAINTS: Record<RelationType, RelationConstraint> = {
  // Concrete→Abstract (implementation/design fulfills requirements)
  'implements': {
    allowedTargetLevels: ['L1'], // Implements requirements
    levelRule: 'source>target',
    propagation: 'forward', // A changes → B needs review
  },
  // Concrete→Abstract (design/implementation satisfies business/requirements)
  'satisfies': {
    allowedTargetLevels: ['L0', 'L1'], // Satisfies business/requirements
    levelRule: 'source>=target',
    propagation: 'backward', // B changes → A needs update
  },
  // Concrete→Abstract (refinement: requirements refine business, design refines requirements)
  'refines': {
    allowedTargetLevels: ['L0', 'L1'], // Refines business/requirements
    levelRule: 'source>target',
    propagation: 'backward', // B changes → A needs update
  },
  // Test→Requirements/Business (verification relationship)
  'verifies': {
    allowedTargetLevels: ['L0', 'L1'], // Verifies business/requirements
    levelRule: 'any',
    propagation: 'backward', // B changes → A needs update
  },
  // Dependencies (same level or concrete→abstract)
  'dependsOn': {
    levelRule: 'source>=target',
    propagation: 'backward', // B changes → A affected
  },
  // Usage relationship (no level constraint)
  'uses': {
    levelRule: 'any',
    propagation: 'backward', // B changes → A affected
  },
  // Inclusion relationship (same level only)
  'includes': {
    levelRule: 'same',
    propagation: 'backward', // B changes → A affected
  },
  // Bidirectional tracing
  'traces': {
    levelRule: 'any',
    propagation: 'both',
  },
  // Spec→Test (verification relationship: spec is verified by test code)
  'verifiedBy': {
    allowedTargetLevels: ['L2', 'L3'],
    levelRule: 'any',
    propagation: 'backward',
  },
  // General relation
  'relatedTo': {
    levelRule: 'any',
    propagation: 'both',
  },
};

// ============================================================================
// Relation Validation
// ============================================================================

/**
 * Relation validation result
 */
export interface RelationValidationResult {
  valid: boolean;
  errors: RelationValidationError[];
}

/**
 * Relation validation error
 */
export interface RelationValidationError {
  type: 'level_violation' | 'target_level_violation' | 'self_reference' | 'cycle_detected';
  message: string;
  relation: Relation;
  sourceId: string;
}

/**
 * Validate level constraint for single relation
 * 
 * @param sourceLevel - Source model level (set in _models/)
 * @param sourceSpecId - Source spec ID
 * @param relation - Relation
 * @param targetLevel - Target model level
 */
export function validateRelationLevel(
  sourceLevel: ModelLevel | undefined,
  sourceSpecId: string,
  relation: Relation,
  targetLevel: ModelLevel | undefined,
): RelationValidationError | null {
  // Self-reference check
  if (sourceSpecId === relation.target) {
    return {
      type: 'self_reference',
      message: `Self-reference is not allowed: ${sourceSpecId} → ${relation.target}`,
      relation,
      sourceId: sourceSpecId,
    };
  }

  // Skip if level is undefined
  if (!sourceLevel || !targetLevel) {
    return null;
  }
  
  const constraint = RELATION_CONSTRAINTS[relation.type];
  
  // Target level constraint check
  if (constraint.allowedTargetLevels && 
      !constraint.allowedTargetLevels.includes(targetLevel)) {
    return {
      type: 'target_level_violation',
      message: `'${relation.type}' relation target must be ${constraint.allowedTargetLevels.join(' or ')}, but target is ${targetLevel}`,
      relation,
      sourceId: sourceSpecId,
    };
  }
  
  // Level direction constraint check
  const srcIdx = getLevelIndex(sourceLevel);
  const tgtIdx = getLevelIndex(targetLevel);
  
  switch (constraint.levelRule) {
    case 'source>target':
      if (srcIdx <= tgtIdx) {
        return {
          type: 'level_violation',
          message: `'${relation.type}' requires source (${sourceLevel}) to be more concrete than target (${targetLevel})`,
          relation,
          sourceId: sourceSpecId,
        };
      }
      break;
    case 'source>=target':
      if (srcIdx < tgtIdx) {
        return {
          type: 'level_violation',
          message: `'${relation.type}' requires source (${sourceLevel}) to be same or more concrete than target (${targetLevel})`,
          relation,
          sourceId: sourceSpecId,
        };
      }
      break;
    case 'same':
      if (srcIdx !== tgtIdx) {
        return {
          type: 'level_violation',
          message: `'${relation.type}' requires source (${sourceLevel}) and target (${targetLevel}) to be same level`,
          relation,
          sourceId: sourceSpecId,
        };
      }
      break;
  }
  
  return null;
}

/**
 * Detect circular references
 */
export function detectCycles(
  relations: Array<{ sourceId: string; targetId: string; type: RelationType }>,
): RelationValidationError[] {
  const errors: RelationValidationError[] = [];
  const graph = new Map<string, Set<string>>();
  const relationMap = new Map<string, Relation>();
  
  // Build graph
  for (const rel of relations) {
    if (!graph.has(rel.sourceId)) {
      graph.set(rel.sourceId, new Set());
    }
    graph.get(rel.sourceId)!.add(rel.targetId);
    relationMap.set(`${rel.sourceId}→${rel.targetId}`, { type: rel.type, target: rel.targetId });
  }
  
  // Detect cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cyclePath: string[] = [];
  
  function dfs(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);
    cyclePath.push(node);
    
    const neighbors = graph.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Cycle detected
          const cycleStart = cyclePath.indexOf(neighbor);
          const cycle = cyclePath.slice(cycleStart);
          cycle.push(neighbor); // Close the cycle
          
          errors.push({
            type: 'cycle_detected',
            message: `Circular reference detected: ${cycle.join(' → ')}`,
            relation: relationMap.get(`${node}→${neighbor}`)!,
            sourceId: node,
          });
          return true;
        }
      }
    }
    
    cyclePath.pop();
    recursionStack.delete(node);
    return false;
  }
  
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  
  return errors;
}

/**
 * Infer model ID from spec ID (prefix-based)
 */
export function inferModelIdFromSpecId(specId: string): string | undefined {
  const prefixMap: Record<string, string> = {
    'REQ': 'requirement',
    'CR': 'constraint',
    'UC': 'usecase',
    'ACTOR': 'actor',
    'TERM': 'term',
    'COMP': 'component',
    'ENT': 'entity',
    'FLOW': 'process-flow',
    'LAYER': 'layer',
    'BND': 'boundary',
    'SCR': 'screen',
    'API': 'api-ref',
    'TBL': 'table-ref',
    'IAC': 'iac-ref',
    'BATCH': 'batch-ref',
  };
  
  for (const [prefix, modelId] of Object.entries(prefixMap)) {
    if (specId.startsWith(prefix + '-')) {
      return modelId;
    }
  }
  
  return undefined;
}
