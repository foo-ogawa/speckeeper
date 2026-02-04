/**
 * FR-700/701: Change impact analysis tests
 * 
 * Can analyze and list impact scope when IDs are changed
 */

import { describe, it, expect } from 'vitest';

// Model levels
type ModelLevel = 'L0' | 'L1' | 'L2' | 'L3';

// Relation types
type RelationType = 
  | 'implements'
  | 'satisfies'
  | 'refines'
  | 'verifies'
  | 'dependsOn'
  | 'uses'
  | 'includes'
  | 'traces'
  | 'relatedTo';

// Relation definition
interface Relation {
  type: RelationType;
  target: string;
  description?: string;
}

// Model spec with relations
interface Spec {
  id: string;
  name: string;
  level: ModelLevel;
  relations?: Relation[];
}

// Level constraints for relations
const LEVEL_CONSTRAINTS: Record<RelationType, {
  sourceLevels: ModelLevel[];
  targetLevels: ModelLevel[];
  constraint: 'greater' | 'greaterOrEqual' | 'equal' | 'any';
}> = {
  implements: { sourceLevels: ['L2', 'L3'], targetLevels: ['L1'], constraint: 'greater' },
  satisfies: { sourceLevels: ['L1', 'L2', 'L3'], targetLevels: ['L0', 'L1'], constraint: 'greaterOrEqual' },
  refines: { sourceLevels: ['L1', 'L2', 'L3'], targetLevels: ['L0', 'L1'], constraint: 'greater' },
  verifies: { sourceLevels: ['L0', 'L1', 'L2', 'L3'], targetLevels: ['L0', 'L1'], constraint: 'any' },
  dependsOn: { sourceLevels: ['L0', 'L1', 'L2', 'L3'], targetLevels: ['L0', 'L1', 'L2', 'L3'], constraint: 'greaterOrEqual' },
  uses: { sourceLevels: ['L0', 'L1', 'L2', 'L3'], targetLevels: ['L0', 'L1', 'L2', 'L3'], constraint: 'any' },
  includes: { sourceLevels: ['L0', 'L1', 'L2', 'L3'], targetLevels: ['L0', 'L1', 'L2', 'L3'], constraint: 'equal' },
  traces: { sourceLevels: ['L0', 'L1', 'L2', 'L3'], targetLevels: ['L0', 'L1', 'L2', 'L3'], constraint: 'any' },
  relatedTo: { sourceLevels: ['L0', 'L1', 'L2', 'L3'], targetLevels: ['L0', 'L1', 'L2', 'L3'], constraint: 'any' },
};

// Level comparison
const LEVEL_ORDER: Record<ModelLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };

function compareLevels(a: ModelLevel, b: ModelLevel): number {
  return LEVEL_ORDER[a] - LEVEL_ORDER[b];
}

// Validate relation level constraint
function validateRelationLevel(
  sourceLevel: ModelLevel,
  targetLevel: ModelLevel,
  relationType: RelationType
): { valid: boolean; error?: string } {
  const constraint = LEVEL_CONSTRAINTS[relationType];
  
  if (!constraint.sourceLevels.includes(sourceLevel)) {
    return { valid: false, error: `${relationType} not allowed from ${sourceLevel}` };
  }
  
  if (!constraint.targetLevels.includes(targetLevel)) {
    return { valid: false, error: `${relationType} not allowed to ${targetLevel}` };
  }
  
  const cmp = compareLevels(sourceLevel, targetLevel);
  
  switch (constraint.constraint) {
    case 'greater':
      if (cmp <= 0) return { valid: false, error: `${relationType} requires source level > target level` };
      break;
    case 'greaterOrEqual':
      if (cmp < 0) return { valid: false, error: `${relationType} requires source level >= target level` };
      break;
    case 'equal':
      if (cmp !== 0) return { valid: false, error: `${relationType} requires same level` };
      break;
    case 'any':
      // No constraint
      break;
  }
  
  return { valid: true };
}

