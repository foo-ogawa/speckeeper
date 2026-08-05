/**
 * Common lint items: ID uniqueness, reference integrity, orphan elements and
 * the phase gate, run over a whole design.
 */
import { describe, it, expect } from 'vitest';
import { runDesignLint, parsePhase, COMMON_LINT_RULES } from '../../src/core/design-lint.js';
import type { SpecEntry } from '../../src/core/model.js';
import { PhaseSchema, getPhaseIndex, isSlotUnresolved } from '../../src/types/common.js';
import { defineModel } from '../../src/core/config-api.js';
import { z } from 'zod';

function entry(modelId: string, data: unknown[]): SpecEntry {
  return { model: { id: modelId, register: () => {} }, data };
}

function issuesOf(results: ReturnType<typeof runDesignLint>, ruleId: string) {
  return results.filter(r => r.ruleId === ruleId);
}

describe('FR-101-01: every model element has a unique id', () => {
  it('FR-101-01 reports an id that more than one element declares', () => {
    const results = runDesignLint([
      entry('requirement', [{ id: 'FR-001' }]),
      entry('usecase', [{ id: 'FR-001' }]),
    ]);

    const duplicates = issuesOf(results, COMMON_LINT_RULES.idUnique);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].severity).toBe('error');
    expect(duplicates[0].specId).toBe('FR-001');
    expect(duplicates[0].message).toContain('requirement');
    expect(duplicates[0].message).toContain('usecase');
  });

  it('FR-101-01 reports a duplicate declared twice within one model', () => {
    const results = runDesignLint([
      entry('requirement', [{ id: 'FR-001' }, { id: 'FR-001' }, { id: 'FR-002' }]),
    ]);

    const duplicates = issuesOf(results, COMMON_LINT_RULES.idUnique);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].specId).toBe('FR-001');
  });

  it('FR-101-01 reports nothing when every id is distinct', () => {
    const results = runDesignLint([
      entry('requirement', [{ id: 'FR-001' }, { id: 'FR-002' }]),
      entry('usecase', [{ id: 'UC-001' }]),
    ]);

    expect(issuesOf(results, COMMON_LINT_RULES.idUnique)).toEqual([]);
  });
});

