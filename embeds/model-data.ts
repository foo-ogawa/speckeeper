/**
 * Model Data Rendering Embed
 * 
 * A generic embed that takes a model ID as a parameter and
 * renders using the corresponding data and model renderers.
 */

import { defineEmbed, type EmbedContext } from 'embedoc';
import type { Model } from '../src/core/model.ts';
import type { RenderContext } from '../src/core/model.ts';

// Models (import from index.ts)
import {
  RequirementModel,
  TermModel,
  UseCaseModel,
  ActorModel,
  ArtifactModel,
  EntityModel,
  CLICommandModel,
  validateArtifactDirectoryMapping,
  type Requirement,
  type Term,
  type UseCase,
  type Actor,
  type Entity,
  type DirectoryEntry,
} from '../design/_models/index.ts';

// Data
import {
  allRequirements,
  functionalRequirements,
  nonFunctionalRequirements,
  constraints,
} from '../design/requirements.ts';
import { allTerms } from '../design/glossary.ts';
import { useCases, actors, phaseWorkflowSummaries, phaseConfig } from '../design/usecases.ts';
import { artifacts, directoryStructure } from '../design/artifacts.ts';
import { entities } from '../design/concept-model.ts';
import { commands } from '../design/cli-commands.ts';

// ============================================================================
// Model and Data Registry
// ============================================================================

