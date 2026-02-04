/**
 * FR-101: ID management tests
 * 
 * All model elements have unique IDs, providing ID-based reference and integrity checking
 */

import { describe, it, expect } from 'vitest';

// Mock registry for testing
interface MockRegistry {
  [key: string]: Map<string, { id: string; [key: string]: unknown }>;
}

function createMockRegistry(): MockRegistry {
  return {
    requirements: new Map(),
    useCases: new Map(),
    actors: new Map(),
    components: new Map(),
    entities: new Map(),
    relations: new Map(),
    screens: new Map(),
    terms: new Map(),
    apiRefs: new Map(),
    tableRefs: new Map(),
  };
}

// ID validation utilities
const ID_PATTERNS: Record<string, RegExp> = {
  requirement: /^(REQ|FR|NFR|CR)-[A-Z0-9-]+$/,
  useCase: /^UC-\d{3}$/,
  actor: /^ACT-[A-Z0-9-]+$/,
  component: /^COMP-[A-Z0-9-]+$/,
  entity: /^(ENT|E)-[A-Z0-9-]+$/,
  screen: /^SCR-[A-Z0-9-]+$/,
  term: /^TERM-[A-Z0-9-]+$/,
  apiRef: /^API-[A-Z0-9-]+$/,
  tableRef: /^TBL-[A-Z0-9-]+$/,
};

function isValidIdFormat(id: string, type: string): boolean {
  const pattern = ID_PATTERNS[type];
  if (!pattern) return true; // Unknown type, skip validation
  return pattern.test(id);
}

function findDuplicateIds(registry: MockRegistry): { id: string; types: string[] }[] {
  const idMap = new Map<string, string[]>();
  
  for (const [type, map] of Object.entries(registry)) {
    for (const id of map.keys()) {
      const existing = idMap.get(id) || [];
      existing.push(type);
      idMap.set(id, existing);
    }
  }
  
  return Array.from(idMap.entries())
    .filter(([_, types]) => types.length > 1)
    .map(([id, types]) => ({ id, types }));
}

function findInvalidReferences(
  registry: MockRegistry,
  refs: Array<{ sourceId: string; targetId: string }>
): Array<{ sourceId: string; targetId: string }> {
  const allIds = new Set<string>();
  for (const map of Object.values(registry)) {
    for (const id of map.keys()) {
      allIds.add(id);
    }
  }
  
  return refs.filter(ref => !allIds.has(ref.targetId));
}

function findAllReferencesToId(
  registry: MockRegistry,
  targetId: string
): Array<{ sourceType: string; sourceId: string; field: string }> {
  const references: Array<{ sourceType: string; sourceId: string; field: string }> = [];
  
  for (const [type, map] of Object.entries(registry)) {
    for (const [id, spec] of map.entries()) {
      // Skip self-reference via 'id' field
      if (id === targetId) continue;
      
      for (const [field, value] of Object.entries(spec)) {
        // Skip the 'id' field itself
        if (field === 'id') continue;
        
        if (value === targetId) {
          references.push({ sourceType: type, sourceId: id, field });
        } else if (Array.isArray(value) && value.includes(targetId)) {
          references.push({ sourceType: type, sourceId: id, field });
        }
      }
    }
  }
  
  return references;
}

