/**
 * FR-200: core-provided external SSOT reference interfaces.
 */
import { describe, it, expect } from 'vitest';
import {
  apiRefSchema,
  tableRefSchema,
  iacRefSchema,
  batchRefSchema,
  externalRefSchema,
} from '../../../src/core/dsl/external-refs.js';
import { runDesignLint, COMMON_LINT_RULES } from '../../../src/core/design-lint.js';
import { inferModelIdFromSpecId } from '../../../src/core/relation.js';
import type { SpecEntry } from '../../../src/core/model.js';

const REFS = [
  { name: 'APIRef', schema: apiRefSchema, id: 'API-ORDERS-GET', sourceType: 'openapi' },
  { name: 'TableRef', schema: tableRefSchema, id: 'TBL-ORDERS', sourceType: 'ddl' },
  { name: 'IaCRef', schema: iacRefSchema, id: 'IAC-ORDERS-QUEUE', sourceType: 'iac' },
  { name: 'BatchRef', schema: batchRefSchema, id: 'BATCH-NIGHTLY', sourceType: 'batch' },
] as const;

function minimalRef(id: string) {
  return {
    id,
    name: id,
    description: `Reference ${id}`,
    source: { path: 'api/openapi.yaml', identifier: 'listOrders' },
  };
}

describe('FR-200-01: basic interfaces for APIRef / TableRef / IaCRef / BatchRef', () => {
  for (const ref of REFS) {
    it(`FR-200-01 provides a ${ref.name} interface that targets its external SSOT`, () => {
      const parsed = ref.schema.parse(minimalRef(ref.id));
      expect(parsed.id).toBe(ref.id);
      expect(parsed.sourceType).toBe(ref.sourceType);
    });
  }

  it('FR-200-01 gives each reference an id its model prefix resolves', () => {
    expect(inferModelIdFromSpecId('API-ORDERS-GET')).toBe('api-ref');
    expect(inferModelIdFromSpecId('TBL-ORDERS')).toBe('table-ref');
    expect(inferModelIdFromSpecId('IAC-ORDERS-QUEUE')).toBe('iac-ref');
    expect(inferModelIdFromSpecId('BATCH-NIGHTLY')).toBe('batch-ref');
  });
});

describe('FR-200-02: file path and identifier of the referenced target', () => {
  it('FR-200-02 carries the file path and the identifier of the referenced target', () => {
    const parsed = apiRefSchema.parse({
      ...minimalRef('API-ORDERS-GET'),
      source: { path: 'api/orders.yaml', identifier: 'listOrders' },
    });

    expect(parsed.source.path).toBe('api/orders.yaml');
    expect(parsed.source.identifier).toBe('listOrders');
  });

  it('FR-200-02 rejects a reference with no path or no identifier', () => {
    const noPath = apiRefSchema.safeParse({
      ...minimalRef('API-ORDERS-GET'),
      source: { identifier: 'listOrders' },
    });
    expect(noPath.success).toBe(false);

    const noIdentifier = apiRefSchema.safeParse({
      ...minimalRef('API-ORDERS-GET'),
      source: { path: 'api/orders.yaml' },
    });
    expect(noIdentifier.success).toBe(false);

    const blankPath = apiRefSchema.safeParse({
      ...minimalRef('API-ORDERS-GET'),
      source: { path: '', identifier: 'listOrders' },
    });
    expect(blankPath.success).toBe(false);
  });
});

describe('FR-200-03: association with related components and entities', () => {
  const withAssociations = {
    ...minimalRef('API-ORDERS-GET'),
    relations: [
      { type: 'dependsOn' as const, target: 'COMP-ORDER-API' },
      { type: 'uses' as const, target: 'ENT-ORDER' },
    ],
  };

  it('FR-200-03 associates a reference with a component and an entity', () => {
    const parsed = apiRefSchema.parse(withAssociations);
    expect(parsed.relations?.map(r => r.target)).toEqual(['COMP-ORDER-API', 'ENT-ORDER']);
    expect(inferModelIdFromSpecId('COMP-ORDER-API')).toBe('component');
    expect(inferModelIdFromSpecId('ENT-ORDER')).toBe('entity');
  });

  it('FR-200-03 checks those associations for reference integrity', () => {
    const declared: SpecEntry[] = [
      { model: { id: 'api-ref', register: () => {} }, data: [apiRefSchema.parse(withAssociations)] },
      { model: { id: 'component', register: () => {} }, data: [{ id: 'COMP-ORDER-API' }] },
      { model: { id: 'entity', register: () => {} }, data: [{ id: 'ENT-ORDER' }] },
    ];
    expect(
      runDesignLint(declared).filter(r => r.ruleId === COMMON_LINT_RULES.refExists),
    ).toEqual([]);

    const missingEntity = declared.slice(0, 2);
    const dangling = runDesignLint(missingEntity).filter(
      r => r.ruleId === COMMON_LINT_RULES.refExists,
    );
    expect(dangling).toHaveLength(1);
    expect(dangling[0].message).toContain('ENT-ORDER');
  });
});

describe('external reference base', () => {
  it('shares id, name, description and relations across every reference kind', () => {
    const parsed = externalRefSchema.parse(minimalRef('API-ORDERS-GET'));
    expect(Object.keys(parsed).sort()).toEqual(['description', 'id', 'name', 'source']);
  });
});
