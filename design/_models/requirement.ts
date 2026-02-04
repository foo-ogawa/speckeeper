/**
 * Requirement Model Definition
 */
import { z } from 'zod';
import { Model, RelationSchema } from '../../src/core/model.ts';
import type { LintRule, Exporter, CoverageChecker, CoverageResult, ModelLevel, Renderer, RenderContext } from '../../src/core/model.ts';

// ============================================================================
// Schema Definition
// ============================================================================

export const RequirementTypeSchema = z.enum([
  'functional',
  'non-functional',
  'constraint',
]);

/**
 * Example/Sample schema
 */
export const RequirementExampleSchema = z.object({
  /** Sample language (typescript, bash, mermaid, etc.) */
  language: z.string().optional(),
  /** Sample code */
  code: z.string(),
  /** Sample description */
  description: z.string().optional(),
});

/**
 * Acceptance Criteria Schema
 * ID is parent requirement ID with sequence number (e.g., FR-101-01, FR-101-02)
 */
export const AcceptanceCriteriaSchema = z.object({
  /** Acceptance criteria ID (e.g., FR-101-01) */
  id: z.string(),
  /** Acceptance criteria description */
  description: z.string(),
  /** Verification method (optional) */
  verificationMethod: z.enum(['test', 'review', 'demo', 'inspection']).optional(),
});

export const RequirementSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  type: RequirementTypeSchema,
  priority: z.enum(['must', 'should', 'could']),
  rationale: z.string().optional(),
  acceptanceCriteria: z.array(AcceptanceCriteriaSchema).min(1),
  category: z.string().optional(),
  /** Parent requirement ID (for hierarchy) */
  parentId: z.string().optional(),
  /** Usage examples/samples */
  examples: z.array(RequirementExampleSchema).optional(),
  /** Supplementary information (tables, lists, additional notes) */
  notes: z.string().optional(),
  /** References to related external documents */
  seeAlso: z.array(z.object({
    label: z.string(),
    href: z.string(),
  })).optional(),
  /** Inter-model relation */
  relations: z.array(RelationSchema).optional(),
});

// ============================================================================
// Type Export
// ============================================================================

export type RequirementType = z.infer<typeof RequirementTypeSchema>;
export type AcceptanceCriteria = z.infer<typeof AcceptanceCriteriaSchema>;
export type Requirement = z.input<typeof RequirementSchema>;

// ============================================================================
// Model Class
// ============================================================================

class RequirementModel extends Model<typeof RequirementSchema> {
  readonly id = 'requirement';
  readonly name = 'Requirement';
  readonly idPrefix = 'REQ';
  readonly schema = RequirementSchema;
  readonly description = 'Defines functional requirements, non-functional requirements, and constraints';
  protected modelLevel: ModelLevel = 'L1';

  protected lintRules: LintRule<Requirement>[] = [
    {
      id: 'req-acceptance-not-empty',
      severity: 'error',
      message: 'Requirement must have at least one acceptance criteria',
      check: (spec) => !spec.acceptanceCriteria || spec.acceptanceCriteria.length === 0,
    },
    {
      id: 'req-acceptance-id-format',
      severity: 'warning',
      message: 'Acceptance criteria ID should follow parent requirement ID (e.g., FR-101-01)',
      check: (spec) => {
        if (!spec.acceptanceCriteria) return false;
        return spec.acceptanceCriteria.some(ac => !ac.id.startsWith(spec.id + '-'));
      },
    },
    {
      id: 'req-id-format',
      severity: 'warning',
      message: 'Requirement ID should follow naming convention (e.g., FR-001, NFR-002, CR-001)',
      check: (spec) => !/^(FR|NFR|CR)-\d{3}$/.test(spec.id),
    },
    {
      id: 'req-has-rationale',
      severity: 'info',
      message: 'Requirement should have a rationale',
      check: (spec) => !spec.rationale || spec.rationale.trim() === '',
    },
  ];

  protected exporters: Exporter<Requirement>[] = [
    {
      format: 'markdown',
      single: (spec) => {
        const lines: string[] = [];
        lines.push(`# ${spec.name}`);
        lines.push('');
        lines.push(`**ID**: ${spec.id}`);
        lines.push(`**Type**: ${spec.type}`);
        lines.push(`**Priority**: ${spec.priority}`);
        if (spec.category) lines.push(`**Category**: ${spec.category}`);
        lines.push('');
        lines.push('## Description');
        lines.push('');
        lines.push(spec.description);
        lines.push('');
        if (spec.rationale) {
          lines.push('## Rationale');
          lines.push('');
          lines.push(spec.rationale);
          lines.push('');
        }
        lines.push('## Acceptance Criteria');
        lines.push('');
        for (const ac of spec.acceptanceCriteria) {
          const method = ac.verificationMethod ? ` [${ac.verificationMethod}]` : '';
          lines.push(`- **${ac.id}**: ${ac.description}${method}`);
        }
        return lines.join('\n');
      },
      index: (specs) => {
        const lines: string[] = [];
        lines.push('# Requirements');
        lines.push('');
        const byType = new Map<string, Requirement[]>();
        for (const spec of specs) {
          const list = byType.get(spec.type) || [];
          list.push(spec);
          byType.set(spec.type, list);
        }
        const typeLabels: Record<string, string> = {
          'functional': 'Functional Requirements',
          'non-functional': 'Non-Functional Requirements',
          'constraint': 'Constraints',
        };
        for (const [type, typeSpecs] of Array.from(byType.entries())) {
          lines.push(`## ${typeLabels[type] || type}`);
          lines.push('');
          lines.push('| ID | Name | Priority | Category |');
          lines.push('|----|------|----------|----------|');
          for (const spec of typeSpecs) {
            lines.push(`| [${spec.id}](./${spec.id}.md) | ${spec.name} | ${spec.priority} | ${spec.category || '-'} |`);
          }
          lines.push('');
        }
        return lines.join('\n');
      },
      outputDir: 'requirements',
      filename: (spec) => spec.id,
    },
  ];

