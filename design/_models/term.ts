/**
 * Term Model Definition
 */
import { z } from 'zod';
import { Model, RelationSchema } from '../../src/core/model.ts';
import type { LintRule, Exporter, ModelLevel, Renderer, RenderContext } from '../../src/core/model.ts';
import { requireField } from '../../src/core/dsl/index.ts';

// ============================================================================
// Schema Definition
// ============================================================================

export const TermCategorySchema = z.enum([
  'business', 'technical', 'acronym', 'process', 'role',
  'status', 'entity', 'core', 'model', 'contract', 'integration',
]);

export const ChildTermSchema = z.object({
  term: z.string(),
  englishTerm: z.string().optional(),
  definition: z.string(),
});

export const TermSchema = z.object({
  id: z.string(),
  term: z.string(),
  englishTerm: z.string().optional(),
  definition: z.string(),
  category: TermCategorySchema,
  synonyms: z.array(z.object({
    term: z.string(),
    preferred: z.boolean().optional().default(false),
    context: z.string().optional(),
  })).optional().default([]),
  relatedTerms: z.array(z.string()).optional().default([]),
  relatedEntityId: z.string().optional(),
  abbreviation: z.string().optional(),
  expandedForm: z.string().optional(),
  translations: z.array(z.object({
    language: z.string(),
    term: z.string(),
    definition: z.string().optional(),
  })).optional().default([]),
  examples: z.array(z.string()).optional().default([]),
  deprecated: z.boolean().optional().default(false),
  deprecatedAlternative: z.string().optional(),
  tags: z.array(z.string()).optional(),
  children: z.array(ChildTermSchema).optional(),
  /** Inter-model relation */
  relations: z.array(RelationSchema).optional(),
});

// ============================================================================
// Type Export
// ============================================================================

export type TermCategory = z.infer<typeof TermCategorySchema>;
export type ChildTerm = z.infer<typeof ChildTermSchema>;
export type Term = z.input<typeof TermSchema>;

// ============================================================================
// Model Class
// ============================================================================

class TermModel extends Model<typeof TermSchema> {
  readonly id = 'term';
  readonly name = 'Term';
  readonly idPrefix = 'TERM';
  readonly schema = TermSchema;
  readonly description = 'Defines terms (glossary)';
  protected modelLevel: ModelLevel = 'L0';

  protected lintRules: LintRule<Term>[] = [
    requireField<Term>('definition', 'error'),
    {
      id: 'term-acronym-has-expanded-form',
      severity: 'warning',
      message: 'Acronym terms should have an expanded form',
      check: (spec) => spec.category === 'acronym' && !spec.expandedForm,
    },
  ];

  protected exporters: Exporter<Term>[] = [
    {
      format: 'markdown',
      single: (spec) => {
        const lines: string[] = [];
        lines.push(`# ${spec.term}`);
        lines.push('');
        lines.push(`**ID**: ${spec.id}`);
        lines.push(`**Category**: ${spec.category}`);
        if (spec.abbreviation) lines.push(`**Abbreviation**: ${spec.abbreviation}`);
        if (spec.expandedForm) lines.push(`**Expanded Form**: ${spec.expandedForm}`);
        lines.push('');
        lines.push('## Definition');
        lines.push('');
        lines.push(spec.definition);
        lines.push('');
        return lines.join('\n');
      },
      index: (specs) => {
        const lines: string[] = [];
        lines.push('# Glossary');
        lines.push('');
        const sorted = [...specs].sort((a, b) => a.term.localeCompare(b.term));
        for (const spec of sorted) {
          lines.push(`- **${spec.term}**: ${spec.definition}`);
        }
        return lines.join('\n');
      },
      outputDir: 'glossary',
      filename: (spec) => spec.id,
    },
  ];

  // ============================================================================
  // Renderers (for embeds)
  // ============================================================================

  protected renderers: Renderer<Term>[] = [
    {
      format: 'table',
      render: (specs, ctx) => renderTable(specs, ctx),
    },
    {
      format: 'spec-terms',
      render: (specs, _ctx) => renderSpecTerms(specs),
    },
    {
      format: 'definition-list',
      render: (specs, _ctx) => renderDefinitionList(specs),
    },
  ];
}

export { TermModel };

// ============================================================================
// Rendering Helper Functions
// ============================================================================

/**
 * Term definition format for specifications
 */
function renderSpecTerms(terms: Term[]): string {
  const lines: string[] = [];
  
  for (const term of terms) {
    if (term.category === 'acronym') {
      continue;
    }
    
    let termDisplay = term.term;
    if (term.englishTerm) {
      termDisplay = `${term.term}（${term.englishTerm}）`;
    }
    
    const line = `- **${termDisplay}**: ${term.definition}`;
    lines.push(line);
    
    if (term.children && term.children.length > 0) {
      for (const child of term.children) {
        let childTermDisplay = child.term;
        if (child.englishTerm) {
          childTermDisplay = `${child.term}（${child.englishTerm}）`;
        }
        lines.push(`  - **${childTermDisplay}**: ${child.definition}`);
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * Table format
 */
function renderTable(terms: Term[], ctx: RenderContext): string {
  const headers = ['Term', 'English Name', 'Definition', 'Category'];
  const rows = terms.map(t => [
    t.abbreviation ? `${t.abbreviation} (${t.expandedForm})` : t.term,
    t.englishTerm || '-',
    t.definition.slice(0, 80) + (t.definition.length > 80 ? '...' : ''),
    t.category,
  ]);
  
  return ctx.markdown.table(headers, rows);
}

/**
 * Definition list format
 */
function renderDefinitionList(terms: Term[]): string {
  const lines: string[] = [];
  
  for (const term of terms) {
    let title: string;
    if (term.abbreviation) {
      title = `**${term.abbreviation}** (${term.expandedForm})`;
    } else if (term.englishTerm) {
      title = `**${term.term}** (${term.englishTerm})`;
    } else {
      title = `**${term.term}**`;
    }
    
    lines.push(title);
    lines.push(`  : ${term.definition}`);
    
    if (term.children && term.children.length > 0) {
      for (const child of term.children) {
        const childTitle = child.englishTerm 
          ? `**${child.term}** (${child.englishTerm})`
          : `**${child.term}**`;
        lines.push(`  - ${childTitle}: ${child.definition}`);
      }
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}
