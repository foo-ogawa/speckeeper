/**
 * FR-603, FR-604: externalChecker / coverageChecker declared on the Model class
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Model } from '../../src/core/model.js';
import type {
  ModelLevel,
  LintRule,
  Exporter,
  ExternalChecker,
  CoverageChecker,
  CheckResult,
  CoverageResult,
} from '../../src/core/model.js';

const ApiSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  operationId: z.string(),
});

type ApiSpec = z.infer<typeof ApiSpecSchema>;

class CheckedModel extends Model<typeof ApiSpecSchema> {
  readonly id = 'checked-api';
  readonly name = 'CheckedApi';
  readonly idPrefix = 'CA';
  readonly schema = ApiSpecSchema;
  protected modelLevel: ModelLevel = 'L1';
  protected lintRules: LintRule<ApiSpec>[] = [];
  protected exporters: Exporter<ApiSpec>[] = [];

  protected externalChecker: ExternalChecker<ApiSpec> = {
    targetType: 'openapi',
    sourcePath: (spec) => `api/${spec.id}.openapi.yaml`,
    check: (spec, externalData): CheckResult => {
      const doc = externalData as { operationIds?: string[] } | undefined;
      const found = doc?.operationIds?.includes(spec.operationId) ?? false;
      return {
        success: found,
        errors: found ? [] : [{ message: `operationId "${spec.operationId}" not found`, specId: spec.id, field: 'operationId' }],
        warnings: found ? [{ message: 'operation is documented', specId: spec.id }] : [],
      };
    },
  };

  protected coverageChecker: CoverageChecker<ApiSpec> = {
    targetModel: 'usecase',
    description: 'Every usecase is referenced by an API spec',
    check: (specs, registry): CoverageResult => {
      const targets = Array.from(registry.usecase?.keys() ?? []);
      const referenced = new Set(specs.map(s => s.operationId));
      const coveredItems = targets.filter(t => referenced.has(t)).map(id => ({ id }));
      const uncoveredItems = targets.filter(t => !referenced.has(t)).map(id => ({ id }));
      return {
        total: targets.length,
        covered: coveredItems.length,
        uncovered: uncoveredItems.length,
        coveragePercent: targets.length > 0
          ? Math.round((coveredItems.length / targets.length) * 100)
          : 100,
        coveredItems,
        uncoveredItems,
      };
    },
  };
}

class PlainModel extends Model<typeof ApiSpecSchema> {
  readonly id = 'plain-api';
  readonly name = 'PlainApi';
  readonly idPrefix = 'PA';
  readonly schema = ApiSpecSchema;
  protected lintRules: LintRule<ApiSpec>[] = [];
  protected exporters: Exporter<ApiSpec>[] = [];
}

const spec: ApiSpec = { id: 'CA-001', name: 'List users', operationId: 'listUsers' };

describe('FR-603: externalChecker on the Model class', () => {
  describe('FR-603-01: externalChecker is declared in the model definition', () => {
    it('FR-603-01 resolves the external source path from the declared checker', () => {
      expect(new CheckedModel().getExternalSourcePath(spec)).toBe('api/CA-001.openapi.yaml');
    });

    it('FR-603-01 resolves no source path for a model that declares no checker', () => {
      expect(new PlainModel().getExternalSourcePath(spec)).toBeNull();
    });
  });

  describe('FR-603-02: the declared check logic runs against the external data', () => {
    it('FR-603-02 returns the declared errors when the external data misses the spec', () => {
      const result = new CheckedModel().check(spec, { operationIds: ['createUser'] });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([
        { message: 'operationId "listUsers" not found', specId: 'CA-001', field: 'operationId' },
      ]);
    });

    it('FR-603-02 succeeds when the external data carries the spec', () => {
      const result = new CheckedModel().check(spec, { operationIds: ['listUsers'] });

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([{ message: 'operation is documented', specId: 'CA-001' }]);
    });

    it('FR-603-02 succeeds without running any check when no checker is declared', () => {
      expect(new PlainModel().check(spec, { operationIds: [] })).toEqual({
        success: true,
        errors: [],
        warnings: [],
      });
    });
  });
});

describe('FR-604: coverageChecker on the Model class', () => {
  describe('FR-604-02: coverageChecker is declared in the model definition', () => {
    it('FR-604-02 exposes the declared coverage checker with its target model', () => {
      const checker = new CheckedModel().getCoverageChecker();

      expect(checker?.targetModel).toBe('usecase');
      expect(checker?.description).toBe('Every usecase is referenced by an API spec');
    });

    it('FR-604-02 runs the declared checker against the model registry', () => {
      const registry = {
        usecase: new Map<string, unknown>([
          ['listUsers', { id: 'listUsers' }],
          ['deleteUser', { id: 'deleteUser' }],
        ]),
      };

      const result = new CheckedModel().checkCoverage([spec], registry);

      expect(result).toEqual({
        total: 2,
        covered: 1,
        uncovered: 1,
        coveragePercent: 50,
        coveredItems: [{ id: 'listUsers' }],
        uncoveredItems: [{ id: 'deleteUser' }],
      });
    });

    it('FR-604-02 reports no checker for a model that declares none', () => {
      expect(new PlainModel().getCoverageChecker()).toBeUndefined();
      expect(new PlainModel().checkCoverage([spec], {})).toBeNull();
    });
  });
});