describe('FR-101-03: references are expressed by ID and checked for integrity', () => {
  it('FR-101-03 reports a relation whose target no model declares', () => {
    const results = runDesignLint([
      entry('requirement', [
        { id: 'FR-001', relations: [{ type: 'satisfies', target: 'UC-404' }] },
      ]),
      entry('usecase', [{ id: 'UC-001' }]),
    ]);

    const dangling = issuesOf(results, COMMON_LINT_RULES.refExists);
    expect(dangling).toHaveLength(1);
    expect(dangling[0].severity).toBe('error');
    expect(dangling[0].specId).toBe('FR-001');
    expect(dangling[0].message).toContain('UC-404');
  });

  it('FR-101-03 reports nothing when every relation target is declared', () => {
    const results = runDesignLint([
      entry('requirement', [
        { id: 'FR-001', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      ]),
      entry('usecase', [{ id: 'UC-001', relations: [{ type: 'relatedTo', target: 'FR-001' }] }]),
    ]);

    expect(issuesOf(results, COMMON_LINT_RULES.refExists)).toEqual([]);
  });
});

describe('FR-101-04: an id change surfaces every location that still references it', () => {
  it('FR-101-04 names every reference location left behind by an id change', () => {
    const before: SpecEntry[] = [
      entry('usecase', [{ id: 'UC-001' }]),
      entry('requirement', [
        { id: 'FR-001', relations: [{ type: 'satisfies', target: 'UC-001' }] },
        { id: 'FR-002', relations: [{ type: 'satisfies', target: 'UC-001' }] },
        { id: 'FR-003', relations: [{ type: 'satisfies', target: 'UC-001' }] },
      ]),
    ];
    expect(issuesOf(runDesignLint(before), COMMON_LINT_RULES.refExists)).toEqual([]);

    // UC-001 is renamed; the three requirements still point at the old id.
    const after: SpecEntry[] = [
      entry('usecase', [{ id: 'UC-002' }]),
      ...before.slice(1),
    ];

    const dangling = issuesOf(runDesignLint(after), COMMON_LINT_RULES.refExists);
    expect(dangling.map(d => d.specId).sort()).toEqual(['FR-001', 'FR-002', 'FR-003']);
    for (const issue of dangling) {
      expect(issue.message).toContain('UC-001');
    }
  });
});

describe('FR-401-06: orphan elements are detected', () => {
  it('FR-401-06 detects an element that takes part in no relation', () => {
    const results = runDesignLint([
      entry('entity', [
        { id: 'ENT-ORDER', relations: [{ type: 'relatedTo', target: 'ENT-ITEM' }] },
        { id: 'ENT-ITEM' },
        { id: 'ENT-LONELY' },
      ]),
    ]);

    const orphans = issuesOf(results, COMMON_LINT_RULES.orphan);
    expect(orphans.map(o => o.specId)).toEqual(['ENT-LONELY']);
    expect(orphans[0].message).toContain('entity');
  });

  it('FR-401-06 does not report an element that is only referenced by others', () => {
    const results = runDesignLint([
      entry('requirement', [{ id: 'FR-001', relations: [{ type: 'satisfies', target: 'UC-001' }] }]),
      entry('usecase', [{ id: 'UC-001' }]),
    ]);

    expect(issuesOf(results, COMMON_LINT_RULES.orphan)).toEqual([]);
  });

  it('FR-401-06 does not excuse an element whose only relation is dangling', () => {
    const results = runDesignLint([
      entry('requirement', [{ id: 'FR-001', relations: [{ type: 'satisfies', target: 'UC-404' }] }]),
    ]);

    expect(issuesOf(results, COMMON_LINT_RULES.orphan)).toEqual([]);
    expect(issuesOf(results, COMMON_LINT_RULES.refExists)).toHaveLength(1);
  });
});

describe('FR-102-01: phase is handled as REQ | HLD | LLD | OPS', () => {
  it('FR-102-01 accepts REQ, HLD, LLD and OPS and orders them', () => {
    for (const phase of ['REQ', 'HLD', 'LLD', 'OPS']) {
      expect(PhaseSchema.safeParse(phase).success).toBe(true);
    }

    expect(getPhaseIndex('REQ')).toBeLessThan(getPhaseIndex('HLD'));
    expect(getPhaseIndex('HLD')).toBeLessThan(getPhaseIndex('LLD'));
    expect(getPhaseIndex('LLD')).toBeLessThan(getPhaseIndex('OPS'));
  });

  it('FR-102-01 rejects a name that is not a phase instead of treating it as one', () => {
    expect(() => parsePhase('NOPE', '--phase')).toThrow(/Unknown phase "NOPE"/);
    expect(parsePhase('LLD', '--phase')).toBe('LLD');
  });
});

describe('FR-102-02: phase is set in the model definition and the phase gate is verified', () => {
  it('FR-102-02 keeps the phase set on a model definition and verifies the gate against it', () => {
    const model = defineModel({
      id: 'retry-policy',
      name: 'RetryPolicy',
      description: 'Retry policy definition',
      schema: z.object({ id: z.string(), name: z.string(), description: z.string() }),
      idPrefix: 'RETRY',
      phase: 'HLD',
    });
    expect(model.phase).toBe('HLD');

    const specs = [
      entry(model.id, [
        {
          id: 'RETRY-001',
          concretizationSlots: [{ field: 'maxAttempts', mustDecideBy: model.phase! }],
        },
      ]),
    ];

    expect(issuesOf(runDesignLint(specs, { phase: 'REQ' }), COMMON_LINT_RULES.phaseTbd)).toEqual([]);
    expect(issuesOf(runDesignLint(specs, { phase: 'HLD' }), COMMON_LINT_RULES.phaseTbd)).toHaveLength(1);
  });

  it('FR-102-02 reports no phase verdict when no gate phase is given', () => {
    const specs = [
      entry('requirement', [
        { id: 'FR-001', concretizationSlots: [{ field: 'timeout', mustDecideBy: 'REQ' }] },
      ]),
    ];

    expect(issuesOf(runDesignLint(specs), COMMON_LINT_RULES.phaseTbd)).toEqual([]);
  });
});

describe('FR-102-03: TBD is allowed or prohibited according to the phase', () => {
  const specs = [
    entry('requirement', [
      {
        id: 'FR-001',
        concretizationSlots: [{ field: 'retryLimit', mustDecideBy: 'LLD' }],
      },
    ]),
  ];

  it('FR-102-03 allows a TBD while the gate is before its deadline phase', () => {
    expect(issuesOf(runDesignLint(specs, { phase: 'REQ' }), COMMON_LINT_RULES.phaseTbd)).toEqual([]);
    expect(issuesOf(runDesignLint(specs, { phase: 'HLD' }), COMMON_LINT_RULES.phaseTbd)).toEqual([]);
  });

  it('FR-102-03 prohibits a TBD once the gate reaches its deadline phase', () => {
    const atDeadline = issuesOf(runDesignLint(specs, { phase: 'LLD' }), COMMON_LINT_RULES.phaseTbd);
    expect(atDeadline).toHaveLength(1);
    expect(atDeadline[0].severity).toBe('error');
    expect(atDeadline[0].specId).toBe('FR-001');
    expect(atDeadline[0].message).toContain('retryLimit');

    expect(issuesOf(runDesignLint(specs, { phase: 'OPS' }), COMMON_LINT_RULES.phaseTbd)).toHaveLength(1);
  });

  it('FR-102-03 treats a blank or literal TBD value as an unresolved slot', () => {
    expect(isSlotUnresolved({ field: 'a', mustDecideBy: 'REQ' })).toBe(true);
    expect(isSlotUnresolved({ field: 'a', mustDecideBy: 'REQ', value: null })).toBe(true);
    expect(isSlotUnresolved({ field: 'a', mustDecideBy: 'REQ', value: '  ' })).toBe(true);
    expect(isSlotUnresolved({ field: 'a', mustDecideBy: 'REQ', value: 'tbd' })).toBe(true);
    expect(isSlotUnresolved({ field: 'a', mustDecideBy: 'REQ', value: '3' })).toBe(false);
  });
});

describe('FR-401-05: no TBD remains at the specified phase', () => {
  it('FR-401-05 reports every slot left unresolved at the specified phase', () => {
    const specs = [
      entry('requirement', [
        {
          id: 'FR-001',
          concretizationSlots: [
            { field: 'timeout', mustDecideBy: 'REQ' },
            { field: 'retries', mustDecideBy: 'HLD', value: null },
            { field: 'backoff', mustDecideBy: 'HLD', value: 'exponential' },
            { field: 'shardCount', mustDecideBy: 'OPS' },
          ],
        },
        {
          id: 'FR-002',
          concretizationSlots: [{ field: 'cacheTtl', mustDecideBy: 'REQ' }],
        },
      ]),
    ];

    const issues = issuesOf(runDesignLint(specs, { phase: 'HLD' }), COMMON_LINT_RULES.phaseTbd);
    const reported = issues.map(i => `${i.specId}:${i.message.split(' leaves ')[1]?.split(' ')[0]}`).sort();
    expect(reported).toEqual(['FR-001:retries', 'FR-001:timeout', 'FR-002:cacheTtl']);
  });

  it('FR-401-05 reports nothing when every due slot carries a decided value', () => {
    const specs = [
      entry('requirement', [
        {
          id: 'FR-001',
          concretizationSlots: [
            { field: 'timeout', mustDecideBy: 'REQ', value: '30s' },
            { field: 'retries', mustDecideBy: 'HLD', value: '3' },
          ],
        },
      ]),
    ];

    expect(issuesOf(runDesignLint(specs, { phase: 'OPS' }), COMMON_LINT_RULES.phaseTbd)).toEqual([]);
  });
});