// Build dependency graph
function buildDependencyGraph(specs: Spec[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  
  for (const spec of specs) {
    if (!graph.has(spec.id)) {
      graph.set(spec.id, new Set());
    }
    
    for (const rel of spec.relations || []) {
      graph.get(spec.id)!.add(rel.target);
    }
  }
  
  return graph;
}

// Build reverse dependency graph (who references me)
function buildReverseDependencyGraph(specs: Spec[]): Map<string, Set<string>> {
  const reverseGraph = new Map<string, Set<string>>();
  
  for (const spec of specs) {
    if (!reverseGraph.has(spec.id)) {
      reverseGraph.set(spec.id, new Set());
    }
    
    for (const rel of spec.relations || []) {
      if (!reverseGraph.has(rel.target)) {
        reverseGraph.set(rel.target, new Set());
      }
      reverseGraph.get(rel.target)!.add(spec.id);
    }
  }
  
  return reverseGraph;
}

// Detect circular dependencies
function detectCircularDependencies(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];
  
  function dfs(node: string): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);
    
    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        cycle.push(neighbor); // Complete the cycle
        cycles.push(cycle);
      }
    }
    
    path.pop();
    recursionStack.delete(node);
  }
  
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  
  return cycles;
}

// Impact analysis
interface ImpactResult {
  targetId: string;
  directDependents: string[];
  transitiveDependents: string[];
  impactedComponents: string[];
  impactedDocs: string[];
  impactedSpecs: string[];
}

function analyzeImpact(
  targetId: string,
  specs: Spec[],
  depth: number = Infinity
): ImpactResult {
  const _specMap = new Map(specs.map(s => [s.id, s]));
  const reverseGraph = buildReverseDependencyGraph(specs);
  
  const directDependents: string[] = Array.from(reverseGraph.get(targetId) || []);
  const transitiveDependents = new Set<string>();
  const visited = new Set<string>();
  
  function traverse(id: string, currentDepth: number): void {
    if (currentDepth >= depth || visited.has(id)) return;
    visited.add(id);
    
    const dependents = reverseGraph.get(id) || new Set();
    for (const dep of dependents) {
      transitiveDependents.add(dep);
      traverse(dep, currentDepth + 1);
    }
  }
  
  traverse(targetId, 0);
  
  // Categorize impacted items
  const allImpacted = Array.from(transitiveDependents);
  const impactedComponents = allImpacted.filter(id => id.startsWith('COMP-'));
  const impactedDocs = allImpacted.filter(id => 
    id.startsWith('FR-') || id.startsWith('NFR-') || id.startsWith('UC-')
  );
  const impactedSpecs = allImpacted.filter(id => 
    id.startsWith('SCR-') || id.startsWith('API-') || id.startsWith('TBL-')
  );
  
  return {
    targetId,
    directDependents,
    transitiveDependents: allImpacted,
    impactedComponents,
    impactedDocs,
    impactedSpecs,
  };
}

// Mermaid diagram generation
function generateImpactMermaid(result: ImpactResult): string {
  const lines = ['flowchart LR'];
  
  lines.push(`  ${result.targetId}[("${result.targetId}")]`);
  
  for (const dep of result.directDependents) {
    lines.push(`  ${dep} --> ${result.targetId}`);
  }
  
  return lines.join('\n');
}

