/**
 * The review gate: lint items read from the records alone.
 *
 * No LLM is called and no credential is needed. The judge signature is only
 * resolved (through the runtime's model resolver) when `judgeChange` asks for
 * judge changes to be reported or to make records stale.
 */
import { relative } from 'node:path';
import type { LintResult } from '../core/model.js';
import { loadRuntime } from '../agents/orchestrator.js';
import { changedInputs, planReview, type ReviewSetup } from './checks.js';
import type { Packet } from './packet.js';
import { resolveJudgeSignature } from './judge.js';
import type { JudgeSignature, JudgmentRecord } from './record.js';
import type { ReviewRegistry } from './types.js';

export const REVIEW_LINT_RULES = {
  /** A declared target has no record, or its record is stale */
  stale: 'REVIEW-001',
  /** A record holds an open finding of a blocking severity */
  openFindings: 'REVIEW-002',
  /** A record's check is no longer declared or its target no longer selected */
  orphanRecord: 'REVIEW-003',
  /** A record was judged by another adapter or model than the configured one */
  judgeChange: 'REVIEW-004',
} as const;

export async function runReviewGate(setup: ReviewSetup, registry: ReviewRegistry): Promise<LintResult[]> {
  const runtime = setup.gate.judgeChange === 'ignore' ? undefined : await loadRuntime();
  const adapter = setup.config.adapter ?? 'claude';
  const plan = await planReview(setup, registry, runtime
    ? check => resolveJudgeSignature(runtime, adapter, undefined, check, process.env)
    : undefined);

  const results: LintResult[] = [];
  const { gate } = setup;

  for (const planned of plan.targets) {
    const specId = planned.target.specIds.length === 1 ? planned.target.specIds[0] : undefined;
    const label = `review check "${planned.check.id}", target ${planned.target.id}`;

    if (planned.state !== 'fresh' && gate.stale !== 'off') {
      results.push({
        ruleId: REVIEW_LINT_RULES.stale,
        severity: gate.stale,
        message: planned.record
          ? `${label}: the record is stale (${staleReason(planned.record, planned.packet)}); run "speckeeper review" or "speckeeper review rebaseline"`
          : `${label}: no judgment is recorded; run "speckeeper review"`,
        specId,
      });
    }

    if (planned.judgeChanged && planned.record && planned.currentJudge && gate.judgeChange === 'warning') {
      results.push({
        ruleId: REVIEW_LINT_RULES.judgeChange,
        severity: 'warning',
        message: `${label}: judged by ${describeJudge(planned.record.judge)}, the configured judge is ${describeJudge(planned.currentJudge)}`,
        specId,
      });
    }

    if (gate.openFindings !== 'off') {
      for (const finding of planned.record?.findings ?? []) {
        if (finding.status !== 'open' || !gate.blocking.includes(finding.severity)) continue;
        results.push({
          ruleId: REVIEW_LINT_RULES.openFindings,
          severity: gate.openFindings,
          message: `${label}: open ${finding.severity} finding [${finding.code}] ${finding.message}`,
          specId: finding.subject?.split('#')[0] ?? specId,
        });
      }
    }
  }

  for (const orphan of plan.orphans) {
    results.push({
      ruleId: REVIEW_LINT_RULES.orphanRecord,
      severity: 'warning',
      message: `review record ${relative(setup.rootDir, orphan.path)} belongs to a check or target that is no longer declared; run "speckeeper review --prune"`,
    });
  }

  return results;
}

/** Why a record is stale for a packet, from its per-input hashes */
export function staleReason(record: JudgmentRecord, packet: Packet): string {
  if (record.packetHash === packet.hash) return 'the judge changed';
  const changed = changedInputs(record, packet);
  if (changed.length === 0) return 'the packet changed (its layout, not an input)';
  return changed.map(c => `${c.input} ${c.from === null ? 'added' : c.to === null ? 'removed' : 'changed'}`).join(', ');
}

function describeJudge(judge: JudgeSignature): string {
  return [judge.adapter, judge.model, judge.verifyModel && `verify ${judge.verifyModel}`].filter(Boolean).join(' / ');
}
