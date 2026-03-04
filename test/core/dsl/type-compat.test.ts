import { describe, it, expect } from 'vitest';
import { isTypeContainedBy } from '../../../src/core/dsl/type-compat.js';

describe('isTypeContainedBy', () => {
  describe('numeric hierarchy', () => {
    it('INT contains SMALLINT', () => {
      expect(isTypeContainedBy('SMALLINT', 'INT')).toBe(true);
    });

    it('BIGINT contains SMALLINT', () => {
      expect(isTypeContainedBy('SMALLINT', 'BIGINT')).toBe(true);
    });

    it('BIGINT contains INT', () => {
      expect(isTypeContainedBy('INT', 'BIGINT')).toBe(true);
    });

    it('SMALLINT does NOT contain INT', () => {
      expect(isTypeContainedBy('INT', 'SMALLINT')).toBe(false);
    });

    it('SMALLINT does NOT contain BIGINT', () => {
      expect(isTypeContainedBy('BIGINT', 'SMALLINT')).toBe(false);
    });

    it('INT does NOT contain BIGINT', () => {
      expect(isTypeContainedBy('BIGINT', 'INT')).toBe(false);
    });

    it('DOUBLE contains FLOAT', () => {
      expect(isTypeContainedBy('FLOAT', 'DOUBLE')).toBe(true);
    });

    it('FLOAT does NOT contain DOUBLE', () => {
      expect(isTypeContainedBy('DOUBLE', 'FLOAT')).toBe(false);
    });

    it('INT contains INT (identical type)', () => {
      expect(isTypeContainedBy('INT', 'INT')).toBe(true);
    });
  });

  describe('alias resolution', () => {
    it('INTEGER resolves to INT', () => {
      expect(isTypeContainedBy('SMALLINT', 'INTEGER')).toBe(true);
    });

    it('BOOL resolves to BOOLEAN', () => {
      expect(isTypeContainedBy('BOOLEAN', 'BOOL')).toBe(true);
    });

    it('REAL resolves to FLOAT', () => {
      expect(isTypeContainedBy('FLOAT', 'REAL')).toBe(true);
    });

    it('SERIAL resolves to INT', () => {
      expect(isTypeContainedBy('INT', 'SERIAL')).toBe(true);
    });

    it('BIGSERIAL resolves to BIGINT', () => {
      expect(isTypeContainedBy('INT', 'BIGSERIAL')).toBe(true);
    });
  });

  describe('VARCHAR length comparison', () => {
    it('VARCHAR(255) contains VARCHAR(100)', () => {
      expect(isTypeContainedBy('VARCHAR(100)', 'VARCHAR(255)')).toBe(true);
    });

    it('VARCHAR(100) does NOT contain VARCHAR(255)', () => {
      expect(isTypeContainedBy('VARCHAR(255)', 'VARCHAR(100)')).toBe(false);
    });

    it('VARCHAR(100) contains VARCHAR(100) — equal', () => {
      expect(isTypeContainedBy('VARCHAR(100)', 'VARCHAR(100)')).toBe(true);
    });
  });

  describe('string hierarchy', () => {
    it('TEXT contains VARCHAR(N)', () => {
      expect(isTypeContainedBy('VARCHAR(255)', 'TEXT')).toBe(true);
    });

    it('VARCHAR(N) does NOT contain TEXT', () => {
      expect(isTypeContainedBy('TEXT', 'VARCHAR(100)')).toBe(false);
    });

    it('VARCHAR contains CHAR', () => {
      expect(isTypeContainedBy('CHAR(10)', 'VARCHAR(10)')).toBe(true);
    });

    it('TEXT contains CHAR', () => {
      expect(isTypeContainedBy('CHAR(50)', 'TEXT')).toBe(true);
    });
  });

  describe('DECIMAL precision', () => {
    it('DECIMAL(10,2) contains DECIMAL(8,2)', () => {
      expect(isTypeContainedBy('DECIMAL(8,2)', 'DECIMAL(10,2)')).toBe(true);
    });

    it('DECIMAL(8,2) does NOT contain DECIMAL(10,2)', () => {
      expect(isTypeContainedBy('DECIMAL(10,2)', 'DECIMAL(8,2)')).toBe(false);
    });

    it('DECIMAL(10,4) contains DECIMAL(10,2) — wider scale', () => {
      expect(isTypeContainedBy('DECIMAL(10,2)', 'DECIMAL(10,4)')).toBe(true);
    });

    it('DECIMAL(10,2) does NOT contain DECIMAL(10,4) — narrower scale', () => {
      expect(isTypeContainedBy('DECIMAL(10,4)', 'DECIMAL(10,2)')).toBe(false);
    });
  });

  describe('NUMERIC type', () => {
    it('NUMERIC(10,2) contains NUMERIC(8,2)', () => {
      expect(isTypeContainedBy('NUMERIC(8,2)', 'NUMERIC(10,2)')).toBe(true);
    });

    it('NUMERIC(8,2) does NOT contain NUMERIC(10,2)', () => {
      expect(isTypeContainedBy('NUMERIC(10,2)', 'NUMERIC(8,2)')).toBe(false);
    });
  });

  describe('asymmetric precision/length', () => {
    it('DECIMAL without precision contains DECIMAL(10,2)', () => {
      expect(isTypeContainedBy('DECIMAL', 'DECIMAL(10,2)')).toBe(true);
    });

    it('DECIMAL(10,2) contains DECIMAL without precision', () => {
      expect(isTypeContainedBy('DECIMAL(10,2)', 'DECIMAL')).toBe(true);
    });

    it('VARCHAR without length contains VARCHAR(255)', () => {
      expect(isTypeContainedBy('VARCHAR', 'VARCHAR(255)')).toBe(true);
    });

    it('VARCHAR(255) contains VARCHAR without length', () => {
      expect(isTypeContainedBy('VARCHAR(255)', 'VARCHAR')).toBe(true);
    });
  });

  describe('unrelated type families', () => {
    it('INT is NOT contained by VARCHAR(255)', () => {
      expect(isTypeContainedBy('INT', 'VARCHAR(255)')).toBe(false);
    });

    it('BOOLEAN is NOT contained by TEXT', () => {
      expect(isTypeContainedBy('BOOLEAN', 'TEXT')).toBe(false);
    });

    it('TIMESTAMP is NOT contained by INT', () => {
      expect(isTypeContainedBy('TIMESTAMP', 'INT')).toBe(false);
    });
  });

  describe('multi-word aliases', () => {
    it('DOUBLE PRECISION equals DOUBLE after alias', () => {
      expect(isTypeContainedBy('DOUBLE PRECISION', 'DOUBLE')).toBe(true);
    });

    it('FLOAT is contained by DOUBLE PRECISION', () => {
      expect(isTypeContainedBy('FLOAT', 'DOUBLE PRECISION')).toBe(true);
    });

    it('CHARACTER VARYING is contained by TEXT (VARCHAR alias)', () => {
      expect(isTypeContainedBy('CHARACTER VARYING', 'TEXT')).toBe(true);
    });

    it('CHARACTER is contained by VARCHAR(100) (CHAR alias)', () => {
      expect(isTypeContainedBy('CHARACTER', 'VARCHAR(100)')).toBe(true);
    });
  });

  describe('PostgreSQL shorthand aliases', () => {
    it('INT2 is contained by INT4 (SMALLINT ⊂ INT)', () => {
      expect(isTypeContainedBy('INT2', 'INT4')).toBe(true);
    });

    it('INT4 is contained by INT8 (INT ⊂ BIGINT)', () => {
      expect(isTypeContainedBy('INT4', 'INT8')).toBe(true);
    });

    it('INT8 is NOT contained by INT4 (BIGINT not in INT)', () => {
      expect(isTypeContainedBy('INT8', 'INT4')).toBe(false);
    });

    it('FLOAT4 is contained by FLOAT8 (FLOAT ⊂ DOUBLE)', () => {
      expect(isTypeContainedBy('FLOAT4', 'FLOAT8')).toBe(true);
    });
  });

  describe('timestamp aliases', () => {
    it('TIMESTAMPTZ equals TIMESTAMP after alias', () => {
      expect(isTypeContainedBy('TIMESTAMPTZ', 'TIMESTAMP')).toBe(true);
    });

    it('TIMESTAMP WITH TIME ZONE equals TIMESTAMP after alias', () => {
      expect(isTypeContainedBy('TIMESTAMP WITH TIME ZONE', 'TIMESTAMP')).toBe(true);
    });
  });

  describe('SMALLSERIAL alias', () => {
    it('SMALLSERIAL is contained by INT (SMALLINT ⊂ INT after alias)', () => {
      expect(isTypeContainedBy('SMALLSERIAL', 'INT')).toBe(true);
    });
  });

  describe('regex fallback path', () => {
    it('non-matching input returns true when both bases are same', () => {
      expect(isTypeContainedBy('???', '???')).toBe(true);
    });
  });

  describe('cross-chain alias edge case', () => {
    it('INTEGER is contained by NUMBER (OpenAPI chain)', () => {
      expect(isTypeContainedBy('INTEGER', 'NUMBER')).toBe(true);
    });
  });

  describe('OpenAPI type hierarchy', () => {
    it('number contains integer', () => {
      expect(isTypeContainedBy('integer', 'number')).toBe(true);
    });

    it('integer does NOT contain number', () => {
      expect(isTypeContainedBy('number', 'integer')).toBe(false);
    });

    it('string contains string (identical type)', () => {
      expect(isTypeContainedBy('string', 'string')).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    it('handles mixed case input', () => {
      expect(isTypeContainedBy('smallint', 'INT')).toBe(true);
    });

    it('handles whitespace', () => {
      expect(isTypeContainedBy('  VARCHAR(100)  ', 'VARCHAR(255)')).toBe(true);
    });
  });
});