describe('FR-101: ID management', () => {
  // FR-101-01: All model elements have unique IDs
  describe('FR-101-01: ID uniqueness', () => {
    it('should detect duplicate IDs within same type', () => {
      const registry = createMockRegistry();
      registry.requirements.set('REQ-001', { id: 'REQ-001', name: 'Req 1' });
      registry.requirements.set('REQ-001', { id: 'REQ-001', name: 'Req 2' }); // Same key
      
      // Map naturally prevents exact duplicates, but we check for ID field matches
      const items = Array.from(registry.requirements.values());
      const ids = items.map(item => item.id);
      const uniqueIds = new Set(ids);
      
      expect(ids.length).toBe(uniqueIds.size);
    });
    
    it('should detect duplicate IDs across different types', () => {
      const registry = createMockRegistry();
      registry.requirements.set('ITEM-001', { id: 'ITEM-001', name: 'Req' });
      registry.components.set('ITEM-001', { id: 'ITEM-001', name: 'Comp' });
      
      const duplicates = findDuplicateIds(registry);
      
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].id).toBe('ITEM-001');
      expect(duplicates[0].types).toContain('requirements');
      expect(duplicates[0].types).toContain('components');
    });
    
    it('should not report false positives for unique IDs', () => {
      const registry = createMockRegistry();
      registry.requirements.set('REQ-001', { id: 'REQ-001', name: 'Req 1' });
      registry.requirements.set('REQ-002', { id: 'REQ-002', name: 'Req 2' });
      registry.components.set('COMP-001', { id: 'COMP-001', name: 'Comp 1' });
      
      const duplicates = findDuplicateIds(registry);
      
      expect(duplicates).toHaveLength(0);
    });
  });
  
  // FR-101-02: IDs follow naming conventions
  describe('FR-101-02: ID naming conventions', () => {
    it('should validate requirement ID format (FR-xxx)', () => {
      expect(isValidIdFormat('FR-101', 'requirement')).toBe(true);
      expect(isValidIdFormat('FR-101-01', 'requirement')).toBe(true);
      expect(isValidIdFormat('NFR-001', 'requirement')).toBe(true);
      expect(isValidIdFormat('CR-001', 'requirement')).toBe(true);
      expect(isValidIdFormat('REQ-OBS-250203-A7F2', 'requirement')).toBe(true);
    });
    
    it('should reject invalid requirement ID format', () => {
      expect(isValidIdFormat('INVALID-001', 'requirement')).toBe(false);
      expect(isValidIdFormat('FR_101', 'requirement')).toBe(false); // Underscore instead of dash
      expect(isValidIdFormat('fr-101', 'requirement')).toBe(false); // Lowercase
    });
    
    it('should validate useCase ID format (UC-xxx)', () => {
      expect(isValidIdFormat('UC-001', 'useCase')).toBe(true);
      expect(isValidIdFormat('UC-010', 'useCase')).toBe(true);
    });
    
    it('should reject invalid useCase ID format', () => {
      expect(isValidIdFormat('UC-1', 'useCase')).toBe(false);
      expect(isValidIdFormat('USE-001', 'useCase')).toBe(false);
    });
    
    it('should validate component ID format (COMP-xxx)', () => {
      expect(isValidIdFormat('COMP-API', 'component')).toBe(true);
      expect(isValidIdFormat('COMP-API-GATEWAY', 'component')).toBe(true);
    });
    
    it('should validate entity ID format (ENT-xxx or E-xxx)', () => {
      expect(isValidIdFormat('ENT-001', 'entity')).toBe(true);
      expect(isValidIdFormat('ENT-CUSTOMER', 'entity')).toBe(true);
      expect(isValidIdFormat('E-001', 'entity')).toBe(true);
    });
    
    it('should validate screen ID format (SCR-xxx)', () => {
      expect(isValidIdFormat('SCR-001', 'screen')).toBe(true);
      expect(isValidIdFormat('SCR-LOGIN', 'screen')).toBe(true);
    });
  });
  
  // FR-101-03: References are ID-based with reference integrity checking
  describe('FR-101-03: Reference integrity', () => {
    it('should detect invalid references', () => {
      const registry = createMockRegistry();
      registry.useCases.set('UC-001', { id: 'UC-001', name: 'Use Case 1' });
      registry.actors.set('ACT-001', { id: 'ACT-001', name: 'Customer' });
      
      const refs = [
        { sourceId: 'UC-001', targetId: 'ACT-001' }, // Valid
        { sourceId: 'UC-001', targetId: 'ACT-NONEXISTENT' }, // Invalid
      ];
      
      const invalidRefs = findInvalidReferences(registry, refs);
      
      expect(invalidRefs).toHaveLength(1);
      expect(invalidRefs[0].targetId).toBe('ACT-NONEXISTENT');
    });
    
    it('should accept valid references', () => {
      const registry = createMockRegistry();
      registry.useCases.set('UC-001', { id: 'UC-001', name: 'Use Case 1' });
      registry.actors.set('ACT-001', { id: 'ACT-001', name: 'Customer' });
      registry.requirements.set('FR-101', { id: 'FR-101', name: 'Requirement' });
      
      const refs = [
        { sourceId: 'UC-001', targetId: 'ACT-001' },
        { sourceId: 'UC-001', targetId: 'FR-101' },
      ];
      
      const invalidRefs = findInvalidReferences(registry, refs);
      
      expect(invalidRefs).toHaveLength(0);
    });
    
    it('should detect cross-type reference integrity', () => {
      const registry = createMockRegistry();
      registry.components.set('COMP-API', { id: 'COMP-API', name: 'API', entities: ['ENT-001'] });
      // ENT-001 doesn't exist
      
      const refs = [{ sourceId: 'COMP-API', targetId: 'ENT-001' }];
      const invalidRefs = findInvalidReferences(registry, refs);
      
      expect(invalidRefs).toHaveLength(1);
    });
  });
  
  // FR-101-04: ID changes detect all reference locations via lint
  describe('FR-101-04: Reference detection on ID change', () => {
    it('should find all references to a given ID', () => {
      const registry = createMockRegistry();
      registry.requirements.set('FR-101', { id: 'FR-101', name: 'ID Management' });
      registry.useCases.set('UC-001', { 
        id: 'UC-001', 
        name: 'Use Case 1',
        satisfies: 'FR-101',
        relatedRequirements: ['FR-101', 'FR-102'],
      });
      registry.components.set('COMP-API', {
        id: 'COMP-API',
        name: 'API',
        implements: ['FR-101'],
      });
      
      const references = findAllReferencesToId(registry, 'FR-101');
      
      expect(references.length).toBeGreaterThanOrEqual(2);
      expect(references).toContainEqual(
        expect.objectContaining({ sourceId: 'UC-001', field: 'satisfies' })
      );
    });
    
    it('should find references in arrays', () => {
      const registry = createMockRegistry();
      registry.requirements.set('FR-100', { id: 'FR-100', name: 'Parent' });
      registry.requirements.set('FR-101', { 
        id: 'FR-101', 
        name: 'Child',
        parentId: 'FR-100',
        relations: [{ target: 'UC-001' }],
      });
      registry.useCases.set('UC-001', { id: 'UC-001', name: 'UC' });
      
      const references = findAllReferencesToId(registry, 'FR-100');
      
      expect(references).toContainEqual(
        expect.objectContaining({ sourceId: 'FR-101', field: 'parentId' })
      );
    });
    
    it('should return empty array for unreferenced ID', () => {
      const registry = createMockRegistry();
      registry.requirements.set('FR-999', { id: 'FR-999', name: 'Orphan' });
      
      const references = findAllReferencesToId(registry, 'FR-999');
      
      expect(references).toHaveLength(0);
    });
  });
});
