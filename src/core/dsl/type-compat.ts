/**
 * Type Compatibility — Containment-based type comparison
 *
 * The spec defines the minimum required type. The DDL/OpenAPI satisfies the
 * requirement if its type can hold all values of the spec type (equal or wider).
 */

interface ParsedType {
  base: string;
  length?: number;
  precision?: number;
  scale?: number;
}

const ALIASES: Record<string, string> = {
  INTEGER: 'INT',
  BOOL: 'BOOLEAN',
  REAL: 'FLOAT',
  'DOUBLE PRECISION': 'DOUBLE',
  SERIAL: 'INT',
  BIGSERIAL: 'BIGINT',
  SMALLSERIAL: 'SMALLINT',
  TIMESTAMPTZ: 'TIMESTAMP',
  'TIMESTAMP WITH TIME ZONE': 'TIMESTAMP',
  'TIMESTAMP WITHOUT TIME ZONE': 'TIMESTAMP',
  'CHARACTER VARYING': 'VARCHAR',
  CHARACTER: 'CHAR',
  INT2: 'SMALLINT',
  INT4: 'INT',
  INT8: 'BIGINT',
  FLOAT4: 'FLOAT',
  FLOAT8: 'DOUBLE',
};

const CONTAINMENT_CHAINS: string[][] = [
  ['SMALLINT', 'INT', 'BIGINT'],
  ['FLOAT', 'DOUBLE'],
  ['CHAR', 'VARCHAR', 'TEXT'],
  ['INTEGER', 'NUMBER'],
];

function parseType(raw: string): ParsedType {
  const trimmed = raw.trim().toUpperCase();

  const match = trimmed.match(/^([A-Z\s]+?)(?:\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\))?$/);
  if (!match) {
    return { base: trimmed };
  }

  const base = match[1].trim();

  return {
    base,
    length: match[2] !== undefined ? Number(match[2]) : undefined,
    precision: match[2] !== undefined ? Number(match[2]) : undefined,
    scale: match[3] !== undefined ? Number(match[3]) : undefined,
  };
}

function normalize(base: string): string {
  return ALIASES[base] ?? base;
}

function findAllChainPositions(
  base: string,
  chains: string[][],
): Array<{ chain: string[]; index: number }> {
  const results: Array<{ chain: string[]; index: number }> = [];
  const resolved = normalize(base);
  for (const chain of chains) {
    let idx = chain.indexOf(base);
    if (idx === -1) idx = chain.indexOf(resolved);
    if (idx !== -1) results.push({ chain, index: idx });
  }
  return results;
}

/**
 * Returns true if ddlType can hold all values representable by specType.
 *
 * Containment rules:
 * - Numeric: SMALLINT ⊂ INT ⊂ BIGINT, FLOAT ⊂ DOUBLE
 * - String: CHAR(n) ⊂ VARCHAR(n) ⊂ TEXT (with length comparison)
 * - DECIMAL: precision/scale must be >= spec
 * - OpenAPI: integer ⊂ number
 */
export function isTypeContainedBy(specType: string, ddlType: string): boolean {
  const spec = parseType(specType);
  const ddl = parseType(ddlType);

  const specNorm = normalize(spec.base);
  const ddlNorm = normalize(ddl.base);

  if (specNorm === ddlNorm) {
    if (specNorm === 'DECIMAL' || specNorm === 'NUMERIC') {
      if (spec.precision !== undefined && ddl.precision !== undefined) {
        if (ddl.precision < spec.precision) return false;
      }
      if (spec.scale !== undefined && ddl.scale !== undefined) {
        if (ddl.scale < spec.scale) return false;
      }
      return true;
    }

    if (spec.length !== undefined && ddl.length !== undefined) {
      return ddl.length >= spec.length;
    }
    return true;
  }

  const specPositions = findAllChainPositions(spec.base, CONTAINMENT_CHAINS);
  const ddlPositions = findAllChainPositions(ddl.base, CONTAINMENT_CHAINS);

  for (const sp of specPositions) {
    for (const dp of ddlPositions) {
      if (sp.chain === dp.chain) {
        return dp.index >= sp.index;
      }
    }
  }

  return false;
}