interface ModelDataConfig<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  getData: () => T[];
  filter?: (data: T[], params: Record<string, string | undefined>) => T[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODEL_REGISTRY: Record<string, ModelDataConfig<any>> = {
  requirement: {
    model: RequirementModel.instance,
    getData: () => allRequirements,
    filter: (data: Requirement[], params) => {
      let filtered = data;
      if (params.type === 'functional') filtered = functionalRequirements;
      else if (params.type === 'non-functional') filtered = nonFunctionalRequirements;
      else if (params.type === 'constraint') filtered = constraints;
      if (params.category) filtered = filtered.filter(r => r.category === params.category);
      if (params.id) filtered = filtered.filter(r => r.id === params.id);
      return filtered;
    },
  },
  term: {
    model: TermModel.instance,
    getData: () => allTerms,
    filter: (data: Term[], params) => {
      let terms = data;
      if (params.category) {
        const categories = params.category.split(',').map(c => c.trim());
        terms = terms.filter(t => categories.includes(t.category));
      }
      if (params.include === 'terms') terms = terms.filter(t => t.category !== 'acronym');
      else if (params.include === 'acronyms') terms = terms.filter(t => t.category === 'acronym');
      return terms.sort((a, b) => a.id.localeCompare(b.id));
    },
  },
  actor: {
    model: ActorModel.instance,
    getData: () => actors,
    filter: (data: Actor[], params) => {
      if (params.include === 'human') return data.filter(a => a.type === 'human');
      if (params.include === 'system') return data.filter(a => a.type === 'system');
      return data;
    },
  },
  usecase: {
    model: UseCaseModel.instance,
    getData: () => useCases,
    filter: (data: UseCase[], params) => {
      if (params.phase) return data.filter(uc => uc.phase === params.phase);
      return data;
    },
  },
  artifact: {
    model: ArtifactModel.instance,
    getData: () => artifacts,
  },
  entity: {
    model: EntityModel.instance,
    getData: () => entities,
    filter: (data: Entity[], params) => {
      if (params.id) return data.filter(e => e.id === params.id);
      return data;
    },
  },
  'cli-command': {
    model: CLICommandModel.instance,
    getData: () => commands,
  },
};

// ============================================================================
// Generic Model Data Embed
// ============================================================================

export const modelData = defineEmbed({
  async render(ctx: EmbedContext) {
    const { model: modelId, format = 'table', validate } = ctx.params;
    
    if (!modelId) {
      return { content: '⚠️ `model` parameter is required' };
    }
    
    const config = MODEL_REGISTRY[modelId];
    if (!config) {
      return { content: `⚠️ Unknown model: ${modelId}` };
    }
    
    // Validation mode (for artifacts)
    if (validate === 'true' && modelId === 'artifact') {
      const result = validateArtifactDirectoryMapping(artifacts, directoryStructure);
      if (result.valid) return { content: '✓ Artifact and DirectoryEntry consistency is valid' };
      return { content: `✗ Consistency errors:\n${result.errors.map(e => `- ${e}`).join('\n')}` };
    }
    
    // Special formats (cross-model rendering)
    if (modelId === 'requirement') {
      if (format === 'spec-chapter') return { content: renderSpecChapter() };
      if (format === 'nfr-chapter') return { content: renderNfrChapter() };
      if (format === 'constraint-chapter') return { content: renderConstraintChapter() };
    }
    if (modelId === 'usecase' && format === 'phase-workflow') {
      return { content: renderPhaseWorkflow() };
    }
    if (modelId === 'artifact' && format === 'directory-tree') {
      return { content: renderDirectoryTree() };
    }
    
    // Data retrieval and filtering
    let data = config.getData();
    if (config.filter) {
      data = config.filter(data, ctx.params);
    }
    
    if (data.length === 0) {
      return { content: `*No matching ${config.model.name} found*` };
    }
    
    // Use the model's renderer
    if (config.model.hasRenderer(format)) {
      const content = config.model.render(format, data, ctx as RenderContext);
      if (content !== null) return { content };
    }
    
    // Default: table format
    const tableContent = config.model.render('table', data, ctx as RenderContext);
    return { content: tableContent || '*Rendering error*' };
  },
});

// ============================================================================
// Helper Functions - Requirements
// ============================================================================

function renderSpecChapter(): string {
  const lines: string[] = [];
  const categoryConfig = [
    { category: 'common', section: '8.1', title: 'Common Requirements (All Models)' },
    { category: 'model', section: '8.2', title: 'External SSOT Reference' },
    { category: 'build', section: '8.3', title: 'Generation (build)' },
    { category: 'lint', section: '8.4', title: 'Lint/Validation' },
    { category: 'drift', section: '8.5', title: 'Drift Check' },
    { category: 'check', section: '8.6', title: 'External SSOT Consistency Check' },
    { category: 'impact', section: '8.7', title: 'Change Impact Analysis' },
    { category: 'export', section: '8.8', title: 'Artifact Export' },
  ];
  
  for (const { category, section, title } of categoryConfig) {
    const catReqs = functionalRequirements.filter(r => r.category === category);
    if (catReqs.length === 0) continue;
    lines.push(`### ${section} ${title}`, '');
    const topLevel = catReqs.filter(r => !r.parentId);
    for (const req of topLevel) lines.push(...renderRequirementSection(req, catReqs));
  }
  return lines.join('\n');
}

function renderRequirementSection(req: Requirement, allReqs: Requirement[]): string[] {
  const lines: string[] = [];
  const children = allReqs.filter(r => r.parentId === req.id);
  
  if (children.length > 0) {
    if (req.description && req.description !== req.name) lines.push(req.description, '');
    for (const child of children) {
      lines.push(`#### ${child.id}: ${child.name}`, '', child.description, '');
      if (child.acceptanceCriteria.length > 0) {
        for (const ac of child.acceptanceCriteria) {
          lines.push(`- **${ac.id}**: ${ac.description}${ac.verificationMethod ? ` [${ac.verificationMethod}]` : ''}`);
        }
        lines.push('');
      }
      if (child.notes) lines.push(child.notes, '');
      if (child.examples?.length) {
        for (const ex of child.examples) {
          if (ex.description) lines.push(`**${ex.description}**`, '');
          lines.push('```' + (ex.language || ''), ex.code, '```', '');
        }
      }
      if (child.seeAlso?.length) lines.push('> ' + child.seeAlso.map(s => `[${s.label}](${s.href})`).join(' | '), '');
    }
  } else {
    lines.push(req.description, '');
    if (req.acceptanceCriteria.length > 0) {
      for (const ac of req.acceptanceCriteria) {
        lines.push(`- **${ac.id}**: ${ac.description}${ac.verificationMethod ? ` [${ac.verificationMethod}]` : ''}`);
      }
      lines.push('');
    }
    if (req.notes) lines.push(req.notes, '');
    if (req.examples?.length) {
      for (const ex of req.examples) {
        if (ex.description) lines.push(`**${ex.description}**`, '');
        lines.push('```' + (ex.language || ''), ex.code, '```', '');
      }
    }
    if (req.seeAlso?.length) lines.push('> ' + req.seeAlso.map(s => `[${s.label}](${s.href})`).join(' | '), '');
  }
  return lines;
}

const NFR_CATEGORIES = [
  { id: 'performance', name: 'Execution Time' },
  { id: 'portability', name: 'Portability' },
  { id: 'extensibility', name: 'Modifiability (Extensibility)' },
  { id: 'transparency', name: 'Transparency' },
  { id: 'compatibility', name: 'Compatibility' },
  { id: 'deployability', name: 'Deployability' },
];

function renderNfrChapter(): string {
  const lines: string[] = [];
  let sectionNum = 1;
  for (const cat of NFR_CATEGORIES) {
    const reqs = nonFunctionalRequirements.filter(r => r.category === cat.id);
    if (reqs.length === 0) continue;
    lines.push(`### 9.${sectionNum} ${cat.name}`, '');
    for (const req of reqs) {
      lines.push(`**${req.id}: ${req.name}**`, '', req.description, '');
      if (req.acceptanceCriteria?.length) {
        for (const ac of req.acceptanceCriteria) lines.push(`- ${ac.description}`);
        lines.push('');
      }
      if (req.notes) lines.push(req.notes.trim(), '');
    }
    sectionNum++;
  }
  return lines.join('\n');
}

function renderConstraintChapter(): string {
  const lines: string[] = [];
  for (const req of constraints) {
    lines.push(`**${req.id}: ${req.name}**`, '', req.description, '');
    if (req.acceptanceCriteria?.length) {
      for (const ac of req.acceptanceCriteria) lines.push(`- ${ac.description}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

// ============================================================================
// Helper Functions - Use Cases
// ============================================================================

function renderPhaseWorkflow(): string {
  const lines: string[] = [];
  const sortedPhases = Object.keys(phaseWorkflowSummaries).sort((a, b) => 
    (phaseConfig[a]?.order ?? 99) - (phaseConfig[b]?.order ?? 99)
  );
  let phaseNumber = 1;
  for (const phase of sortedPhases) {
    lines.push(`${phaseNumber}. **${phaseConfig[phase]?.label || phase}**`);
    for (const summary of phaseWorkflowSummaries[phase] || []) lines.push(`   - ${summary}`);
    lines.push('');
    phaseNumber++;
  }
  return lines.join('\n').trim();
}

// ============================================================================
// Helper Functions - Artifacts
// ============================================================================

function renderDirectoryTree(): string {
  const lines: string[] = ['```'];
  function renderEntry(entry: DirectoryEntry, indent: string, isLast: boolean, isRoot: boolean): void {
    const prefix = isRoot ? '' : (isLast ? '└── ' : '├── ');
    lines.push(`${indent}${prefix}${entry.path}${entry.description ? `  # ${entry.description}` : ''}`);
    if (entry.children?.length) {
      const childIndent = isRoot ? '' : indent + (isLast ? '    ' : '│   ');
      entry.children.forEach((child, i) => renderEntry(child, childIndent, i === entry.children!.length - 1, false));
    }
  }
  directoryStructure.forEach((entry, i) => {
    renderEntry(entry, '', i === directoryStructure.length - 1, true);
    if (i < directoryStructure.length - 1) lines.push('');
  });
  lines.push('```');
  return lines.join('\n');
}

console.log('Model data embeds loaded');
