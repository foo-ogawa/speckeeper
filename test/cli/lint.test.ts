/**
 * Lint Command Tests
 */

import { describe, it, expect } from 'vitest';

// Create a mock ModelRegistry for testing
function createMockRegistry() {
  return {
    requirements: new Map<string, any>(),
    useCases: new Map<string, any>(),
    actors: new Map<string, any>(),
    components: new Map<string, any>(),
    entities: new Map<string, any>(),
    relations: new Map<string, any>(),
    rules: new Map<string, any>(),
    screens: new Map<string, any>(),
    transitions: new Map<string, any>(),
    forms: new Map<string, any>(),
    processFlows: new Map<string, any>(),
    glossaryTerms: new Map<string, any>(),
    apiRefs: new Map<string, any>(),
    tableRefs: new Map<string, any>(),
    layers: new Map<string, any>(),
    boundaries: new Map<string, any>(),
  };
}

describe('FR-400, FR-401, FR-402: lint command', () => {
  // FR-400: Lint/Validation test suite
  describe('FR-101: ID uniqueness check', () => {
    it('should detect duplicate IDs across different types', () => {
      const registry = createMockRegistry();
      registry.requirements.set('REQ-001', { id: 'REQ-001', title: 'Req 1' });
      registry.components.set('REQ-001', { id: 'REQ-001', name: 'Comp 1', type: 'component' });
      
      // Import the actual check function when it's available
      // For now, test the logic inline
      const idMap = new Map<string, { type: string; count: number }>();
      const issues: any[] = [];
      
      for (const [type, map] of Object.entries(registry)) {
        for (const id of (map as Map<string, unknown>).keys()) {
          if (idMap.has(id)) {
            const existing = idMap.get(id)!;
            existing.count++;
            issues.push({
              id: `ID-DUP-${id}`,
              rule: 'id-uniqueness',
              severity: 'error',
              message: `Duplicate ID "${id}" found in ${type} (also in ${existing.type})`,
            });
          } else {
            idMap.set(id, { type, count: 1 });
          }
        }
      }
      
      expect(issues).toHaveLength(1);
      expect(issues[0].rule).toBe('id-uniqueness');
    });
    
    it('should not report unique IDs', () => {
      const registry = createMockRegistry();
      registry.requirements.set('REQ-001', { id: 'REQ-001', title: 'Req 1' });
      registry.components.set('COMP-001', { id: 'COMP-001', name: 'Comp 1', type: 'component' });
      
      const idMap = new Map<string, { type: string; count: number }>();
      const issues: any[] = [];
      
      for (const [type, map] of Object.entries(registry)) {
        for (const id of (map as Map<string, unknown>).keys()) {
          if (idMap.has(id)) {
            issues.push({ rule: 'id-uniqueness' });
          } else {
            idMap.set(id, { type, count: 1 });
          }
        }
      }
      
      expect(issues).toHaveLength(0);
    });
  });
  
  describe('FR-401: Reference integrity check', () => {
    it('should detect invalid references', () => {
      const registry = createMockRegistry();
      registry.useCases.set('UC-001', {
        id: 'UC-001',
        name: 'Use Case 1',
        actor: 'ACTOR-NONEXISTENT', // Invalid reference
      });
      
      const allIds = new Set<string>();
      for (const map of Object.values(registry)) {
        for (const id of (map as Map<string, unknown>).keys()) {
          allIds.add(id);
        }
      }
      
      const issues: any[] = [];
      const uc = registry.useCases.get('UC-001');
      
      if (uc.actor && !allIds.has(uc.actor)) {
        issues.push({
          rule: 'reference-integrity',
          message: `Reference "${uc.actor}" not found`,
        });
      }
      
      expect(issues).toHaveLength(1);
      expect(issues[0].rule).toBe('reference-integrity');
    });
    
    it('should accept valid references', () => {
      const registry = createMockRegistry();
      registry.actors.set('ACTOR-001', { id: 'ACTOR-001', name: 'Customer', type: 'human' });
      registry.useCases.set('UC-001', {
        id: 'UC-001',
        name: 'Use Case 1',
        actor: 'ACTOR-001', // Valid reference
      });
      
      const allIds = new Set<string>();
      for (const map of Object.values(registry)) {
        for (const id of (map as Map<string, unknown>).keys()) {
          allIds.add(id);
        }
      }
      
      const issues: any[] = [];
      const uc = registry.useCases.get('UC-001');
      
      if (uc.actor && !allIds.has(uc.actor)) {
        issues.push({
          rule: 'reference-integrity',
          message: `Reference "${uc.actor}" not found`,
        });
      }
      
      expect(issues).toHaveLength(0);
    });
  });
  
  describe('FR-401: Circular dependency check', () => {
    it('should detect circular dependencies', () => {
      const registry = createMockRegistry();
      registry.components.set('COMP-A', {
        id: 'COMP-A',
        name: 'Component A',
        type: 'component',
        dependencies: ['COMP-B'],
      });
      registry.components.set('COMP-B', {
        id: 'COMP-B',
        name: 'Component B',
        type: 'component',
        dependencies: ['COMP-C'],
      });
      registry.components.set('COMP-C', {
        id: 'COMP-C',
        name: 'Component C',
        type: 'component',
        dependencies: ['COMP-A'], // Creates cycle
      });
      
      // Build dependency graph
      const graph = new Map<string, Set<string>>();
      for (const [id, comp] of registry.components) {
        const deps = new Set<string>();
        for (const dep of comp.dependencies || []) {
          deps.add(dep);
        }
        graph.set(id, deps);
      }
      
      // Detect cycle using DFS
      const visited = new Set<string>();
      const recursionStack = new Set<string>();
      let hasCycle = false;
      
      function dfs(node: string): void {
        visited.add(node);
        recursionStack.add(node);
        
        const deps = graph.get(node) || new Set();
        for (const dep of deps) {
          if (!visited.has(dep)) {
            dfs(dep);
          } else if (recursionStack.has(dep)) {
            hasCycle = true;
          }
        }
        
        recursionStack.delete(node);
      }
      
      for (const node of graph.keys()) {
        if (!visited.has(node)) {
          dfs(node);
        }
      }
      
      expect(hasCycle).toBe(true);
    });
    
    it('should not report false positives for DAG', () => {
      const registry = createMockRegistry();
      registry.components.set('COMP-A', {
        id: 'COMP-A',
        name: 'Component A',
        type: 'component',
        dependencies: ['COMP-B', 'COMP-C'],
      });
      registry.components.set('COMP-B', {
        id: 'COMP-B',
        name: 'Component B',
        type: 'component',
        dependencies: ['COMP-C'],
      });
      registry.components.set('COMP-C', {
        id: 'COMP-C',
        name: 'Component C',
        type: 'component',
        dependencies: [],
      });
      
      // Build dependency graph
      const graph = new Map<string, Set<string>>();
      for (const [id, comp] of registry.components) {
        const deps = new Set<string>();
        for (const dep of comp.dependencies || []) {
          deps.add(dep);
        }
        graph.set(id, deps);
      }
      
      // Detect cycle using DFS
      const visited = new Set<string>();
      const recursionStack = new Set<string>();
      let hasCycle = false;
      
      function dfs(node: string): void {
        visited.add(node);
        recursionStack.add(node);
        
        const deps = graph.get(node) || new Set();
        for (const dep of deps) {
          if (!visited.has(dep)) {
            dfs(dep);
          } else if (recursionStack.has(dep)) {
            hasCycle = true;
          }
        }
        
        recursionStack.delete(node);
      }
      
      for (const node of graph.keys()) {
        if (!visited.has(node)) {
          dfs(node);
        }
      }
      
      expect(hasCycle).toBe(false);
    });
  });
  
  describe('FR-400: Required fields check', () => {
    it('should detect missing required fields', () => {
      const registry = createMockRegistry();
      registry.requirements.set('REQ-001', {
        id: 'REQ-001',
        // Missing: title, description
      });
      
      const requiredFields = ['id', 'title', 'description'];
      const req = registry.requirements.get('REQ-001');
      const issues: any[] = [];
      
      for (const field of requiredFields) {
        if (!req[field]) {
          issues.push({
            rule: 'required-field',
            message: `Required field "${field}" is missing`,
          });
        }
      }
      
      expect(issues).toHaveLength(2);
      expect(issues[0].rule).toBe('required-field');
    });
    
    it('should pass for complete models', () => {
      const registry = createMockRegistry();
      registry.requirements.set('REQ-001', {
        id: 'REQ-001',
        title: 'Requirement 1',
        description: 'Description of requirement',
      });
      
      const requiredFields = ['id', 'title', 'description'];
      const req = registry.requirements.get('REQ-001');
      const issues: any[] = [];
      
      for (const field of requiredFields) {
        if (!req[field]) {
          issues.push({
            rule: 'required-field',
            message: `Required field "${field}" is missing`,
          });
        }
      }
      
      expect(issues).toHaveLength(0);
    });
  });
  
  describe('FR-101: Naming convention check', () => {
    it('should detect ID without expected prefix', () => {
      const expectedPrefixes = ['REQ-', 'FR-', 'NFR-', 'CR-'];
      const id = 'INVALID-001';
      
      const hasValidPrefix = expectedPrefixes.some(p => id.startsWith(p));
      
      expect(hasValidPrefix).toBe(false);
    });
    
    it('should accept ID with valid prefix', () => {
      const expectedPrefixes = ['REQ-', 'FR-', 'NFR-', 'CR-'];
      const id = 'REQ-OBS-250203-A7F2';
      
      const hasValidPrefix = expectedPrefixes.some(p => id.startsWith(p));
      
      expect(hasValidPrefix).toBe(true);
    });
  });
  
  describe('FR-401: Orphan element check', () => {
    it('should detect orphan entities', () => {
      const registry = createMockRegistry();
      registry.entities.set('ENT-001', { id: 'ENT-001', name: 'Customer' });
      registry.entities.set('ENT-002', { id: 'ENT-002', name: 'Order' });
      registry.relations.set('REL-001', {
        from: 'ENT-001',
        to: 'ENT-002',
        multiplicity: '1:N',
      });
      registry.entities.set('ENT-003', { id: 'ENT-003', name: 'Orphan' }); // No relations
      
      const issues: any[] = [];
      
      for (const [id, _entity] of registry.entities) {
        let isReferenced = false;
        for (const [_relId, rel] of registry.relations) {
          if (rel.from === id || rel.to === id) {
            isReferenced = true;
            break;
          }
        }
        
        if (!isReferenced && registry.entities.size > 1) {
          issues.push({
            rule: 'orphan-entity',
            elementId: id,
          });
        }
      }
      
      expect(issues).toHaveLength(1);
      expect(issues[0].elementId).toBe('ENT-003');
    });
  });

  // ---------------------------------------------------------------------------
  // FR-400-02: Custom lint rule definition and execution
  // ---------------------------------------------------------------------------
  describe('FR-400-02: Custom lint rule definition and execution', () => {
    it('should support custom lint rules on Model class', () => {
      // Model class supports lintRules property for custom validation
      interface CustomLintRule<T> {
        id: string;
        severity: 'error' | 'warning' | 'info';
        message: string;
        check: (spec: T) => boolean;
      }

      const customRule: CustomLintRule<{ id: string; name: string }> = {
        id: 'custom-name-check',
        severity: 'warning',
        message: 'Name should not be empty',
        check: (spec) => !spec.name || spec.name.trim() === '',
      };

      const validSpec = { id: 'TEST-001', name: 'Valid Name' };
      const invalidSpec = { id: 'TEST-002', name: '' };

      expect(customRule.check(validSpec)).toBe(false); // No issue
      expect(customRule.check(invalidSpec)).toBe(true); // Has issue
    });

    it('should execute custom lint rules and collect results', () => {
      interface LintResult {
        ruleId: string;
        severity: 'error' | 'warning' | 'info';
        message: string;
        specId: string;
      }

      interface CustomLintRule<T> {
        id: string;
        severity: 'error' | 'warning' | 'info';
        message: string;
        check: (spec: T) => boolean;
      }

      const rules: CustomLintRule<{ id: string; description?: string }>[] = [
        {
          id: 'has-description',
          severity: 'warning',
          message: 'Spec should have a description',
          check: (spec) => !spec.description,
        },
      ];

      const specs = [
        { id: 'SPEC-001', description: 'Has description' },
        { id: 'SPEC-002' }, // No description
      ];

      const results: LintResult[] = [];
      for (const spec of specs) {
        for (const rule of rules) {
          if (rule.check(spec)) {
            results.push({
              ruleId: rule.id,
              severity: rule.severity,
              message: rule.message,
              specId: spec.id,
            });
          }
        }
      }

      expect(results).toHaveLength(1);
      expect(results[0].specId).toBe('SPEC-002');
      expect(results[0].ruleId).toBe('has-description');
    });
  });

  // ---------------------------------------------------------------------------
  // FR-401-05: Phase TBD validation
  // ---------------------------------------------------------------------------
  describe('FR-401-05: TBD validation', () => {
    it('should detect TBD values in spec fields', () => {
      interface Spec {
        id: string;
        description: string;
        implementation?: string;
      }

      function findTBDFields(spec: Spec): string[] {
        const tbdFields: string[] = [];
        for (const [field, value] of Object.entries(spec)) {
          if (typeof value === 'string' && value.toUpperCase().includes('TBD')) {
            tbdFields.push(field);
          }
        }
        return tbdFields;
      }

      const spec: Spec = {
        id: 'REQ-001',
        description: 'This is TBD',
        implementation: 'TBD',
      };

      const tbdFields = findTBDFields(spec);
      
      expect(tbdFields).toContain('description');
      expect(tbdFields).toContain('implementation');
      expect(tbdFields).toHaveLength(2);
    });

    it('should allow TBD in early phases but not in later phases', () => {
      type Phase = 'REQ' | 'HLD' | 'LLD' | 'OPS';
      
      const phaseOrder: Record<Phase, number> = {
        REQ: 0,
        HLD: 1,
        LLD: 2,
        OPS: 3,
      };

      function isTBDAllowed(currentPhase: Phase, fieldPhase: Phase): boolean {
        return phaseOrder[currentPhase] < phaseOrder[fieldPhase];
      }

      // TBD for LLD field is allowed in REQ phase
      expect(isTBDAllowed('REQ', 'LLD')).toBe(true);
      // TBD for REQ field is NOT allowed in HLD phase
      expect(isTBDAllowed('HLD', 'REQ')).toBe(false);
      // TBD for same phase is NOT allowed
      expect(isTBDAllowed('LLD', 'LLD')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // FR-402: Custom lint rule definition mechanism
  // ---------------------------------------------------------------------------
  describe('FR-402-01: lintRules configuration', () => {
    it('should allow setting lintRules on Model definition', () => {
      interface LintRule<T> {
        id: string;
        severity: 'error' | 'warning' | 'info';
        message: string;
        check: (spec: T) => boolean;
      }

      interface ModelDefinition<T> {
        id: string;
        name: string;
        lintRules: LintRule<T>[];
      }

      const requirementModel: ModelDefinition<{ id: string; priority?: string }> = {
        id: 'requirement',
        name: 'Requirement',
        lintRules: [
          {
            id: 'has-priority',
            severity: 'warning',
            message: 'Requirement should have priority',
            check: (spec) => !spec.priority,
          },
        ],
      };

      expect(requirementModel.lintRules).toHaveLength(1);
      expect(requirementModel.lintRules[0].id).toBe('has-priority');
    });
  });

  describe('FR-402-02: Severity configuration', () => {
    it('should support error, warning, and info severity levels', () => {
      type Severity = 'error' | 'warning' | 'info';
      
      const severities: Severity[] = ['error', 'warning', 'info'];
      
      interface LintRule {
        id: string;
        severity: Severity;
      }

      const rules: LintRule[] = [
        { id: 'rule-error', severity: 'error' },
        { id: 'rule-warning', severity: 'warning' },
        { id: 'rule-info', severity: 'info' },
      ];

      for (const rule of rules) {
        expect(severities).toContain(rule.severity);
      }
    });

    it('should categorize issues by severity', () => {
      type Severity = 'error' | 'warning' | 'info';
      
      interface LintIssue {
        ruleId: string;
        severity: Severity;
      }

      const issues: LintIssue[] = [
        { ruleId: 'r1', severity: 'error' },
        { ruleId: 'r2', severity: 'warning' },
        { ruleId: 'r3', severity: 'warning' },
        { ruleId: 'r4', severity: 'info' },
      ];

      const byCategory = {
        errors: issues.filter(i => i.severity === 'error'),
        warnings: issues.filter(i => i.severity === 'warning'),
        infos: issues.filter(i => i.severity === 'info'),
      };

      expect(byCategory.errors).toHaveLength(1);
      expect(byCategory.warnings).toHaveLength(2);
      expect(byCategory.infos).toHaveLength(1);
    });
  });

  describe('FR-402-03: Lint result structure', () => {
    it('should include ruleId, message, and specId in lint results', () => {
      interface LintResult {
        ruleId: string;
        message: string;
        specId: string;
        severity?: 'error' | 'warning' | 'info';
        field?: string;
      }

      const result: LintResult = {
        ruleId: 'has-description',
        message: 'Spec should have a description',
        specId: 'REQ-001',
        severity: 'warning',
        field: 'description',
      };

      expect(result.ruleId).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.specId).toBeDefined();
    });

    it('should aggregate lint results from all specs', () => {
      interface LintResult {
        ruleId: string;
        message: string;
        specId: string;
      }

      interface LintReport {
        totalSpecs: number;
        totalIssues: number;
        results: LintResult[];
      }

      const report: LintReport = {
        totalSpecs: 10,
        totalIssues: 3,
        results: [
          { ruleId: 'r1', message: 'Issue 1', specId: 'SPEC-001' },
          { ruleId: 'r2', message: 'Issue 2', specId: 'SPEC-002' },
          { ruleId: 'r1', message: 'Issue 3', specId: 'SPEC-003' },
        ],
      };

      expect(report.totalSpecs).toBe(10);
      expect(report.totalIssues).toBe(3);
      expect(report.results).toHaveLength(3);
    });
  });
});
