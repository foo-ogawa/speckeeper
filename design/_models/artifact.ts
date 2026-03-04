/**
 * Artifact Model Definition
 * 
 * Defines artifacts managed by speckeeper (SSOT/human-readable/machine-readable)
 */
import { z } from 'zod';
import { Model } from '../../src/core/model.ts';
import type { LintRule, Exporter, ModelLevel, Renderer, RenderContext } from '../../src/core/model.ts';
import { requireField } from '../../src/core/dsl/index.ts';

// ============================================================================
// Schema Definition
// ============================================================================

export const ArtifactCategorySchema = z.enum(['ssot', 'human-readable', 'machine-readable', 'implementation']);

export const ArtifactSchema = z.object({
  id: z.string().regex(/^ART-\d+$/, 'Artifact ID must match pattern ART-XXX'),
  name: z.string().min(1, 'Name is required'),
  category: ArtifactCategorySchema,
  location: z.string().min(1, 'Location is required'),
  purpose: z.string().min(1, 'Purpose is required'),
  driftTarget: z.boolean().default(false),
  generatedFrom: z.string().optional(),
});

// ============================================================================
// Type Export (for specification authors)
// ============================================================================

export type Artifact = z.infer<typeof ArtifactSchema>;
export type ArtifactCategory = z.infer<typeof ArtifactCategorySchema>;

// ============================================================================
// Model Class (for CLI internal use)
// ============================================================================

class ArtifactModel extends Model<typeof ArtifactSchema> {
  readonly id = 'artifact';
  readonly name = 'Artifact';
  readonly idPrefix = 'ART';
  readonly schema = ArtifactSchema;
  readonly description = 'Defines artifacts (docs/, specs/)';
  protected modelLevel: ModelLevel = 'L3';

  protected lintRules: LintRule<Artifact>[] = [
    requireField<Artifact>('purpose', 'error'),
    {
      id: 'artifact-id-format',
      severity: 'error',
      message: 'Artifact ID should follow naming convention (ART-XXX)',
      check: (spec) => !/^ART-\d+$/.test(spec.id),
    },
    {
      id: 'artifact-generated-from-valid',
      severity: 'warning',
      message: 'Generated artifacts should reference a valid source',
      check: (spec) => !!(spec.generatedFrom && !spec.generatedFrom.startsWith('ART-')),
    },
  ];

  protected exporters: Exporter<Artifact>[] = [
    {
      format: 'markdown',
      single: (spec) => {
        const lines: string[] = [];
        lines.push(`# ${spec.name}`);
        lines.push('');
        lines.push(`**ID**: ${spec.id}`);
        lines.push(`**Category**: ${spec.category}`);
        lines.push(`**Location**: \`${spec.location}\``);
        lines.push(`**Drift Target**: ${spec.driftTarget ? 'Yes' : 'No'}`);
        if (spec.generatedFrom) {
          lines.push(`**Generated From**: ${spec.generatedFrom}`);
        }
        lines.push('');

        lines.push('## Purpose');
        lines.push('');
        lines.push(spec.purpose);
        lines.push('');

        return lines.join('\n');
      },
      index: (specs) => {
        const lines: string[] = [];
        lines.push('# Artifacts');
        lines.push('');

        const categoryLabels: Record<string, string> = {
          'ssot': 'SSOT (Single Source of Truth)',
          'human-readable': 'Human-readable artifacts',
          'machine-readable': 'Machine-readable artifacts',
          'implementation': 'Implementation code',
        };

        const byCategory = new Map<string, Artifact[]>();
        for (const spec of specs) {
          const list = byCategory.get(spec.category) || [];
          list.push(spec);
          byCategory.set(spec.category, list);
        }

        for (const [category, categorySpecs] of Array.from(byCategory.entries())) {
          lines.push(`## ${categoryLabels[category] || category}`);
          lines.push('');
          lines.push('| ID | Name | Location | Purpose | Drift Target |');
          lines.push('|----|------|----------|---------|--------------|');
          for (const spec of categorySpecs) {
            lines.push(`| ${spec.id} | ${spec.name} | \`${spec.location}\` | ${spec.purpose} | ${spec.driftTarget ? 'Yes' : 'No'} |`);
          }
          lines.push('');
        }

        return lines.join('\n');
      },
      outputDir: 'artifacts',
      filename: (spec) => spec.id,
    },
  ];

