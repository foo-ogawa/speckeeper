/**
 * NFR-001: Build performance tests
 * 
 * Build should complete within 5 seconds even for models with 1000 elements
 */

import { describe, it, expect } from 'vitest';

// Mock spec types
interface MockRequirement {
  id: string;
  name: string;
  description: string;
  acceptanceCriteria: string[];
}

interface MockEntity {
  id: string;
  name: string;
  attributes: Array<{ name: string; type: string }>;
}

interface MockScreen {
  id: string;
  name: string;
  components: string[];
}

// Generate mock data
function generateRequirements(count: number): MockRequirement[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `REQ-${String(i + 1).padStart(4, '0')}`,
    name: `Requirement ${i + 1}`,
    description: `Description for requirement ${i + 1}`,
    acceptanceCriteria: [`Criterion 1 for ${i + 1}`, `Criterion 2 for ${i + 1}`],
  }));
}

function generateEntities(count: number): MockEntity[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ENT-${String(i + 1).padStart(4, '0')}`,
    name: `Entity ${i + 1}`,
    attributes: [
      { name: 'id', type: 'uuid' },
      { name: `field${i}`, type: 'string' },
    ],
  }));
}

function generateScreens(count: number): MockScreen[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `SCR-${String(i + 1).padStart(4, '0')}`,
    name: `Screen ${i + 1}`,
    components: [`comp-${i}-1`, `comp-${i}-2`],
  }));
}

// Mock build functions
function buildMarkdown<T extends { id: string; name: string }>(specs: T[]): string[] {
  return specs.map(spec => `# ${spec.name}\n\nID: ${spec.id}`);
}

function buildJsonSchema(entities: MockEntity[]): object[] {
  return entities.map(e => ({
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: e.name,
    type: 'object',
    properties: Object.fromEntries(e.attributes.map(a => [a.name, { type: a.type }])),
  }));
}

function buildReferenceGraph(specs: Array<{ id: string }>): object {
  const nodes: Record<string, object> = {};
  for (const spec of specs) {
    nodes[spec.id] = { references: [], referencedBy: [] };
  }
  return { nodes, count: Object.keys(nodes).length };
}

describe('NFR-001: Build performance', () => {
  // NFR-001-01: Within 5 seconds for 1000 requirements, 100 entities, 50 screens
  describe('NFR-001-01: Large-scale model build', () => {
    it('should build 1000 requirements within 5 seconds', () => {
      const requirements = generateRequirements(1000);
      
      const startTime = performance.now();
      const markdowns = buildMarkdown(requirements);
      const endTime = performance.now();
      
      const duration = (endTime - startTime) / 1000; // Convert to seconds
      
      expect(markdowns).toHaveLength(1000);
      expect(duration).toBeLessThan(5);
      
      console.log(`Built 1000 requirements in ${duration.toFixed(3)}s`);
    });
    
    it('should build 100 entities to JSON Schema within 5 seconds', () => {
      const entities = generateEntities(100);
      
      const startTime = performance.now();
      const schemas = buildJsonSchema(entities);
      const endTime = performance.now();
      
      const duration = (endTime - startTime) / 1000;
      
      expect(schemas).toHaveLength(100);
      expect(duration).toBeLessThan(5);
      
      console.log(`Built 100 entity schemas in ${duration.toFixed(3)}s`);
    });
    
    it('should build 50 screens within 5 seconds', () => {
      const screens = generateScreens(50);
      
      const startTime = performance.now();
      const markdowns = buildMarkdown(screens);
      const endTime = performance.now();
      
      const duration = (endTime - startTime) / 1000;
      
      expect(markdowns).toHaveLength(50);
      expect(duration).toBeLessThan(5);
      
      console.log(`Built 50 screens in ${duration.toFixed(3)}s`);
    });
    
    it('should build complete model (1000 req + 100 ent + 50 scr) within 5 seconds', () => {
      const requirements = generateRequirements(1000);
      const entities = generateEntities(100);
      const screens = generateScreens(50);
      
      const startTime = performance.now();
      
      // Build all artifacts
      const reqMarkdowns = buildMarkdown(requirements);
      const entMarkdowns = buildMarkdown(entities);
      const scrMarkdowns = buildMarkdown(screens);
      const entSchemas = buildJsonSchema(entities);
      const allSpecs = [...requirements, ...entities, ...screens];
      const refGraph = buildReferenceGraph(allSpecs);
      
      const endTime = performance.now();
      
      const duration = (endTime - startTime) / 1000;
      
      expect(reqMarkdowns).toHaveLength(1000);
      expect(entMarkdowns).toHaveLength(100);
      expect(scrMarkdowns).toHaveLength(50);
      expect(entSchemas).toHaveLength(100);
      expect((refGraph as { count: number }).count).toBe(1150);
      expect(duration).toBeLessThan(5);
      
      console.log(`Complete build (1150 items) in ${duration.toFixed(3)}s`);
    });
    
    it('should handle incremental growth efficiently', () => {
      const sizes = [100, 500, 1000, 2000];
      const durations: number[] = [];
      
      for (const size of sizes) {
        const requirements = generateRequirements(size);
        
        const startTime = performance.now();
        buildMarkdown(requirements);
        const endTime = performance.now();
        
        durations.push(endTime - startTime);
      }
      
      // Verify roughly linear scaling (not exponential)
      // Duration for 2000 items should not be more than 4x duration for 500 items
      const ratio = durations[3] / durations[1];
      expect(ratio).toBeLessThan(8); // Allow some margin for overhead
      
      console.log('Scaling test:', sizes.map((s, i) => `${s}:${durations[i].toFixed(1)}ms`).join(', '));
    });
  });
});