describe('FR-700: Change impact analysis', () => {
  // FR-700-01: Analyze and list impact scope with speckeeper impact {ID}
  describe('FR-700-01: Impact scope analysis', () => {
    it('should analyze direct dependents', () => {
      const specs: Spec[] = [
        { id: 'FR-100', name: 'Requirement', level: 'L1', relations: [] },
        { id: 'COMP-A', name: 'Component A', level: 'L2', relations: [{ type: 'implements', target: 'FR-100' }] },
        { id: 'COMP-B', name: 'Component B', level: 'L2', relations: [{ type: 'implements', target: 'FR-100' }] },
      ];
      
      const result = analyzeImpact('FR-100', specs);
      
      expect(result.directDependents).toContain('COMP-A');
      expect(result.directDependents).toContain('COMP-B');
    });
    
    it('should analyze transitive dependents', () => {
      const specs: Spec[] = [
        { id: 'FR-100', name: 'Requirement', level: 'L1', relations: [] },
        { id: 'COMP-A', name: 'Component', level: 'L2', relations: [{ type: 'implements', target: 'FR-100' }] },
        { id: 'SCR-001', name: 'Screen', level: 'L3', relations: [{ type: 'dependsOn', target: 'COMP-A' }] },
      ];
      
      const result = analyzeImpact('FR-100', specs);
      
      expect(result.transitiveDependents).toContain('COMP-A');
      expect(result.transitiveDependents).toContain('SCR-001');
    });
    
    it('should return empty for orphan ID', () => {
      const specs: Spec[] = [
        { id: 'FR-ORPHAN', name: 'Orphan', level: 'L1', relations: [] },
      ];
      
      const result = analyzeImpact('FR-ORPHAN', specs);
      
      expect(result.directDependents).toHaveLength(0);
      expect(result.transitiveDependents).toHaveLength(0);
    });
  });
  
  // FR-700-02: Define relations between models and track dependencies
  describe('FR-700-02: Relation tracking', () => {
    it('should build dependency graph from relations', () => {
      const specs: Spec[] = [
        { id: 'A', name: 'A', level: 'L1', relations: [{ type: 'dependsOn', target: 'B' }] },
        { id: 'B', name: 'B', level: 'L1', relations: [{ type: 'dependsOn', target: 'C' }] },
        { id: 'C', name: 'C', level: 'L1', relations: [] },
      ];
      
      const graph = buildDependencyGraph(specs);
      
      expect(graph.get('A')?.has('B')).toBe(true);
      expect(graph.get('B')?.has('C')).toBe(true);
      expect(graph.get('C')?.size).toBe(0);
    });
    
    it('should build reverse dependency graph', () => {
      const specs: Spec[] = [
        { id: 'A', name: 'A', level: 'L1', relations: [{ type: 'dependsOn', target: 'B' }] },
        { id: 'B', name: 'B', level: 'L1', relations: [] },
      ];
      
      const reverseGraph = buildReverseDependencyGraph(specs);
      
      expect(reverseGraph.get('B')?.has('A')).toBe(true);
    });
  });
  
  // FR-700-03: Can specify reference depth (--depth)
  describe('FR-700-03: Reference depth', () => {
    it('should limit analysis by depth', () => {
      const specs: Spec[] = [
        { id: 'L0', name: 'Level 0', level: 'L1', relations: [] },
        { id: 'L1', name: 'Level 1', level: 'L1', relations: [{ type: 'dependsOn', target: 'L0' }] },
        { id: 'L2', name: 'Level 2', level: 'L1', relations: [{ type: 'dependsOn', target: 'L1' }] },
        { id: 'L3', name: 'Level 3', level: 'L1', relations: [{ type: 'dependsOn', target: 'L2' }] },
      ];
      
      const resultDepth1 = analyzeImpact('L0', specs, 1);
      const resultDepth2 = analyzeImpact('L0', specs, 2);
      const resultUnlimited = analyzeImpact('L0', specs);
      
      expect(resultDepth1.transitiveDependents).toContain('L1');
      expect(resultDepth1.transitiveDependents).not.toContain('L2');
      
      expect(resultDepth2.transitiveDependents).toContain('L1');
      expect(resultDepth2.transitiveDependents).toContain('L2');
      expect(resultDepth2.transitiveDependents).not.toContain('L3');
      
      expect(resultUnlimited.transitiveDependents).toHaveLength(3);
    });
  });
  
  // FR-700-04: Display affected specs, components, and documents
  describe('FR-700-04: Impact category classification', () => {
    it('should categorize impacted items', () => {
      const specs: Spec[] = [
        { id: 'FR-100', name: 'Requirement', level: 'L1', relations: [] },
        { id: 'COMP-API', name: 'API Component', level: 'L2', relations: [{ type: 'implements', target: 'FR-100' }] },
        { id: 'SCR-001', name: 'Screen', level: 'L3', relations: [{ type: 'dependsOn', target: 'COMP-API' }] },
        { id: 'API-001', name: 'API Ref', level: 'L3', relations: [{ type: 'uses', target: 'COMP-API' }] },
      ];
      
      const result = analyzeImpact('FR-100', specs);
      
      expect(result.impactedComponents).toContain('COMP-API');
      expect(result.impactedSpecs).toContain('SCR-001');
      expect(result.impactedSpecs).toContain('API-001');
    });
    
    it('should generate Mermaid diagram', () => {
      const result: ImpactResult = {
        targetId: 'FR-100',
        directDependents: ['COMP-A', 'COMP-B'],
        transitiveDependents: ['COMP-A', 'COMP-B', 'SCR-001'],
        impactedComponents: ['COMP-A', 'COMP-B'],
        impactedDocs: [],
        impactedSpecs: ['SCR-001'],
      };
      
      const mermaid = generateImpactMermaid(result);
      
      expect(mermaid).toContain('flowchart LR');
      expect(mermaid).toContain('FR-100');
      expect(mermaid).toContain('COMP-A --> FR-100');
    });
  });
});

