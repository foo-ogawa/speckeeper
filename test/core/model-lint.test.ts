/**
 * FR-104-03: model-specific lint rules declared on the Model class
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Model } from '../../src/core/model.js';
import { requireField } from '../../src/core/dsl/index.js';
import type { LintRule, ModelLevel } from '../../src/core/model.js';

const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string(),
  estimate: z.number(),
});

type Task = z.infer<typeof TaskSchema>;

class LintedModel extends Model<typeof TaskSchema> {
  readonly id = 'linted-task';
  readonly name = 'LintedTask';
  readonly idPrefix = 'LT';
  readonly schema = TaskSchema;
  protected modelLevel: ModelLevel = 'L1';

  protected lintRules: LintRule<Task>[] = [
    requireField<Task>('owner', 'error'),
    {
      id: 'estimate-is-positive',
      severity: 'warning',
      message: 'Estimate must be greater than zero',
      check: (spec) => spec.estimate <= 0,
    },
    {
      id: 'name-is-short',
      severity: 'info',
      message: 'Name should stay under 20 characters',
      check: (spec) => spec.name.length >= 20,
    },
  ];
}

class UnlintedModel extends Model<typeof TaskSchema> {
  readonly id = 'unlinted-task';
  readonly name = 'UnlintedTask';
  readonly idPrefix = 'UT';
  readonly schema = TaskSchema;
}

const clean: Task = { id: 'LT-001', name: 'Ship it', owner: 'ogawa', estimate: 3 };

describe('FR-104-03: model-specific lint rules', () => {
  it('FR-104-03 exposes every lint rule declared in the model definition', () => {
    const rules = new LintedModel().getLintRules();

    expect(rules.map(r => r.id)).toEqual([
      'has-owner',
      'estimate-is-positive',
      'name-is-short',
    ]);
    expect(rules.map(r => r.severity)).toEqual(['error', 'warning', 'info']);
  });

  it('FR-104-03 runs the declared rules and reports the violated ones only', () => {
    const spec: Task = { id: 'LT-002', name: 'Ship it', owner: '', estimate: 0 };

    expect(new LintedModel().lint(spec)).toEqual([
      {
        ruleId: 'has-owner',
        severity: 'error',
        message: 'owner must not be empty',
        specId: 'LT-002',
      },
      {
        ruleId: 'estimate-is-positive',
        severity: 'warning',
        message: 'Estimate must be greater than zero',
        specId: 'LT-002',
      },
    ]);
  });

  it('FR-104-03 reports nothing for a spec that satisfies every declared rule', () => {
    expect(new LintedModel().lint(clean)).toEqual([]);
  });

  it('FR-104-03 runs the declared rules across every spec', () => {
    const specs: Task[] = [
      clean,
      { id: 'LT-003', name: 'A name that is definitely too long', owner: 'ogawa', estimate: 5 },
      { id: 'LT-004', name: 'Late', owner: 'ogawa', estimate: -1 },
    ];

    expect(new LintedModel().lintAll(specs)).toEqual([
      {
        ruleId: 'name-is-short',
        severity: 'info',
        message: 'Name should stay under 20 characters',
        specId: 'LT-003',
      },
      {
        ruleId: 'estimate-is-positive',
        severity: 'warning',
        message: 'Estimate must be greater than zero',
        specId: 'LT-004',
      },
    ]);
  });

  it('FR-104-03 reports nothing for a model that declares no rules', () => {
    const unlinted = new UnlintedModel();

    expect(unlinted.getLintRules()).toEqual([]);
    expect(unlinted.lintAll([clean, { ...clean, owner: '', estimate: 0 }])).toEqual([]);
  });
});
