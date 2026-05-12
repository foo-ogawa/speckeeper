/**
 * speckeeper CLI Commands - CLI Command Specifications
 */
import type { CLICommand } from './_models/cli-command.ts';
import { CLICommandModel } from './_models/cli-command.ts';
import { defineSpecs } from '../src/core/model';

// ============================================================================
// All Commands
// ============================================================================

export const commands: CLICommand[] = [
  // speckeeper build - Generation command
  {
    id: 'CMD-BUILD',
    name: 'build',
    description: 'Generate human-readable (docs/) and machine-readable (specs/) artifacts from TS models',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'option', name: 'config', alias: 'c', type: 'path', description: 'Path to config file', required: false },
      { kind: 'option', name: 'output', alias: 'o', type: 'path', description: 'Output directory base path', required: false, default: '.' },
      { kind: 'option', name: 'format', alias: 'f', type: 'enum', description: 'Output format', required: false, choices: ['markdown', 'json', 'both'], default: 'both' },
      { kind: 'option', name: 'watch', alias: 'w', type: 'boolean', description: 'Watch file changes and auto-regenerate', required: false, default: false },
      { kind: 'option', name: 'verbose', alias: 'v', type: 'boolean', description: 'Show detailed output', required: false, default: false },
    ],
    subCommands: [],
    relatedRequirements: ['FR-300', 'FR-301', 'FR-302'],
    examples: ['speckeeper build', 'speckeeper build --output ./dist', 'speckeeper build --format markdown', 'speckeeper build --watch'],
    exitCodes: [{ code: 0, description: 'Success' }, { code: 1, description: 'Generation error' }],
    ciStep: { enabled: true, order: 2, description: 'Generate docs/specs' },
  },

  // speckeeper lint - Validation command
  {
    id: 'CMD-LINT',
    name: 'lint',
    description: 'Validate TS model consistency and integrity',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'option', name: 'config', alias: 'c', type: 'path', description: 'Path to config file', required: false },
      { kind: 'option', name: 'phase', alias: 'p', type: 'enum', description: 'Phase gate (prohibit TBD at specified phase)', required: false, choices: ['REQ', 'HLD', 'LLD', 'OPS'] },
      { kind: 'option', name: 'strict', alias: 's', type: 'boolean', description: 'Strict mode (treat warnings as errors)', required: false, default: false },
      { kind: 'option', name: 'fix', type: 'boolean', description: 'Fix auto-fixable issues', required: false, default: false },
      { kind: 'option', name: 'format', alias: 'f', type: 'enum', description: 'Output format', required: false, choices: ['text', 'json', 'github'], default: 'text' },
    ],
    subCommands: [],
    relatedRequirements: ['FR-400', 'FR-401', 'FR-402'],
    examples: ['speckeeper lint', 'speckeeper lint --phase LLD', 'speckeeper lint --strict', 'speckeeper lint --format json'],
    exitCodes: [{ code: 0, description: 'No issues' }, { code: 1, description: 'Errors found' }, { code: 2, description: 'Warnings found (in strict mode)' }],
    ciStep: { enabled: true, order: 1, description: 'Design consistency' },
  },

  // speckeeper drift - Drift check command
  {
    id: 'CMD-DRIFT',
    name: 'drift',
    description: 'Detect differences between generated docs/specs/ and committed files',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'option', name: 'config', alias: 'c', type: 'path', description: 'Path to config file', required: false },
      { kind: 'option', name: 'update', alias: 'u', type: 'boolean', description: 'Auto-update if differences exist', required: false, default: false },
      { kind: 'option', name: 'format', alias: 'f', type: 'enum', description: 'Output format', required: false, choices: ['text', 'json', 'diff'], default: 'text' },
    ],
    subCommands: [],
    relatedRequirements: ['FR-500'],
    examples: ['speckeeper drift', 'speckeeper drift --update', 'speckeeper drift --format diff'],
    exitCodes: [{ code: 0, description: 'No differences' }, { code: 1, description: 'Differences found (manual edits detected)' }],
    ciStep: { enabled: true, order: 3, description: 'Detect manual edits to artifacts' },
  },

  // speckeeper check - External SSOT consistency check command
  {
    id: 'CMD-CHECK',
    name: 'check',
    description: 'Check consistency with external SSOT (OpenAPI/DDL/IaC)',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'argument', name: 'type', type: 'string', description: 'Type of check: external-ssot, openapi, ddl, iac, custom, all, test', required: false },
      { kind: 'option', name: 'config', alias: 'c', type: 'path', description: 'Path to config file', required: false },
      { kind: 'option', name: 'strict', type: 'boolean', description: 'Treat warnings as errors', required: false, default: false },
      { kind: 'option', name: 'verbose', alias: 'v', type: 'boolean', description: 'Show detailed output', required: false, default: false },
      { kind: 'option', name: 'coverage', type: 'boolean', description: 'Check if all testable acceptance criteria are covered by TestRefs', required: false, default: false },
    ],
    subCommands: [
      {
        name: 'openapi',
        description: 'Check consistency with OpenAPI specification',
        parameters: [
          { kind: 'option', name: 'path', alias: 'p', type: 'path', description: 'OpenAPI file path', required: false, example: './api/openapi.yaml' },
        ],
        examples: ['speckeeper check openapi', 'speckeeper check openapi --path ./api/spec.yaml'],
      },
      {
        name: 'ddl',
        description: 'Check consistency with DDL/Schema',
        parameters: [
          { kind: 'option', name: 'path', alias: 'p', type: 'path', description: 'Schema file path', required: false, example: './db/schema.prisma' },
          { kind: 'option', name: 'type', alias: 't', type: 'enum', description: 'Schema type', required: false, choices: ['ddl', 'prisma', 'typeorm', 'drizzle'] },
        ],
        examples: ['speckeeper check ddl', 'speckeeper check ddl --path ./db/schema.prisma --type prisma'],
      },
      {
        name: 'iac',
        description: 'Check consistency with IaC (CloudFormation/Terraform)',
        parameters: [
          { kind: 'option', name: 'path', alias: 'p', type: 'path', description: 'IaC file path', required: false, example: './infra/template.yaml' },
          { kind: 'option', name: 'type', alias: 't', type: 'enum', description: 'IaC type', required: false, choices: ['cloudformation', 'cdk', 'terraform'] },
        ],
        examples: ['speckeeper check iac', 'speckeeper check iac --path ./infra/main.tf --type terraform'],
      },
      {
        name: 'external-ssot',
        description: 'Check consistency with all external SSOTs',
        parameters: [],
        examples: ['speckeeper check external-ssot'],
      },
      {
        name: 'test',
        description: 'Check consistency between test files and requirements',
        parameters: [
          { kind: 'option', name: 'with-results', type: 'boolean', description: 'Also validate test result JSON', required: false, default: false },
          { kind: 'option', name: 'requirement', alias: 'r', type: 'string', description: 'Check only specific requirement ID', required: false },
          { kind: 'option', name: 'coverage', type: 'boolean', description: 'Verify TestRef coverage for acceptanceCriteria (verificationMethod: test)', required: false, default: false },
        ],
        examples: [
          'speckeeper check test',
          'speckeeper check test --with-results',
          'speckeeper check test --requirement FR-101',
          'speckeeper check test --coverage',
        ],
      },
      {
        name: 'contract',
        description: 'Check consistency between implementation and contract (type definitions/schema)',
        parameters: [
          { kind: 'option', name: 'path', alias: 'p', type: 'path', description: 'Contract package path', required: false, example: './packages/contract' },
        ],
        examples: ['speckeeper check contract', 'speckeeper check contract --path ./packages/contract'],
      },
    ],
    relatedRequirements: ['FR-600', 'FR-601', 'FR-602', 'FR-603'],
    examples: ['speckeeper check openapi', 'speckeeper check ddl', 'speckeeper check iac', 'speckeeper check external-ssot', 'speckeeper check contract'],
    exitCodes: [{ code: 0, description: 'Consistency OK' }, { code: 1, description: 'Consistency error' }, { code: 2, description: 'External SSOT file not found' }],
    ciStep: { enabled: true, order: 4, description: 'External SSOT consistency check', subCommand: 'external-ssot' },
  },

  // speckeeper init - Project initialization command
  {
    id: 'CMD-INIT',
    name: 'init',
    description: 'Initialize a new speckeeper project with starter templates',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'option', name: 'force', alias: 'f', type: 'boolean', description: 'Overwrite existing files', required: false, default: false },
    ],
    subCommands: [],
    relatedRequirements: ['FR-105'],
    examples: ['speckeeper init', 'speckeeper init --force'],
    exitCodes: [{ code: 0, description: 'Initialization successful' }, { code: 1, description: 'Initialization error' }],
  },

  // speckeeper new - Element creation command
  {
    id: 'CMD-NEW',
    name: 'new',
    description: 'Create a new element with auto-generated ID',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'argument', name: 'type', type: 'string', description: 'Type: requirement, usecase, entity, component, screen, flow, error-case, term', required: true },
      { kind: 'option', name: 'kind', alias: 'k', type: 'string', description: 'Sub-kind (e.g., functional, non-functional for requirements)', required: false },
      { kind: 'option', name: 'name', alias: 'n', type: 'string', description: 'Name of the element', required: false },
      { kind: 'option', name: 'output', alias: 'o', type: 'path', description: 'Output directory path', required: false },
      { kind: 'option', name: 'template', alias: 't', type: 'path', description: 'Path to template file', required: false },
    ],
    subCommands: [],
    relatedRequirements: ['FR-104'],
    examples: ['speckeeper new requirement --kind functional --name "User Login"'],
    exitCodes: [{ code: 0, description: 'Element created' }, { code: 1, description: 'Creation error' }],
  },

  // speckeeper scaffold - Scaffold command
  {
    id: 'CMD-SCAFFOLD',
    name: 'scaffold',
    description: 'Generate _models/ from a mermaid flowchart definition',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'option', name: 'source', alias: 's', type: 'path', description: 'Path to Markdown file containing mermaid flowchart', required: true },
      { kind: 'option', name: 'output', alias: 'o', type: 'path', description: 'Output directory', required: false, default: 'design/' },
      { kind: 'option', name: 'force', alias: 'f', type: 'boolean', description: 'Overwrite existing files', required: false, default: false },
      { kind: 'option', name: 'dry-run', type: 'boolean', description: 'Preview generated files without writing', required: false, default: false },
    ],
    subCommands: [],
    relatedRequirements: ['FR-106'],
    examples: ['speckeeper scaffold --source requirements.md', 'speckeeper scaffold -s spec.md --dry-run'],
    exitCodes: [{ code: 0, description: 'Scaffold successful' }, { code: 1, description: 'Scaffold error' }],
  },

  // speckeeper audit-requirements - LLM-based requirement quality audit
  {
    id: 'CMD-AUDIT-REQ',
    name: 'audit-requirements',
    description: 'Semantic requirement quality audit via LLM (verifiability, ambiguity, granularity, terminology, design-mixing)',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'option', name: 'config', alias: 'c', type: 'path', description: 'Path to config file', required: false },
      { kind: 'option', name: 'adapter', alias: 'a', type: 'enum', description: 'SDK adapter for LLM execution', required: false, choices: ['cursor', 'claude', 'openai', 'gemini', 'mock'] },
      { kind: 'option', name: 'model', type: 'string', description: 'LLM model override', required: false },
      { kind: 'option', name: 'dry-run', alias: 'n', type: 'boolean', description: 'Output constructed prompt without calling LLM', required: false, default: false },
      { kind: 'option', name: 'fail-on', type: 'enum', description: 'Minimum severity for non-zero exit', required: false, choices: ['warning', 'error', 'critical'], default: 'error' },
      { kind: 'option', name: 'output', alias: 'o', type: 'path', description: 'Write result to file instead of stdout', required: false },
      { kind: 'option', name: 'report-format', type: 'enum', description: 'Output format for audit report', required: false, choices: ['json', 'text', 'yaml'], default: 'json' },
      { kind: 'option', name: 'show-prompt', type: 'boolean', description: 'Display constructed LLM prompt on stderr', required: false, default: false },
    ],
    subCommands: [],
    relatedRequirements: ['FR-1100'],
    examples: ['speckeeper audit-requirements', 'speckeeper audit-requirements --adapter openai --dry-run', 'speckeeper audit-requirements --report-format json --output audit.json'],
    exitCodes: [{ code: 0, description: 'No blocking findings' }, { code: 1, description: 'Unexpected error' }, { code: 2, description: 'Configuration or input error' }, { code: 10, description: 'Completed with blocking findings' }, { code: 11, description: 'Runtime dependency missing' }, { code: 12, description: 'LLM provider or adapter error' }],
  },

  // speckeeper propose-trace-links - LLM-based traceability link proposal
  {
    id: 'CMD-PROPOSE-TRACE',
    name: 'propose-trace-links',
    description: 'Propose candidate traceability links between specs with confidence scores and rationale',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'option', name: 'config', alias: 'c', type: 'path', description: 'Path to config file', required: false },
      { kind: 'option', name: 'adapter', alias: 'a', type: 'enum', description: 'SDK adapter for LLM execution', required: false, choices: ['cursor', 'claude', 'openai', 'gemini', 'mock'] },
      { kind: 'option', name: 'model', type: 'string', description: 'LLM model override', required: false },
      { kind: 'option', name: 'dry-run', alias: 'n', type: 'boolean', description: 'Output constructed prompt without calling LLM', required: false, default: false },
      { kind: 'option', name: 'fail-on', type: 'enum', description: 'Minimum severity for non-zero exit', required: false, choices: ['warning', 'error', 'critical'], default: 'error' },
      { kind: 'option', name: 'output', alias: 'o', type: 'path', description: 'Write result to file instead of stdout', required: false },
      { kind: 'option', name: 'report-format', type: 'enum', description: 'Output format for report', required: false, choices: ['json', 'text', 'yaml'], default: 'json' },
      { kind: 'option', name: 'show-prompt', type: 'boolean', description: 'Display constructed LLM prompt on stderr', required: false, default: false },
    ],
    subCommands: [],
    relatedRequirements: ['FR-1101'],
    examples: ['speckeeper propose-trace-links', 'speckeeper propose-trace-links --adapter claude --report-format json', 'speckeeper propose-trace-links --dry-run'],
    exitCodes: [{ code: 0, description: 'No blocking findings' }, { code: 1, description: 'Unexpected error' }, { code: 2, description: 'Configuration or input error' }, { code: 10, description: 'Completed with blocking findings' }, { code: 11, description: 'Runtime dependency missing' }, { code: 12, description: 'LLM provider or adapter error' }],
  },

  // speckeeper explain-impact - LLM-based explanation of impact analysis output
  {
    id: 'CMD-EXPLAIN-IMPACT',
    name: 'explain-impact',
    description: 'Translate impact analysis JSON (from stdin) into human-readable explanation for PM/executive audiences',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'option', name: 'config', alias: 'c', type: 'path', description: 'Path to config file', required: false },
      { kind: 'option', name: 'adapter', alias: 'a', type: 'enum', description: 'SDK adapter for LLM execution', required: false, choices: ['cursor', 'claude', 'openai', 'gemini', 'mock'] },
      { kind: 'option', name: 'model', type: 'string', description: 'LLM model override', required: false },
      { kind: 'option', name: 'dry-run', alias: 'n', type: 'boolean', description: 'Output constructed prompt without calling LLM', required: false, default: false },
      { kind: 'option', name: 'fail-on', type: 'enum', description: 'Minimum severity for non-zero exit', required: false, choices: ['warning', 'error', 'critical'], default: 'error' },
      { kind: 'option', name: 'output', alias: 'o', type: 'path', description: 'Write result to file instead of stdout', required: false },
      { kind: 'option', name: 'report-format', type: 'enum', description: 'Output format for report', required: false, choices: ['json', 'text', 'yaml'], default: 'json' },
      { kind: 'option', name: 'show-prompt', type: 'boolean', description: 'Display constructed LLM prompt on stderr', required: false, default: false },
    ],
    subCommands: [],
    relatedRequirements: ['FR-1102'],
    examples: ['speckeeper impact FR-001 --format json | speckeeper explain-impact', 'speckeeper impact ENT-ORDER --format json | speckeeper explain-impact --adapter claude'],
    exitCodes: [{ code: 0, description: 'Explanation completed' }, { code: 1, description: 'Unexpected error' }, { code: 2, description: 'Configuration or input error' }, { code: 3, description: 'No input on stdin' }, { code: 10, description: 'Completed with blocking findings' }, { code: 11, description: 'Runtime dependency missing' }, { code: 12, description: 'LLM provider or adapter error' }],
  },

  // speckeeper propose-acceptance-criteria - LLM-based acceptance criteria proposal
  {
    id: 'CMD-PROPOSE-AC',
    name: 'propose-acceptance-criteria',
    description: 'Propose testable acceptance criteria in Given/When/Then format for specified specs',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'argument', name: 'specIds', type: 'string', description: 'Spec IDs to propose criteria for (defaults to all)', required: false },
      { kind: 'option', name: 'config', alias: 'c', type: 'path', description: 'Path to config file', required: false },
      { kind: 'option', name: 'adapter', alias: 'a', type: 'enum', description: 'SDK adapter for LLM execution', required: false, choices: ['cursor', 'claude', 'openai', 'gemini', 'mock'] },
      { kind: 'option', name: 'model', type: 'string', description: 'LLM model override', required: false },
      { kind: 'option', name: 'dry-run', alias: 'n', type: 'boolean', description: 'Output constructed prompt without calling LLM', required: false, default: false },
      { kind: 'option', name: 'fail-on', type: 'enum', description: 'Minimum severity for non-zero exit', required: false, choices: ['warning', 'error', 'critical'], default: 'error' },
      { kind: 'option', name: 'output', alias: 'o', type: 'path', description: 'Write result to file instead of stdout', required: false },
      { kind: 'option', name: 'report-format', type: 'enum', description: 'Output format for report', required: false, choices: ['json', 'text', 'yaml'], default: 'json' },
      { kind: 'option', name: 'show-prompt', type: 'boolean', description: 'Display constructed LLM prompt on stderr', required: false, default: false },
    ],
    subCommands: [],
    relatedRequirements: ['FR-1103'],
    examples: ['speckeeper propose-acceptance-criteria', 'speckeeper propose-acceptance-criteria FR-001 FR-002', 'speckeeper propose-acceptance-criteria --adapter gemini --dry-run'],
    exitCodes: [{ code: 0, description: 'No blocking findings' }, { code: 1, description: 'Unexpected error' }, { code: 2, description: 'Configuration or input error' }, { code: 10, description: 'Completed with blocking findings' }, { code: 11, description: 'Runtime dependency missing' }, { code: 12, description: 'LLM provider or adapter error' }],
  },

  // speckeeper convert - Format conversion command
  {
    id: 'CMD-CONVERT',
    name: 'convert',
    description: 'Convert a TS spec data file to YAML format',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'argument', name: 'file', type: 'path', description: 'Path to TS spec data file', required: true },
      { kind: 'option', name: 'output', alias: 'o', type: 'path', description: 'Output file path (default: same name with .yaml extension)', required: false },
      { kind: 'option', name: 'dry-run', alias: 'n', type: 'boolean', description: 'Preview conversion without writing', required: false, default: false },
    ],
    subCommands: [],
    relatedRequirements: ['FR-1104'],
    examples: ['speckeeper convert design/glossary.ts', 'speckeeper convert design/requirements.ts --output reqs.yaml', 'speckeeper convert design/glossary.ts --dry-run'],
    exitCodes: [{ code: 0, description: 'Conversion successful' }, { code: 1, description: 'Conversion error' }],
  },

  // speckeeper impact - Impact analysis command
  {
    id: 'CMD-IMPACT',
    name: 'impact',
    description: 'Analyze the change impact scope of a specified ID',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'argument', name: 'id', type: 'string', description: 'ID to analyze', required: true, example: 'REQ-001' },
      { kind: 'option', name: 'config', alias: 'c', type: 'path', description: 'Path to config file', required: false },
      { kind: 'option', name: 'depth', alias: 'd', type: 'number', description: 'Analysis depth (reference tracking level)', required: false, default: 3 },
      { kind: 'option', name: 'direction', type: 'enum', description: 'Analysis direction', required: false, choices: ['upstream', 'downstream', 'both'], default: 'both' },
      { kind: 'option', name: 'format', alias: 'f', type: 'enum', description: 'Output format', required: false, choices: ['text', 'json', 'mermaid'], default: 'text' },
    ],
    subCommands: [],
    relatedRequirements: ['FR-700', 'FR-701'],
    examples: ['speckeeper impact REQ-001', 'speckeeper impact ENT-ORDER --depth 5', 'speckeeper impact COMP-API --direction downstream', 'speckeeper impact UC-001 --format mermaid'],
    exitCodes: [{ code: 0, description: 'Analysis successful' }, { code: 1, description: 'Target ID not found' }],
  },
];

export default defineSpecs(
  [CLICommandModel.instance, commands],
);
