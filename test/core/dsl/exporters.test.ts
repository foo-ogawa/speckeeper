import { describe, it, expect } from 'vitest';
import { markdownExporter } from '../../../src/core/dsl/exporters.js';

interface TestSpec {
  id: string;
  name: string;
  description: string;
  priority: string;
}

describe('markdownExporter', () => {
  const exporter = markdownExporter<TestSpec>({
    outputDir: 'test-output',
    single: {
      title: 'name',
      meta: ['id', { key: 'priority', label: 'Priority' }],
      sections: [
        { heading: 'Description', field: 'description' },
      ],
    },
    index: {
      title: 'Test Specs',
      columns: ['id', 'name', { key: 'priority', label: 'Priority' }],
    },
  });

  it('has correct format and outputDir', () => {
    expect(exporter.format).toBe('markdown');
    expect(exporter.outputDir).toBe('test-output');
  });

  it('generates filename from spec id', () => {
    expect(exporter.filename!({ id: 'FR-001', name: 'X', description: 'Y', priority: 'must' })).toBe('FR-001');
  });

  it('generates single markdown with title, meta, and sections', () => {
    const result = exporter.single!({ id: 'FR-001', name: 'Test Feature', description: 'A test', priority: 'must' });
    expect(result).toContain('# Test Feature');
    expect(result).toContain('**id**: FR-001');
    expect(result).toContain('**Priority**: must');
    expect(result).toContain('## Description');
    expect(result).toContain('A test');
  });

  it('generates index markdown with table', () => {
    const specs: TestSpec[] = [
      { id: 'FR-001', name: 'Feature A', description: 'x', priority: 'must' },
      { id: 'FR-002', name: 'Feature B', description: 'y', priority: 'should' },
    ];
    const result = exporter.index!(specs);
    expect(result).toContain('# Test Specs');
    expect(result).toContain('[FR-001](./FR-001.md)');
    expect(result).toContain('Feature B');
    expect(result).toContain('should');
  });

  it('skips optional sections when field is empty', () => {
    const optExporter = markdownExporter<TestSpec>({
      outputDir: 'out',
      single: {
        title: 'name',
        sections: [
          { heading: 'Optional', field: 'description', optional: true },
        ],
      },
    });
    const result = optExporter.single!({ id: 'X', name: 'Test', description: '', priority: '' });
    expect(result).not.toContain('## Optional');
  });
});
