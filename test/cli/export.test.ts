/**
 * FR-800: Generated output export (optional) tests
 * 
 * Can output aggregated JSON for machine processing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';

const testDir = join(process.cwd(), '.test-export');

// Aggregated export types
interface ExportedSpec {
  id: string;
  type: string;
  name: string;
  [key: string]: unknown;
}

interface AggregatedExport {
  version: string;
  generated: string;
  stats: {
    totalItems: number;
    byType: Record<string, number>;
  };
  items: ExportedSpec[];
  references: Record<string, string[]>;
}

// Export generation
function generateAggregatedExport(specs: ExportedSpec[]): AggregatedExport {
  const byType: Record<string, number> = {};
  const references: Record<string, string[]> = {};
  
  for (const spec of specs) {
    byType[spec.type] = (byType[spec.type] || 0) + 1;
    
    // Extract references from spec
    references[spec.id] = [];
    for (const [_key, value] of Object.entries(spec)) {
      if (typeof value === 'string' && value.match(/^[A-Z]+-/)) {
        references[spec.id].push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.match(/^[A-Z]+-/)) {
            references[spec.id].push(item);
          }
        }
      }
    }
  }
  
  return {
    version: '1.0.0',
    generated: new Date().toISOString(),
    stats: {
      totalItems: specs.length,
      byType,
    },
    items: specs,
    references,
  };
}

// Export to file
function writeAggregatedExport(exportData: AggregatedExport, outputPath: string): void {
  writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
}

// Validate export
function validateExport(exportData: AggregatedExport): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!exportData.version) errors.push('Missing version');
  if (!exportData.generated) errors.push('Missing generated timestamp');
  if (!exportData.stats) errors.push('Missing stats');
  if (!exportData.items) errors.push('Missing items');
  if (!exportData.references) errors.push('Missing references');
  
  if (exportData.stats && exportData.items) {
    if (exportData.stats.totalItems !== exportData.items.length) {
      errors.push('Stats totalItems does not match items length');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

describe('FR-800: Generated output export', () => {
  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });
  
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });
  
  // FR-800-01: Can output aggregated JSON for machine processing (specs/index.json)
  describe('FR-800-01: Aggregated JSON output', () => {
    it('should generate aggregated export JSON', () => {
      const specs: ExportedSpec[] = [
        { id: 'FR-100', type: 'requirement', name: 'Common Requirements' },
        { id: 'FR-101', type: 'requirement', name: 'ID Management', parentId: 'FR-100' },
        { id: 'UC-001', type: 'useCase', name: 'Define Requirements' },
        { id: 'COMP-API', type: 'component', name: 'API Component' },
      ];
      
      const exportData = generateAggregatedExport(specs);
      
      expect(exportData.version).toBeDefined();
      expect(exportData.generated).toBeDefined();
      expect(exportData.stats.totalItems).toBe(4);
      expect(exportData.stats.byType.requirement).toBe(2);
      expect(exportData.stats.byType.useCase).toBe(1);
      expect(exportData.stats.byType.component).toBe(1);
    });
    
    it('should include all items in export', () => {
      const specs: ExportedSpec[] = [
        { id: 'A', type: 'type1', name: 'Item A' },
        { id: 'B', type: 'type2', name: 'Item B' },
      ];
      
      const exportData = generateAggregatedExport(specs);
      
      expect(exportData.items).toHaveLength(2);
      expect(exportData.items.find(i => i.id === 'A')).toBeDefined();
      expect(exportData.items.find(i => i.id === 'B')).toBeDefined();
    });
    
    it('should extract and include references', () => {
      const specs: ExportedSpec[] = [
        { id: 'FR-100', type: 'requirement', name: 'Parent' },
        { id: 'FR-101', type: 'requirement', name: 'Child', parentId: 'FR-100', satisfies: ['UC-001'] },
        { id: 'UC-001', type: 'useCase', name: 'Use Case' },
      ];
      
      const exportData = generateAggregatedExport(specs);
      
      expect(exportData.references['FR-101']).toContain('FR-100');
      expect(exportData.references['FR-101']).toContain('UC-001');
    });
    
    it('should write export to file', () => {
      const specs: ExportedSpec[] = [
        { id: 'TEST-001', type: 'test', name: 'Test Item' },
      ];
      
      const exportData = generateAggregatedExport(specs);
      const outputPath = join(testDir, 'specs', 'index.json');
      
      mkdirSync(join(testDir, 'specs'), { recursive: true });
      writeAggregatedExport(exportData, outputPath);
      
      expect(existsSync(outputPath)).toBe(true);
      
      const content = JSON.parse(readFileSync(outputPath, 'utf-8'));
      expect(content.version).toBeDefined();
      expect(content.items).toHaveLength(1);
    });
    
    it('should validate export structure', () => {
      const validExport: AggregatedExport = {
        version: '1.0.0',
        generated: new Date().toISOString(),
        stats: { totalItems: 1, byType: { test: 1 } },
        items: [{ id: 'TEST', type: 'test', name: 'Test' }],
        references: { TEST: [] },
      };
      
      const result = validateExport(validExport);
      
      expect(result.valid).toBe(true);
    });
    
    it('should detect invalid export structure', () => {
      const invalidExport = {
        version: '1.0.0',
        // Missing: generated, stats, items, references
      } as unknown as AggregatedExport;
      
      const result = validateExport(invalidExport);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should detect stats mismatch', () => {
      const mismatchedExport: AggregatedExport = {
        version: '1.0.0',
        generated: new Date().toISOString(),
        stats: { totalItems: 5, byType: {} }, // Says 5 items
        items: [{ id: 'A', type: 'a', name: 'A' }], // But only 1 item
        references: {},
      };
      
      const result = validateExport(mismatchedExport);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stats totalItems does not match items length');
    });
  });
  
  // FR-800-02: Can be used for future tool integration (review, limited test coverage)
  describe('FR-800-02: Tool integration', () => {
    it('should produce machine-readable JSON', () => {
      const specs: ExportedSpec[] = [
        { id: 'FR-100', type: 'requirement', name: 'Test', priority: 'must' },
      ];
      
      const exportData = generateAggregatedExport(specs);
      const json = JSON.stringify(exportData);
      
      // Verify it can be parsed back
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(exportData);
    });
    
    it('should include enough metadata for external tools', () => {
      const specs: ExportedSpec[] = [
        { 
          id: 'FR-100', 
          type: 'requirement', 
          name: 'Test Requirement',
          description: 'A test requirement',
          priority: 'must',
          category: 'common',
        },
      ];
      
      const exportData = generateAggregatedExport(specs);
      
      // External tools should be able to filter by type
      expect(exportData.stats.byType).toBeDefined();
      
      // External tools should be able to traverse references
      expect(exportData.references).toBeDefined();
      
      // External tools should have access to all spec data
      expect(exportData.items[0].description).toBe('A test requirement');
      expect(exportData.items[0].priority).toBe('must');
    });
    
    it('should support filtering by type', () => {
      const specs: ExportedSpec[] = [
        { id: 'FR-100', type: 'requirement', name: 'Req 1' },
        { id: 'FR-101', type: 'requirement', name: 'Req 2' },
        { id: 'UC-001', type: 'useCase', name: 'UC 1' },
        { id: 'COMP-A', type: 'component', name: 'Comp A' },
      ];
      
      const exportData = generateAggregatedExport(specs);
      
      // External tool could filter like this:
      const requirements = exportData.items.filter(i => i.type === 'requirement');
      const useCases = exportData.items.filter(i => i.type === 'useCase');
      
      expect(requirements).toHaveLength(2);
      expect(useCases).toHaveLength(1);
    });
    
    it('should support reference traversal', () => {
      const specs: ExportedSpec[] = [
        { id: 'FR-100', type: 'requirement', name: 'Parent' },
        { id: 'FR-101', type: 'requirement', name: 'Child', parentId: 'FR-100' },
        { id: 'FR-102', type: 'requirement', name: 'Another Child', parentId: 'FR-100' },
      ];
      
      const exportData = generateAggregatedExport(specs);
      
      // External tool could build tree like this:
      const children = Object.entries(exportData.references)
        .filter(([_, refs]) => refs.includes('FR-100'))
        .map(([id, _]) => id);
      
      expect(children).toContain('FR-101');
      expect(children).toContain('FR-102');
    });
  });
});
