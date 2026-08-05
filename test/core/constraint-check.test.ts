/**
 * FR-600-03 / FR-601-03: the constraint category of the external SSOT
 * consistency check — the non-functional requirements and guardrails a matched
 * external object must satisfy.
 */
import { describe, it, expect } from 'vitest';
import { runDeepValidation, type GlobalScanMatch } from '../../src/core/global-scanner.js';
import type { DeepValidationConfig, ExternalConstraint } from '../../src/core/model.js';

interface TableSpec {
  id: string;
  classification: 'pii' | 'public';
}

const PII_TABLE = { name: 'customers', encrypted: false, columns: [{ name: 'email', type: 'text' }] };
const ENCRYPTED_TABLE = { name: 'customers', encrypted: true, columns: [{ name: 'email', type: 'text' }] };

function ddlMatch(context: unknown): GlobalScanMatch {
  return {
    specId: 'TBL-CUSTOMERS',
    sourceType: 'ddl',
    location: 'db/schema.sql:customers',
    context,
  };
}

const encryptionRequired: ExternalConstraint<TableSpec> = {
  id: 'encryption-required',
  description: 'a table holding PII must be encrypted at rest',
  holds: (spec, context) =>
    spec.classification !== 'pii' || (context as { table: { encrypted: boolean } }).table.encrypted,
};

function configWith(constraints: ExternalConstraint<TableSpec>[]): DeepValidationConfig<TableSpec> {
  return { ddl: { constraints } };
}

const piiSpec: TableSpec = { id: 'TBL-CUSTOMERS', classification: 'pii' };

describe('FR-600-03: constraint check against the external SSOT', () => {
  it('FR-600-03 passes when the guardrail declared for the source is satisfied', () => {
    const result = runDeepValidation(
      'TBL-CUSTOMERS',
      [ddlMatch({ table: ENCRYPTED_TABLE })],
      configWith([encryptionRequired]),
      piiSpec,
    );

    expect(result).toEqual({ success: true, errors: [], warnings: [] });
  });

  it('FR-600-03 fails the check when a non-functional constraint is not satisfied', () => {
    const result = runDeepValidation(
      'TBL-CUSTOMERS',
      [ddlMatch({ table: PII_TABLE })],
      configWith([encryptionRequired]),
      piiSpec,
    );

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('encryption-required');
    expect(result.errors[0].message).toContain('db/schema.sql:customers');
    expect(result.errors[0].specId).toBe('TBL-CUSTOMERS');
  });

  it('FR-600-03 leaves a spec whose classification does not trigger the guardrail alone', () => {
    const result = runDeepValidation(
      'TBL-CUSTOMERS',
      [ddlMatch({ table: PII_TABLE })],
      configWith([encryptionRequired]),
      { id: 'TBL-CUSTOMERS', classification: 'public' },
    );

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('FR-601-03: constraints are one of the three consistency categories', () => {
  it('FR-601-03 reports every declared constraint that the external object violates', () => {
    const columnLimit: ExternalConstraint<TableSpec> = {
      id: 'column-budget',
      description: 'a table must declare at least two columns',
      holds: (_spec, context) => (context as { table: { columns: unknown[] } }).table.columns.length >= 2,
    };

    const result = runDeepValidation(
      'TBL-CUSTOMERS',
      [ddlMatch({ table: PII_TABLE })],
      configWith([encryptionRequired, columnLimit]),
      piiSpec,
    );

    expect(result.errors.map(e => e.field)).toEqual(['encryption-required', 'column-budget']);
  });

  it('FR-601-03 honours a constraint declared as a warning without failing the check', () => {
    const advisory: ExternalConstraint<TableSpec> = {
      ...encryptionRequired,
      id: 'encryption-advisory',
      severity: 'warning',
    };

    const result = runDeepValidation(
      'TBL-CUSTOMERS',
      [ddlMatch({ table: PII_TABLE })],
      configWith([advisory]),
      piiSpec,
    );

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].field).toBe('encryption-advisory');
  });

  it('FR-601-03 fails a constraint it cannot evaluate instead of passing it', () => {
    const result = runDeepValidation(
      'TBL-CUSTOMERS',
      [ddlMatch(undefined)],
      configWith([encryptionRequired]),
      piiSpec,
    );

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('cannot be evaluated');
  });

  it('FR-601-03 rejects a deep validation rule that declares neither a mapper nor constraints', () => {
    expect(() =>
      runDeepValidation('TBL-CUSTOMERS', [ddlMatch({ table: PII_TABLE })], { ddl: {} }, piiSpec),
    ).toThrow(/declares neither a mapper nor constraints/);
  });

  it('FR-601-03 leaves a source type with no declared rule untouched', () => {
    const result = runDeepValidation(
      'TBL-CUSTOMERS',
      [{ specId: 'TBL-CUSTOMERS', sourceType: 'openapi', location: 'api/openapi.yaml', context: {} }],
      configWith([encryptionRequired]),
      piiSpec,
    );

    expect(result).toEqual({ success: true, errors: [], warnings: [] });
  });
});
