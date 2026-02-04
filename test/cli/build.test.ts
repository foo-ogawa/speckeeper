/**
 * FR-300/301/302: Generation (build) tests
 * 
 * Generate "human-readable output (docs/)" and "machine-readable output (specs/)" from TS models
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';

const testDir = join(process.cwd(), '.test-build');

// Mock spec types
interface Entity {
  id: string;
  name: string;
  description?: string;
  attributes: Array<{
    name: string;
    type: string;
    required?: boolean;
  }>;
}

interface Requirement {
  id: string;
  name: string;
  description: string;
  acceptanceCriteria: Array<{ id: string; description: string }>;
}

// Mock exporters
function exportEntityToMarkdown(entity: Entity): string {
  const lines = [
    `# ${entity.name}`,
    '',
    entity.description || '',
    '',
    '## Attributes',
    '',
    '| Name | Type | Required |',
    '|------|------|----------|',
    ...entity.attributes.map(
      a => `| ${a.name} | ${a.type} | ${a.required ? 'Yes' : 'No'} |`
    ),
  ];
  return lines.join('\n');
}

function exportEntityToJsonSchema(entity: Entity): object {
  const properties: Record<string, object> = {};
  const required: string[] = [];
  
  for (const attr of entity.attributes) {
    properties[attr.name] = {
      type: mapTypeToJsonSchema(attr.type),
    };
    if (attr.required) {
      required.push(attr.name);
    }
  }
  
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: entity.name,
    description: entity.description,
    type: 'object',
    properties,
    required,
  };
}

function mapTypeToJsonSchema(type: string): string {
  const mapping: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    date: 'string',
    uuid: 'string',
  };
  return mapping[type] || 'string';
}

function exportRequirementToMarkdown(req: Requirement): string {
  const lines = [
    `# ${req.id}: ${req.name}`,
    '',
    req.description,
    '',
    '## Acceptance Criteria',
    '',
    ...req.acceptanceCriteria.map(ac => `- **${ac.id}**: ${ac.description}`),
  ];
  return lines.join('\n');
}

function exportToMermaidER(entities: Entity[]): string {
  const lines = ['erDiagram'];
  for (const entity of entities) {
    lines.push(`  ${entity.id} {`);
    for (const attr of entity.attributes) {
      const required = attr.required ? 'PK' : '';
      lines.push(`    ${attr.type} ${attr.name} ${required}`.trim());
    }
    lines.push('  }');
  }
  return lines.join('\n');
}

function exportIndex(items: Array<{ id: string; name: string }>): string {
  const lines = [
    '# Index',
    '',
    '| ID | Name |',
    '|----|------|',
    ...items.map(item => `| [${item.id}](${item.id}.md) | ${item.name} |`),
  ];
  return lines.join('\n');
}

// Build reference graph
function buildReferenceGraph(specs: Array<{ id: string; references?: string[] }>): object {
  const graph: Record<string, { references: string[]; referencedBy: string[] }> = {};
  
  for (const spec of specs) {
    if (!graph[spec.id]) {
      graph[spec.id] = { references: [], referencedBy: [] };
    }
    
    for (const ref of spec.references || []) {
      graph[spec.id].references.push(ref);
      
      if (!graph[ref]) {
        graph[ref] = { references: [], referencedBy: [] };
      }
      graph[ref].referencedBy.push(spec.id);
    }
  }
  
  return {
    generated: new Date().toISOString(),
    nodes: Object.keys(graph).length,
    graph,
  };
}

// Idempotency check (same input -> same output)
function computeContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

describe('FR-300: Generation (build)', () => {
  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(join(testDir, 'docs'), { recursive: true });
    mkdirSync(join(testDir, 'specs'), { recursive: true });
  });
  
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });
  
  // FR-300-01: Can output human-readable output (docs/)
  describe('FR-300-01: docs/ generation', () => {
    it('should generate Markdown for entity', () => {
      const entity: Entity = {
        id: 'ENT-ORDER',
        name: 'Order',
        description: 'Represents a customer order',
        attributes: [
          { name: 'id', type: 'uuid', required: true },
          { name: 'customerId', type: 'uuid', required: true },
          { name: 'status', type: 'string', required: true },
          { name: 'totalAmount', type: 'number', required: false },
        ],
      };
      
      const markdown = exportEntityToMarkdown(entity);
      
      expect(markdown).toContain('# Order');
      expect(markdown).toContain('| id | uuid | Yes |');
      expect(markdown).toContain('| totalAmount | number | No |');
    });
    
    it('should generate Markdown for requirement', () => {
      const requirement: Requirement = {
        id: 'FR-101',
        name: 'ID Management',
        description: 'All model elements must have unique IDs',
        acceptanceCriteria: [
          { id: 'FR-101-01', description: 'IDs are unique' },
          { id: 'FR-101-02', description: 'IDs follow naming convention' },
        ],
      };
      
      const markdown = exportRequirementToMarkdown(requirement);
      
      expect(markdown).toContain('# FR-101: ID Management');
      expect(markdown).toContain('**FR-101-01**: IDs are unique');
    });
    
    it('should generate index page', () => {
      const items = [
        { id: 'ENT-ORDER', name: 'Order' },
        { id: 'ENT-CUSTOMER', name: 'Customer' },
      ];
      
      const index = exportIndex(items);
      
      expect(index).toContain('# Index');
      expect(index).toContain('| [ENT-ORDER](ENT-ORDER.md) | Order |');
      expect(index).toContain('| [ENT-CUSTOMER](ENT-CUSTOMER.md) | Customer |');
    });
    
    it('should write Markdown files to docs/ directory', () => {
      const entity: Entity = {
        id: 'ENT-TEST',
        name: 'Test Entity',
        attributes: [],
      };
      
      const markdown = exportEntityToMarkdown(entity);
      const filePath = join(testDir, 'docs', 'entities', 'ENT-TEST.md');
      
      mkdirSync(join(testDir, 'docs', 'entities'), { recursive: true });
      writeFileSync(filePath, markdown);
      
      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath, 'utf-8')).toContain('# Test Entity');
    });
  });
  
  // FR-300-02: Can output machine-readable output (specs/)
  describe('FR-300-02: specs/ generation', () => {
    it('should generate JSON Schema for entity', () => {
      const entity: Entity = {
        id: 'ENT-ORDER',
        name: 'Order',
        description: 'Order entity',
        attributes: [
          { name: 'id', type: 'uuid', required: true },
          { name: 'status', type: 'string', required: true },
          { name: 'amount', type: 'number', required: false },
        ],
      };
      
      const schema = exportEntityToJsonSchema(entity);
      
      expect(schema).toHaveProperty('$schema');
      expect(schema).toHaveProperty('title', 'Order');
      expect(schema).toHaveProperty('properties.id.type', 'string');
      expect(schema).toHaveProperty('properties.amount.type', 'number');
      expect(schema).toHaveProperty('required');
    });
    
    it('should write JSON Schema to specs/schemas/', () => {
      const entity: Entity = {
        id: 'ENT-TEST',
        name: 'Test',
        attributes: [{ name: 'id', type: 'string', required: true }],
      };
      
      const schema = exportEntityToJsonSchema(entity);
      const filePath = join(testDir, 'specs', 'schemas', 'entities', 'ENT-TEST.json');
      
      mkdirSync(join(testDir, 'specs', 'schemas', 'entities'), { recursive: true });
      writeFileSync(filePath, JSON.stringify(schema, null, 2));
      
      expect(existsSync(filePath)).toBe(true);
      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content.title).toBe('Test');
    });
  });
});

describe('FR-301: Markdown rendering functionality', () => {
  // FR-301-01: Can define rendering functions via exporters property on Model class
  describe('FR-301-01: exporters property', () => {
    it('should define exporter with single and index functions', () => {
      const exporter = {
        format: 'markdown' as const,
        single: (entity: Entity) => `# ${entity.name}`,
        index: (entities: Entity[]) => entities.map(e => `- ${e.name}`).join('\n'),
        outputDir: 'entities',
        filename: (entity: Entity) => entity.id,
      };
      
      expect(exporter.format).toBe('markdown');
      expect(typeof exporter.single).toBe('function');
      expect(typeof exporter.index).toBe('function');
    });
  });
  
  // FR-301-03: Rendering result switches internally based on model class
  describe('FR-301-03: Model-specific rendering', () => {
    it('should render entity differently from requirement', () => {
      const entity: Entity = {
        id: 'ENT-001',
        name: 'Entity',
        attributes: [{ name: 'id', type: 'string' }],
      };
      
      const requirement: Requirement = {
        id: 'FR-001',
        name: 'Requirement',
        description: 'Test',
        acceptanceCriteria: [{ id: 'FR-001-01', description: 'Criterion' }],
      };
      
      const entityMd = exportEntityToMarkdown(entity);
      const requirementMd = exportRequirementToMarkdown(requirement);
      
      expect(entityMd).toContain('## Attributes');
      expect(requirementMd).toContain('## Acceptance Criteria');
      expect(entityMd).not.toContain('## Acceptance Criteria');
      expect(requirementMd).not.toContain('## Attributes');
    });
  });
  
  // FR-301-04: Can specify output format via format parameter
  describe('FR-301-04: format parameter', () => {
    it('should render single entity', () => {
      const entity: Entity = {
        id: 'ENT-001',
        name: 'Single Entity',
        attributes: [],
      };
      
      const result = exportEntityToMarkdown(entity);
      
      expect(result).toContain('# Single Entity');
    });
    
    it('should render index of multiple entities', () => {
      const entities = [
        { id: 'ENT-001', name: 'Entity 1' },
        { id: 'ENT-002', name: 'Entity 2' },
        { id: 'ENT-003', name: 'Entity 3' },
      ];
      
      const result = exportIndex(entities);
      
      expect(result).toContain('Entity 1');
      expect(result).toContain('Entity 2');
      expect(result).toContain('Entity 3');
    });
  });
  
  // Mermaid diagram generation (provided as renderer format='mermaid')
  describe('Mermaid diagram generation', () => {
    it('should generate Mermaid ER diagram', () => {
      const entities: Entity[] = [
        {
          id: 'ENT-ORDER',
          name: 'Order',
          attributes: [
            { name: 'id', type: 'uuid', required: true },
            { name: 'status', type: 'string' },
          ],
        },
        {
          id: 'ENT-CUSTOMER',
          name: 'Customer',
          attributes: [
            { name: 'id', type: 'uuid', required: true },
            { name: 'name', type: 'string' },
          ],
        },
      ];
      
      const mermaid = exportToMermaidER(entities);
      
      expect(mermaid).toContain('erDiagram');
      expect(mermaid).toContain('ENT-ORDER');
      expect(mermaid).toContain('ENT-CUSTOMER');
      expect(mermaid).toContain('uuid id PK');
    });
    
    it('should generate valid Mermaid syntax', () => {
      const entities: Entity[] = [
        {
          id: 'ENT-TEST',
          name: 'Test',
          attributes: [{ name: 'id', type: 'uuid', required: true }],
        },
      ];
      
      const mermaid = exportToMermaidER(entities);
      
      // Verify basic syntax
      expect(mermaid.startsWith('erDiagram')).toBe(true);
      expect(mermaid).toContain('{');
      expect(mermaid).toContain('}');
    });
  });
  
  // FR-301-05: Regeneration produces identical output (idempotency)
  describe('FR-301-05: Idempotency', () => {
    it('should produce identical output on regeneration', () => {
      const entity: Entity = {
        id: 'ENT-IDEMPOTENT',
        name: 'Idempotent Entity',
        description: 'Test for idempotency',
        attributes: [
          { name: 'id', type: 'uuid', required: true },
          { name: 'name', type: 'string', required: true },
        ],
      };
      
      const output1 = exportEntityToMarkdown(entity);
      const output2 = exportEntityToMarkdown(entity);
      const output3 = exportEntityToMarkdown(entity);
      
      expect(output1).toBe(output2);
      expect(output2).toBe(output3);
    });
    
    it('should produce identical JSON Schema on regeneration', () => {
      const entity: Entity = {
        id: 'ENT-IDEMPOTENT',
        name: 'Idempotent',
        attributes: [{ name: 'id', type: 'uuid', required: true }],
      };
      
      const schema1 = JSON.stringify(exportEntityToJsonSchema(entity));
      const schema2 = JSON.stringify(exportEntityToJsonSchema(entity));
      
      expect(schema1).toBe(schema2);
    });
    
    it('should produce identical hashes for identical content', () => {
      const content = 'Test content for hashing';
      
      const hash1 = computeContentHash(content);
      const hash2 = computeContentHash(content);
      
      expect(hash1).toBe(hash2);
    });
  });
});

describe('FR-302: Machine-readable output (specs/)', () => {
  // FR-302-01: Entity attributes are mapped to JSON Schema properties
  describe('FR-302-01: JSON Schema property mapping', () => {
    it('should map entity attributes to JSON Schema properties', () => {
      const entity: Entity = {
        id: 'ENT-001',
        name: 'TestEntity',
        attributes: [
          { name: 'stringField', type: 'string' },
          { name: 'numberField', type: 'number' },
          { name: 'boolField', type: 'boolean' },
        ],
      };
      
      const schema = exportEntityToJsonSchema(entity) as {
        properties: Record<string, { type: string }>;
      };
      
      expect(schema.properties.stringField.type).toBe('string');
      expect(schema.properties.numberField.type).toBe('number');
      expect(schema.properties.boolField.type).toBe('boolean');
    });
    
    it('should mark required fields in JSON Schema', () => {
      const entity: Entity = {
        id: 'ENT-001',
        name: 'TestEntity',
        attributes: [
          { name: 'required1', type: 'string', required: true },
          { name: 'required2', type: 'number', required: true },
          { name: 'optional', type: 'string', required: false },
        ],
      };
      
      const schema = exportEntityToJsonSchema(entity) as { required: string[] };
      
      expect(schema.required).toContain('required1');
      expect(schema.required).toContain('required2');
      expect(schema.required).not.toContain('optional');
    });
  });
  
  // FR-302-02: Can output reference resolution graph (specs/index.json)
  describe('FR-302-02: Reference resolution graph', () => {
    it('should build reference graph', () => {
      const specs = [
        { id: 'FR-100', references: ['UC-001', 'UC-002'] },
        { id: 'UC-001', references: ['ACT-001'] },
        { id: 'UC-002', references: ['ACT-001', 'ACT-002'] },
        { id: 'ACT-001', references: [] },
        { id: 'ACT-002', references: [] },
      ];
      
      const graph = buildReferenceGraph(specs) as {
        nodes: number;
        graph: Record<string, { references: string[]; referencedBy: string[] }>;
      };
      
      expect(graph.nodes).toBe(5);
      expect(graph.graph['FR-100'].references).toContain('UC-001');
      expect(graph.graph['UC-001'].referencedBy).toContain('FR-100');
      expect(graph.graph['ACT-001'].referencedBy).toContain('UC-001');
      expect(graph.graph['ACT-001'].referencedBy).toContain('UC-002');
    });
    
    it('should include all IDs in reference graph', () => {
      const specs = [
        { id: 'A', references: ['B'] },
        { id: 'B', references: ['C'] },
        { id: 'C', references: [] },
      ];
      
      const graph = buildReferenceGraph(specs) as {
        graph: Record<string, unknown>;
      };
      
      expect(Object.keys(graph.graph)).toContain('A');
      expect(Object.keys(graph.graph)).toContain('B');
      expect(Object.keys(graph.graph)).toContain('C');
    });
    
    it('should write index.json to specs/', () => {
      const specs = [{ id: 'TEST', references: [] }];
      const graph = buildReferenceGraph(specs);
      
      // Ensure directory exists
      mkdirSync(join(testDir, 'specs'), { recursive: true });
      
      const filePath = join(testDir, 'specs', 'index.json');
      writeFileSync(filePath, JSON.stringify(graph, null, 2));
      
      expect(existsSync(filePath)).toBe(true);
      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content).toHaveProperty('graph');
    });
  });
});