  /**
   * Coverage Checker
   * 
   * Verifies that all UseCases are satisfied by Requirement relations
   */
  protected coverageChecker: CoverageChecker<Requirement> = {
    targetModel: 'usecase',
    description: 'Verifies UseCases are satisfied by Requirements',
    check: (specs, registry): CoverageResult => {
      const useCases = registry.useCases;
      if (!useCases) {
        return { total: 0, covered: 0, uncovered: 0, coveragePercent: 100, coveredItems: [], uncoveredItems: [] };
      }

      // Get list of UseCase IDs
      interface UseCaseSpec { id: string; name: string }
      const allUseCaseIds = new Set<string>();
      const useCaseMap = new Map<string, UseCaseSpec>();
      for (const uc of useCases.values() as IterableIterator<UseCaseSpec>) {
        allUseCaseIds.add(uc.id);
        useCaseMap.set(uc.id, uc);
      }

      // Collect UseCases satisfied via Requirement.relations
      const satisfiedUseCaseIds = new Set<string>();
      for (const req of specs) {
        if (!req.relations) continue;
        for (const rel of req.relations) {
          if (rel.type === 'satisfies' && rel.target.startsWith('UC-')) {
            satisfiedUseCaseIds.add(rel.target);
          }
        }
      }

      // Determine coverage
      const coveredItems: CoverageResult['coveredItems'] = [];
      const uncoveredItems: CoverageResult['uncoveredItems'] = [];
      for (const ucId of allUseCaseIds) {
        const uc = useCaseMap.get(ucId);
        if (satisfiedUseCaseIds.has(ucId)) {
          coveredItems.push({ id: ucId, description: uc?.name });
        } else {
          uncoveredItems.push({ id: ucId, description: uc?.name });
        }
      }

      const total = allUseCaseIds.size;
      const covered = coveredItems.length;
      const uncovered = uncoveredItems.length;
      const coveragePercent = total > 0 ? Math.round((covered / total) * 100) : 100;

      return { total, covered, uncovered, coveragePercent, coveredItems, uncoveredItems };
    },
  };

  // ============================================================================
  // Renderers (for embeds)
  // ============================================================================

  protected renderers: Renderer<Requirement>[] = [
    {
      format: 'table',
      render: (specs, ctx) => renderTable(specs, ctx),
    },
    {
      format: 'list',
      render: (specs, _ctx) => renderList(specs),
    },
    {
      format: 'detail',
      render: (specs, _ctx) => specs.length > 0 ? renderDetail(specs[0]) : '*No matching requirement found*',
    },
    {
      format: 'summary',
      render: (specs, _ctx) => renderSummary(specs),
    },
    {
      format: 'spec-section',
      render: (specs, _ctx) => renderSpecSection(specs),
    },
  ];
}

export { RequirementModel };

// ============================================================================
// Rendering Helper Functions
// ============================================================================

function priorityLabel(priority: unknown): string {
  switch (priority) {
    case 'must': return 'Must';
    case 'should': return 'Should';
    case 'could': return 'Could';
    default: return String(priority);
  }
}

function typeLabel(type: unknown): string {
  switch (type) {
    case 'functional': return 'Functional';
    case 'non-functional': return 'Non-functional';
    case 'constraint': return 'Constraint';
    default: return String(type);
  }
}

function getTypeFolder(type: string): string {
  switch (type) {
    case 'functional': return 'functional';
    case 'non-functional': return 'non-functional';
    case 'constraint': return 'constraints';
    default: return 'functional';
  }
}

/**
 * Table format
 */
function renderTable(reqs: Requirement[], ctx: RenderContext): string {
  const columnsParam = ctx.params.columns;
  const defaultColumns = ['id', 'name', 'priority', 'type'];
  const columns = columnsParam ? columnsParam.split(',').map(c => c.trim()) : defaultColumns;
  
  const columnLabels: Record<string, string> = {
    id: 'ID',
    name: 'Name',
    description: 'Description',
    priority: 'Priority',
    type: 'Type',
    category: 'Category',
    rationale: 'Rationale',
  };
  
  const headers = columns.map(c => columnLabels[c] || c);
  const rows = reqs.map(r => columns.map(col => {
    const value = (r as Record<string, unknown>)[col];
    if (col === 'id') {
      return `[${value}](./requirements/${getTypeFolder(r.type)}/${value}.md)`;
    }
    if (col === 'priority') {
      return priorityLabel(value);
    }
    if (col === 'type') {
      return typeLabel(value);
    }
    return value || '-';
  }));
  
  return ctx.markdown.table(headers, rows);
}

