/**
 * Term Model Definition
 */
import { z } from 'zod';
import { Model, RelationSchema } from 'speckeeper';
import type { LintRule, Exporter, ModelLevel } from 'speckeeper';

// =============================================================================
// Schema Definition
// =============================================================================

export const TermSchema = z.object({
  id: z.string(),
  term: z.string(),
  definition: z.string(),
  category: z.enum(['business', 'technical', 'acronym', 'process', 'role']),
  abbreviation: z.string().optional(),
  expandedForm: z.string().optional(),
  relations: z.array(RelationSchema).optional(),
});

// =============================================================================
// Type Export
// =============================================================================

export type Term = z.input<typeof TermSchema>;

// =============================================================================
// Model Class
// =============================================================================

class TermModel extends Model<typeof TermSchema> {
  readonly id = 'term';
  readonly name = 'Term';
  readonly idPrefix = 'TERM';
  readonly schema = TermSchema;
  readonly description = 'Defines terms (glossary)';
  protected modelLevel: ModelLevel = 'L0';

  protected lintRules: LintRule<Term>[] = [
    {
      id: 'term-has-definition',
      severity: 'error',
      message: 'Term must have a definition',
      check: (spec) => !spec.definition || spec.definition.trim() === '',
    },
    {
      id: 'term-acronym-has-expanded-form',
      severity: 'warning',
      message: 'Acronym terms should have an expanded form',
      check: (spec) => spec.category === 'acronym' && !spec.expandedForm,
    },
  ];

  protected exporters: Exporter<Term>[] = [];
}

export { TermModel };
