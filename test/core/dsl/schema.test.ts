import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { baseSpecSchema } from '../../../src/core/dsl/schema.js';
import { ImplementsRelationSchema, VerifiedByRelationSchema } from '../../../src/core/dsl/relation-schemas.js';

describe('baseSpecSchema', () => {
  it('parses valid base spec', () => {
    const result = baseSpecSchema.safeParse({
      id: 'FR-001',
      name: 'Test',
      description: 'A test spec',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional relations', () => {
    const result = baseSpecSchema.safeParse({
      id: 'FR-001',
      name: 'Test',
      description: 'A test spec',
      relations: [{ type: 'refines', target: 'SR-001' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = baseSpecSchema.safeParse({
      id: 'FR-001',
      name: '',
      description: 'A test spec',
    });
    expect(result.success).toBe(false);
  });

  it('can be extended with additional fields', () => {
    const extended = baseSpecSchema.extend({
      priority: z.enum(['must', 'should', 'could']),
    });
    const result = extended.safeParse({
      id: 'FR-001',
      name: 'Test',
      description: 'A test',
      priority: 'must',
    });
    expect(result.success).toBe(true);
  });
});

describe('ImplementsRelationSchema', () => {
  it('parses valid implements relation', () => {
    const result = ImplementsRelationSchema.safeParse({
      target: 'API-001',
      targetType: 'openapi',
      sourcePath: 'api/openapi.yaml',
    });
    expect(result.success).toBe(true);
  });

  it('allows optional fields', () => {
    const result = ImplementsRelationSchema.safeParse({
      target: 'DDL-001',
      targetType: 'sqlschema',
    });
    expect(result.success).toBe(true);
  });
});

describe('VerifiedByRelationSchema', () => {
  it('parses valid verifiedBy relation', () => {
    const result = VerifiedByRelationSchema.safeParse({
      target: 'UT-001',
      testPath: 'test/**/*.test.ts',
      framework: 'vitest',
    });
    expect(result.success).toBe(true);
  });

  it('allows optional fields', () => {
    const result = VerifiedByRelationSchema.safeParse({
      target: 'IT-001',
    });
    expect(result.success).toBe(true);
  });
});
