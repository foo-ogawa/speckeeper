/**
 * Directory Entry Model Definition
 * 
 * Defines project directory structure and associates with Artifacts
 */
import { z } from 'zod';
import { Model } from '../../src/core/model.ts';
import type { LintRule, Exporter, ModelLevel } from '../../src/core/model.ts';

// ============================================================================
// Schema Definition
// ============================================================================

// Non-recursive part of the schema
const BaseDirectoryEntrySchema = z.object({
  id: z.string().regex(/^DIR-\d+$/, 'Directory ID must match pattern DIR-XXX'),
  path: z.string().min(1, 'Path is required'),
  description: z.string().min(1, 'Description is required'),
  artifactId: z.string().optional(),
  filePattern: z.string().optional(),
});

// ============================================================================
// Type Export (for specification authors)
// ============================================================================

// Derived from z.infer + recursive children
export type DirectoryEntry = z.infer<typeof BaseDirectoryEntrySchema> & {
  children?: DirectoryEntry[];
};

// Recursive schema (for validation)
export const DirectoryEntrySchema: z.ZodType<DirectoryEntry> = BaseDirectoryEntrySchema.extend({
  children: z.lazy(() => z.array(DirectoryEntrySchema)).optional(),
});

// ============================================================================
// Model Class (for CLI internal use)
// ============================================================================

class DirectoryEntryModel extends Model<typeof DirectoryEntrySchema> {
  readonly id = 'directory-entry';
  readonly name = 'DirectoryEntry';
  readonly idPrefix = 'DIR';
  readonly schema = DirectoryEntrySchema;
  readonly description = 'Defines directory structure';
  protected modelLevel: ModelLevel = 'L3';

  protected lintRules: LintRule<DirectoryEntry>[] = [
    {
      id: 'dir-path-ends-with-slash',
      severity: 'warning',
      message: 'Directory path should end with /',
      check: (spec) => !spec.path.endsWith('/') && !spec.filePattern,
    },
    {
      id: 'dir-has-artifact-or-children',
      severity: 'info',
      message: 'Directory should have artifactId or children',
      check: (spec) => !spec.artifactId && (!spec.children || spec.children.length === 0),
    },
  ];

  protected exporters: Exporter<DirectoryEntry>[] = [
    {
      format: 'markdown',
      index: (specs) => generateDirectoryTree(specs),
    },
  ];
}

// ============================================================================
// Directory Tree Generation
// ============================================================================

function generateDirectoryTree(entries: DirectoryEntry[]): string {
  const lines: string[] = [];
  lines.push('```');
  
  function renderEntry(entry: DirectoryEntry, indent: string, isLast: boolean): void {
    const prefix = isLast ? '└── ' : '├── ';
    const comment = entry.description ? `  # ${entry.description}` : '';
    lines.push(`${indent}${prefix}${entry.path}${comment}`);
    
    if (entry.children && entry.children.length > 0) {
      const childIndent = indent + (isLast ? '    ' : '│   ');
      entry.children.forEach((child, index) => {
        const childIsLast = index === entry.children!.length - 1;
        renderEntry(child, childIndent, childIsLast);
      });
    }
  }
  
  // Find root entries (those without parent)
  const rootEntries = entries.filter(e => !e.path.includes('/') || e.path.split('/').filter(Boolean).length === 1);
  
  rootEntries.forEach((entry, index) => {
    const isLast = index === rootEntries.length - 1;
    renderEntry(entry, '', isLast);
  });
  
  lines.push('```');
  return lines.join('\n');
}

// Singleton instance
export { DirectoryEntryModel };

// ============================================================================
// Helper Functions (for specification instance operations)
// ============================================================================

export function getAllDirectoryEntries(entries: DirectoryEntry[]): DirectoryEntry[] {
  const result: DirectoryEntry[] = [];
  
  function collect(items: DirectoryEntry[]): void {
    for (const item of items) {
      result.push(item);
      if (item.children) {
        collect(item.children);
      }
    }
  }
  
  collect(entries);
  return result;
}

export function getDirectoryById(entries: DirectoryEntry[], id: string): DirectoryEntry | undefined {
  return getAllDirectoryEntries(entries).find(d => d.id === id);
}

export function getDirectoryByArtifact(entries: DirectoryEntry[], artifactId: string): DirectoryEntry | undefined {
  return getAllDirectoryEntries(entries).find(d => d.artifactId === artifactId);
}

export function generateDirectoryTreeMarkdown(entries: DirectoryEntry[]): string {
  const lines: string[] = [];
  
  function renderEntry(entry: DirectoryEntry, indent: string, isLast: boolean): void {
    const prefix = indent === '' ? '' : (isLast ? '└── ' : '├── ');
    const comment = entry.description ? `  # ${entry.description}` : '';
    lines.push(`${indent}${prefix}${entry.path}${comment}`);
    
    if (entry.children && entry.children.length > 0) {
      const childIndent = indent === '' ? '' : indent + (isLast ? '    ' : '│   ');
      entry.children.forEach((child, index) => {
        const childIsLast = index === entry.children!.length - 1;
        renderEntry(child, childIndent, childIsLast);
      });
    }
  }
  
  for (const entry of entries) {
    renderEntry(entry, '', false);
    lines.push('');
  }
  
  return lines.join('\n');
}