describe('FR-701: Inter-model relations', () => {
  // FR-701-01: Can define relations via relations property in model definition
  describe('FR-701-01: relations property', () => {
    it('should allow defining relations on model spec', () => {
      const spec: Spec = {
        id: 'FR-101',
        name: 'ID Management',
        level: 'L1',
        relations: [
          { type: 'satisfies', target: 'UC-001', description: 'Satisfies use case' },
          { type: 'refines', target: 'FR-100', description: 'Refines parent requirement' },
        ],
      };
      
      expect(spec.relations).toHaveLength(2);
      expect(spec.relations![0].type).toBe('satisfies');
      expect(spec.relations![1].type).toBe('refines');
    });
  });
  
  // FR-701-02: Provides standard relation types (review, not test)
  
  // FR-701-03: Relations are used as input for impact analysis
  describe('FR-701-03: Impact analysis input', () => {
    it('should use relations for impact analysis', () => {
      const specs: Spec[] = [
        { id: 'UC-001', name: 'Use Case', level: 'L0', relations: [] },
        { id: 'FR-100', name: 'Requirement', level: 'L1', relations: [{ type: 'satisfies', target: 'UC-001' }] },
        { id: 'COMP-A', name: 'Component', level: 'L2', relations: [{ type: 'implements', target: 'FR-100' }] },
      ];
      
      const result = analyzeImpact('UC-001', specs);
      
      expect(result.transitiveDependents).toContain('FR-100');
      expect(result.transitiveDependents).toContain('COMP-A');
    });
  });
  
  // FR-701-04: Define source/target model level constraints for each relation type
  describe('FR-701-04: Level constraints', () => {
    it('should validate implements: L2/L3 -> L1', () => {
      expect(validateRelationLevel('L2', 'L1', 'implements').valid).toBe(true);
      expect(validateRelationLevel('L3', 'L1', 'implements').valid).toBe(true);
      expect(validateRelationLevel('L1', 'L1', 'implements').valid).toBe(false); // Same level
      expect(validateRelationLevel('L0', 'L1', 'implements').valid).toBe(false); // L0 source not allowed
    });
    
    it('should validate satisfies: L1/L2/L3 -> L0/L1', () => {
      expect(validateRelationLevel('L1', 'L0', 'satisfies').valid).toBe(true);
      expect(validateRelationLevel('L2', 'L1', 'satisfies').valid).toBe(true);
      expect(validateRelationLevel('L3', 'L0', 'satisfies').valid).toBe(true);
      expect(validateRelationLevel('L0', 'L0', 'satisfies').valid).toBe(false); // L0 source not allowed
    });
    
    it('should validate refines: requires source level > target level', () => {
      expect(validateRelationLevel('L1', 'L0', 'refines').valid).toBe(true);
      expect(validateRelationLevel('L2', 'L1', 'refines').valid).toBe(true);
      expect(validateRelationLevel('L1', 'L1', 'refines').valid).toBe(false); // Same level
    });
    
    it('should validate includes: requires same level', () => {
      expect(validateRelationLevel('L1', 'L1', 'includes').valid).toBe(true);
      expect(validateRelationLevel('L2', 'L2', 'includes').valid).toBe(true);
      expect(validateRelationLevel('L1', 'L2', 'includes').valid).toBe(false); // Different levels
    });
    
    it('should allow any level for uses/traces/relatedTo', () => {
      expect(validateRelationLevel('L0', 'L3', 'uses').valid).toBe(true);
      expect(validateRelationLevel('L3', 'L0', 'traces').valid).toBe(true);
      expect(validateRelationLevel('L1', 'L2', 'relatedTo').valid).toBe(true);
    });
    
    it('should validate dependsOn: source level >= target level', () => {
      expect(validateRelationLevel('L2', 'L1', 'dependsOn').valid).toBe(true);
      expect(validateRelationLevel('L2', 'L2', 'dependsOn').valid).toBe(true);
      expect(validateRelationLevel('L1', 'L2', 'dependsOn').valid).toBe(false); // source < target
    });
  });
  
  // FR-701-05: Can detect level violations and circular references via lint
  describe('FR-701-05: Violation detection', () => {
    it('should detect circular dependencies', () => {
      const specs: Spec[] = [
        { id: 'A', name: 'A', level: 'L1', relations: [{ type: 'dependsOn', target: 'B' }] },
        { id: 'B', name: 'B', level: 'L1', relations: [{ type: 'dependsOn', target: 'C' }] },
        { id: 'C', name: 'C', level: 'L1', relations: [{ type: 'dependsOn', target: 'A' }] }, // Cycle!
      ];
      
      const graph = buildDependencyGraph(specs);
      const cycles = detectCircularDependencies(graph);
      
      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0]).toContain('A');
      expect(cycles[0]).toContain('B');
      expect(cycles[0]).toContain('C');
    });
    
    it('should not report false positives for DAG', () => {
      const specs: Spec[] = [
        { id: 'A', name: 'A', level: 'L1', relations: [{ type: 'dependsOn', target: 'B' }, { type: 'dependsOn', target: 'C' }] },
        { id: 'B', name: 'B', level: 'L1', relations: [{ type: 'dependsOn', target: 'C' }] },
        { id: 'C', name: 'C', level: 'L1', relations: [] },
      ];
      
      const graph = buildDependencyGraph(specs);
      const cycles = detectCircularDependencies(graph);
      
      expect(cycles).toHaveLength(0);
    });
    
    it('should detect level violations', () => {
      // implements from L1 to L1 (should be L2/L3 -> L1)
      const result = validateRelationLevel('L1', 'L1', 'implements');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      // Error could be about source level not allowed or level constraint
      expect(result.error!.includes('not allowed') || result.error!.includes('level')).toBe(true);
    });
    
    it('should detect self-references', () => {
      const specs: Spec[] = [
        { id: 'A', name: 'A', level: 'L1', relations: [{ type: 'dependsOn', target: 'A' }] }, // Self-reference
      ];
      
      const graph = buildDependencyGraph(specs);
      const cycles = detectCircularDependencies(graph);
      
      expect(cycles.length).toBeGreaterThan(0);
    });
  });
});