  // ============================================================================
  // Renderers (for embeds)
  // ============================================================================

  protected renderers: Renderer<Artifact>[] = [
    {
      format: 'table',
      render: (specs, ctx) => renderArtifactTable(specs, ctx),
    },
    {
      format: 'list',
      render: (specs, _ctx) => renderArtifactList(specs),
    },
  ];
}

// Singleton instance
export { ArtifactModel };

// ============================================================================
// Rendering Helper Functions
// ============================================================================

/**
 * Artifact table format
 */
function renderArtifactTable(items: Artifact[], ctx: RenderContext): string {
  const columnsParam = ctx.params.columns;
  const defaultColumns = ['category', 'location', 'purpose', 'drift'];
  const columns = columnsParam ? columnsParam.split(',').map(c => c.trim()) : defaultColumns;
  
  const columnLabels: Record<string, string> = {
    id: 'ID',
    name: 'Name',
    category: 'Category',
    location: 'Location',
    purpose: 'Purpose',
    drift: 'Drift target',
  };
  
  const headers = columns.map(c => columnLabels[c] || c);
  const rows = items.map(a => columns.map(col => {
    switch (col) {
      case 'category':
        return `**${categoryLabels[a.category]}**`;
      case 'location':
        return `\`${a.location}\``;
      case 'purpose':
        return a.purpose;
      case 'drift':
        return a.driftTarget ? 'Yes' : '-';
      case 'id':
        return a.id;
      case 'name':
        return a.name;
      default:
        return (a as Record<string, unknown>)[col]?.toString() || '-';
    }
  }));
  
  return ctx.markdown.table(headers, rows);
}

/**
 * Artifact list format
 */
function renderArtifactList(items: Artifact[]): string {
  const lines: string[] = [];
  for (const a of items) {
    lines.push(`- **${categoryLabels[a.category]}** (\`${a.location}\`): ${a.purpose}`);
  }
  return lines.join('\n');
}

// ============================================================================
// Category Labels Export
// ============================================================================

export const categoryLabels: Record<ArtifactCategory, string> = {
  'ssot': 'SSOT',
  'human-readable': 'Human-readable artifacts',
  'machine-readable': 'Machine-readable artifacts',
  'implementation': 'Implementation code',
};

// ============================================================================
// Helper Functions (for specification instance operations)
// ============================================================================

export function getArtifactsByCategory(artifacts: Artifact[], category: ArtifactCategory): Artifact[] {
  return artifacts.filter(a => a.category === category);
}

export function getGeneratedArtifacts(artifacts: Artifact[]): Artifact[] {
  return artifacts.filter(a => a.generatedFrom);
}

export function getDriftTargets(artifacts: Artifact[]): Artifact[] {
  return artifacts.filter(a => a.driftTarget);
}

export function getArtifactById(artifacts: Artifact[], id: string): Artifact | undefined {
  return artifacts.find(a => a.id === id);
}

// ============================================================================
// Validation Functions
// ============================================================================

import type { DirectoryEntry } from './directory-entry.ts';
import { getDirectoryByArtifact } from './directory-entry.ts';

export function validateArtifactDirectoryMapping(
  artifacts: Artifact[],
  directoryStructure: DirectoryEntry[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if each Artifact has a corresponding DirectoryEntry
  for (const artifact of artifacts) {
    const dir = getDirectoryByArtifact(directoryStructure, artifact.id);
    if (!dir) {
      errors.push(`Artifact '${artifact.id}' has no corresponding DirectoryEntry`);
    } else if (!dir.path.startsWith(artifact.location.replace(/\/$/, ''))) {
      errors.push(`Artifact '${artifact.id}' location '${artifact.location}' does not match DirectoryEntry path '${dir.path}'`);
    }
  }
  
  // Check if root DirectoryEntry has artifactId set
  for (const dir of directoryStructure) {
    if (!dir.artifactId) {
      errors.push(`Root DirectoryEntry '${dir.id}' (${dir.path}) has no artifactId`);
    } else {
      const artifact = getArtifactById(artifacts, dir.artifactId);
      if (!artifact) {
        errors.push(`DirectoryEntry '${dir.id}' references non-existent Artifact '${dir.artifactId}'`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