/**
 * List format
 */
function renderList(reqs: Requirement[]): string {
  const lines = reqs.map(r => 
    `- **${r.id}**: ${r.name} (${priorityLabel(r.priority)})`
  );
  return lines.join('\n');
}

/**
 * Detail format (single item)
 */
function renderDetail(req: Requirement): string {
  const lines = [
    `### ${req.id}: ${req.name}`,
    '',
    `**Type**: ${typeLabel(req.type)}`,
    `**Priority**: ${priorityLabel(req.priority)}`,
    '',
    '#### Description',
    req.description,
    '',
  ];
  
  if (req.rationale) {
    lines.push('#### Rationale', req.rationale, '');
  }
  
  if (req.acceptanceCriteria.length > 0) {
    lines.push('#### Acceptance Criteria');
    for (const ac of req.acceptanceCriteria) {
      const method = ac.verificationMethod ? ` [${ac.verificationMethod}]` : '';
      lines.push(`- **${ac.id}**: ${ac.description}${method}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Summary format
 */
function renderSummary(reqs: Requirement[]): string {
  const functional = reqs.filter(r => r.type === 'functional').length;
  const nonFunctional = reqs.filter(r => r.type === 'non-functional').length;
  const constraint = reqs.filter(r => r.type === 'constraint').length;
  
  const lines = [
    `- **Functional Requirements**: ${functional}`,
    `- **Non-functional Requirements**: ${nonFunctional}`,
    `- **Constraints**: ${constraint}`,
    `- **Total**: ${reqs.length}`,
  ];
  return lines.join('\n');
}

/**
 * Specification section format (output requirements for specific category)
 */
function renderSpecSection(reqs: Requirement[]): string {
  const lines: string[] = [];
  
  // Get top-level requirements
  const topLevel = reqs.filter(r => !r.parentId);
  
  for (const req of topLevel) {
    lines.push(...renderRequirementSection(req, reqs));
  }
  
  return lines.join('\n');
}

/**
 * Render requirement section (recursively processing child requirements)
 */
function renderRequirementSection(req: Requirement, allReqs: Requirement[]): string[] {
  const lines: string[] = [];
  const children = allReqs.filter(r => r.parentId === req.id);
  
  if (children.length > 0) {
    // Parent requirement description
    if (req.description && req.description !== req.name) {
      lines.push(req.description);
      lines.push('');
    }
    
    // Output child requirements
    for (const child of children) {
      lines.push(`#### ${child.id}: ${child.name}`);
      lines.push('');
      lines.push(child.description);
      lines.push('');
      
      // Acceptance criteria
      if (child.acceptanceCriteria.length > 0) {
        for (const ac of child.acceptanceCriteria) {
          const method = ac.verificationMethod ? ` [${ac.verificationMethod}]` : '';
          lines.push(`- **${ac.id}**: ${ac.description}${method}`);
        }
        lines.push('');
      }
      
      // Supplementary information (notes)
      if (child.notes) {
        lines.push(child.notes);
        lines.push('');
      }
      
      // Examples
      if (child.examples && child.examples.length > 0) {
        for (const example of child.examples) {
          if (example.description) {
            lines.push(`**${example.description}**`);
            lines.push('');
          }
          lines.push('```' + (example.language || ''));
          lines.push(example.code);
          lines.push('```');
          lines.push('');
        }
      }
      
      // Related links (seeAlso)
      if (child.seeAlso && child.seeAlso.length > 0) {
        lines.push('> ' + child.seeAlso.map(s => `[${s.label}](${s.href})`).join(' | '));
        lines.push('');
      }
    }
  } else {
    // Output standalone when no child requirements
    lines.push(req.description);
    lines.push('');
    
    // Acceptance criteria
    if (req.acceptanceCriteria.length > 0) {
      for (const ac of req.acceptanceCriteria) {
        const method = ac.verificationMethod ? ` [${ac.verificationMethod}]` : '';
        lines.push(`- **${ac.id}**: ${ac.description}${method}`);
      }
      lines.push('');
    }
    
    // Supplementary information (notes)
    if (req.notes) {
      lines.push(req.notes);
      lines.push('');
    }
    
    // Usage examples (examples)
    if (req.examples && req.examples.length > 0) {
      for (const example of req.examples) {
        if (example.description) {
          lines.push(`**${example.description}**`);
          lines.push('');
        }
        lines.push('```' + (example.language || ''));
        lines.push(example.code);
        lines.push('```');
        lines.push('');
      }
    }
    
    // Related links (seeAlso)
    if (req.seeAlso && req.seeAlso.length > 0) {
      lines.push('> ' + req.seeAlso.map(s => `[${s.label}](${s.href})`).join(' | '));
      lines.push('');
    }
  }
  
  return lines;
}
