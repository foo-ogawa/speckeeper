#!/usr/bin/env node

import { register } from 'tsx/esm/api';
register();

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProgram, type CommandHandlers } from '../generated/program.js';
import { buildCommand } from './build.js';
import { lintCommand } from './lint.js';
import { driftCommand } from './drift.js';
import { checkCommand } from './check.js';
import { newCommand } from './new.js';
import { impactCommand } from './impact.js';
import { runInit } from './init.js';
import { runConvert } from './convert.js';
import { scaffoldCommand } from './scaffold.js';
import { commandAuditRequirements } from './audit-requirements.js';
import { commandProposeTraceLinks } from './propose-trace-links.js';
import { commandExplainImpact } from './explain-impact-result.js';
import { commandProposeAcceptanceCriteria } from './propose-acceptance-criteria.js';
import { resolvedDsl } from '../generated/dsl/index.js';
import type { InitOptions } from './init.js';
import type { BuildCommandOptions } from './build.js';
import type { LintCommandOptions } from './lint.js';
import type { DriftCommandOptions } from './drift.js';
import type { CheckCommandOptions } from './check.js';
import type { ImpactCommandOptions } from './impact.js';
import type { ScaffoldCommandOptions } from './scaffold.js';

function getVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const handlers: CommandHandlers = {
  init: async (opts) => {
    await runInit(opts as InitOptions);
  },
  build: async (opts) => {
    await buildCommand(opts as BuildCommandOptions);
  },
  lint: async (opts) => {
    await lintCommand(opts as LintCommandOptions);
  },
  drift: async (opts) => {
    await driftCommand(opts as DriftCommandOptions);
  },
  check: async (type, opts) => {
    await checkCommand(type, opts as CheckCommandOptions);
  },
  new: async (type, opts) => {
    await newCommand({ type, output: opts.output, dryRun: opts.dryRun });
  },
  impact: async (id, opts) => {
    await impactCommand(id!, opts as ImpactCommandOptions);
  },
  scaffold: async (opts) => {
    await scaffoldCommand(opts as ScaffoldCommandOptions);
  },
  convert: async (file, opts) => {
    await runConvert(file!, opts);
  },
  auditRequirements: (opts) =>
    commandAuditRequirements({
      config: opts.config,
      adapter: opts.adapter,
      model: opts.model,
      showPrompt: opts.showPrompt,
      failOn: opts.failOn as 'warning' | 'error' | 'critical' | undefined,
      output: opts.output,
      reportFormat: opts.reportFormat as 'json' | 'text' | 'yaml' | undefined,
    }),
  proposeTraceLinks: (opts) =>
    commandProposeTraceLinks({
      config: opts.config,
      adapter: opts.adapter,
      model: opts.model,
      showPrompt: opts.showPrompt,
      failOn: opts.failOn as 'warning' | 'error' | 'critical' | undefined,
      output: opts.output,
      reportFormat: opts.reportFormat as 'json' | 'text' | 'yaml' | undefined,
    }),
  explainImpact: (opts) =>
    commandExplainImpact({
      adapter: opts.adapter,
      model: opts.model,
      showPrompt: opts.showPrompt,
      failOn: opts.failOn as 'warning' | 'error' | 'critical' | undefined,
      output: opts.output,
      reportFormat: opts.reportFormat as 'json' | 'text' | 'yaml' | undefined,
    }),
  proposeAcceptanceCriteria: (specIds, opts) =>
    commandProposeAcceptanceCriteria(specIds, {
      config: opts.config,
      adapter: opts.adapter,
      model: opts.model,
      showPrompt: opts.showPrompt,
      failOn: opts.failOn as 'warning' | 'error' | 'critical' | undefined,
      output: opts.output,
      reportFormat: opts.reportFormat as 'json' | 'text' | 'yaml' | undefined,
    }),
  agents: async (opts) => {
    const YAML = await import('yaml');
    const format = opts.format ?? 'yaml';
    try {
      if (format === 'json') {
        console.log(JSON.stringify(resolvedDsl, null, 2));
      } else {
        console.log(YAML.stringify(resolvedDsl, { lineWidth: 120 }));
      }
    } catch (err) {
      console.error(`Failed to output DSL: ${(err as Error).message}`);
      process.exit(1);
    }
  },
};

createProgram(handlers, getVersion()).parse();
