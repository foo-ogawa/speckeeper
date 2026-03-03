/**
 * speckeeper CLI Commands - CLI Command Specifications
 */
import type { CLICommand } from './_models/cli-command.ts';
import { CLICommandModel } from './_models/cli-command.ts';
import { defineSpecs } from '../src/core/model.ts';

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
      { kind: 'option', name: 'output', alias: 'o', type: 'path', description: 'Output directory base path', required: false, default: '.' },
      { kind: 'option', name: 'format', alias: 'f', type: 'enum', description: 'Output format', required: false, choices: ['markdown', 'json', 'both'], default: 'both' },
      { kind: 'option', name: 'watch', alias: 'w', type: 'boolean', description: 'Watch file changes and auto-regenerate', required: false, default: false },
      { kind: 'option', name: 'verbose', alias: 'v', type: 'boolean', description: 'Show detailed output', required: false, default: false },
    ],
    subCommands: [],
    relatedRequirements: ['FR-001', 'FR-002', 'FR-003', 'FR-004', 'FR-005'],
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
      { kind: 'option', name: 'phase', alias: 'p', type: 'enum', description: 'Phase gate (prohibit TBD at specified phase)', required: false, choices: ['REQ', 'HLD', 'LLD', 'OPS'] },
      { kind: 'option', name: 'strict', alias: 's', type: 'boolean', description: 'Strict mode (treat warnings as errors)', required: false, default: false },
      { kind: 'option', name: 'fix', type: 'boolean', description: 'Fix auto-fixable issues', required: false, default: false },
      { kind: 'option', name: 'format', alias: 'f', type: 'enum', description: 'Output format', required: false, choices: ['text', 'json', 'github'], default: 'text' },
    ],
    subCommands: [],
    relatedRequirements: ['FR-010', 'FR-011', 'FR-012'],
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
      { kind: 'option', name: 'update', alias: 'u', type: 'boolean', description: 'Auto-update if differences exist', required: false, default: false },
      { kind: 'option', name: 'format', alias: 'f', type: 'enum', description: 'Output format', required: false, choices: ['text', 'json', 'diff'], default: 'text' },
    ],
    subCommands: [],
    relatedRequirements: ['FR-020'],
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
    parameters: [],
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
    relatedRequirements: ['FR-030', 'FR-031', 'FR-032', 'FR-033', 'FR-034'],
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

  // speckeeper impact - Impact analysis command
  {
    id: 'CMD-IMPACT',
    name: 'impact',
    description: 'Analyze the change impact scope of a specified ID',
    componentId: 'COMP-CLI',
    globalParameters: [],
    parameters: [
      { kind: 'argument', name: 'id', type: 'string', description: 'ID to analyze', required: true, example: 'REQ-001' },
      { kind: 'option', name: 'depth', alias: 'd', type: 'number', description: 'Analysis depth (reference tracking level)', required: false, default: 3 },
      { kind: 'option', name: 'direction', type: 'enum', description: 'Analysis direction', required: false, choices: ['upstream', 'downstream', 'both'], default: 'both' },
      { kind: 'option', name: 'format', alias: 'f', type: 'enum', description: 'Output format', required: false, choices: ['text', 'json', 'mermaid'], default: 'text' },
    ],
    subCommands: [],
    relatedRequirements: [],
    examples: ['speckeeper impact REQ-001', 'speckeeper impact ENT-ORDER --depth 5', 'speckeeper impact COMP-API --direction downstream', 'speckeeper impact UC-001 --format mermaid'],
    exitCodes: [{ code: 0, description: 'Analysis successful' }, { code: 1, description: 'Target ID not found' }],
  },
];

export default defineSpecs(
  [CLICommandModel.instance, commands],
);
