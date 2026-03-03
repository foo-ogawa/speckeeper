#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'node:module';
import { buildCommand } from './build.js';
import { lintCommand } from './lint.js';
import { driftCommand } from './drift.js';
import { checkCommand } from './check.js';
import { newCommand } from './new.js';
import { impactCommand } from './impact.js';
import { runInit } from './init.js';
import { scaffoldCommand } from './scaffold.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

const program = new Command();

program
  .name('speckeeper')
  .description('Requirements and design management framework with TypeScript DSL')
  .version(pkg.version);

// Build command
// Spec: design/cli-commands.ts CMD-BUILD
program
  .command('build')
  .description('Generate docs/ and specs/ from TypeScript models')
  .option('-c, --config <path>', 'Path to config file')
  .option('-o, --output <path>', 'Base output directory path', '.')
  .option('-f, --format <format>', 'Output format: markdown, json, both', 'both')
  .option('-w, --watch', 'Watch for changes and auto-regenerate')
  .option('-v, --verbose', 'Show detailed output')
  .action(buildCommand);

// Lint command
// Spec: design/cli-commands.ts CMD-LINT
program
  .command('lint')
  .description('Check design integrity (ID duplicates, references, layer violations, etc.)')
  .option('-c, --config <path>', 'Path to config file')
  .option('-p, --phase <phase>', 'Phase gate to check against (REQ, HLD, LLD, OPS)')
  .option('-s, --strict', 'Treat warnings as errors')
  .option('--fix', 'Attempt to fix auto-fixable issues')
  .option('-f, --format <format>', 'Output format: text, json, github', 'text')
  .action(lintCommand);

// Drift command
// Spec: design/cli-commands.ts CMD-DRIFT
program
  .command('drift')
  .description('Check if generated files have been manually edited')
  .option('-c, --config <path>', 'Path to config file')
  .option('-u, --update', 'Auto-update if differences are found')
  .option('-f, --format <format>', 'Output format: text, json, diff', 'text')
  .action(driftCommand);

// Check command
// Spec: design/cli-commands.ts CMD-CHECK
program
  .command('check')
  .description('Check external SSOT conformance (including custom models)')
  .argument('[type]', 'Type of check: external-ssot, openapi, ddl, iac, custom, all, test')
  .option('-c, --config <path>', 'Path to config file')
  .option('--strict', 'Treat warnings as errors')
  .option('-v, --verbose', 'Show detailed output')
  .option('--coverage', 'Check if all testable acceptance criteria are covered by TestRefs')
  .action(checkCommand);

// New command
// Spec: design/cli-commands.ts CMD-NEW
program
  .command('new')
  .description('Create a new element with auto-generated ID')
  .argument('<type>', 'Type: requirement, usecase, entity, component, screen, flow, error-case, term')
  .option('-k, --kind <kind>', 'Sub-kind (e.g., functional, non-functional for requirements)')
  .option('-n, --name <name>', 'Name of the element')
  .option('-o, --output <path>', 'Output directory path')
  .option('-t, --template <path>', 'Path to template file')
  .action(newCommand);

// Impact command
// Spec: design/cli-commands.ts CMD-IMPACT
program
  .command('impact')
  .description('Analyze impact of changes to an ID')
  .argument('<id>', 'ID to analyze (e.g., REQ-001, ENT-ORDER)')
  .option('-c, --config <path>', 'Path to config file')
  .option('-d, --depth <depth>', 'Analysis depth (reference tracking level)', '3')
  .option('--direction <direction>', 'Analysis direction: upstream, downstream, both', 'both')
  .option('-f, --format <format>', 'Output format: text, json, mermaid', 'text')
  .action(impactCommand);

// Init command
program
  .command('init')
  .description('Initialize a new speckeeper project with starter templates')
  .option('-f, --force', 'Overwrite existing files')
  .action(runInit);

// Scaffold command
program
  .command('scaffold')
  .description('Generate _models/ and _checkers/ from a mermaid flowchart definition')
  .requiredOption('-s, --source <path>', 'Path to Markdown file containing mermaid flowchart')
  .option('-o, --output <path>', 'Output directory (default: design/)')
  .option('-f, --force', 'Overwrite existing files')
  .option('--dry-run', 'Preview generated files without writing')
  .action(scaffoldCommand);

// Parse arguments
program.parse();
