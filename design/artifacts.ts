/**
 * spects Artifacts & Directory Structure
 * 
 * Defines artifacts and directory structure managed by spects.
 * This file is the SSOT, and sections "7.1 Directory Structure" and "7.2 Artifact Classification"
 * in docs/framework_requirements_spec.md are auto-generated via embedoc.
 */
import type { Artifact } from './_models/artifact.ts';
import type { DirectoryEntry } from './_models/directory-entry.ts';

// ============================================================================
// Artifact Definition
// ============================================================================

export const artifacts: Artifact[] = [
  {
    id: 'ART-001',
    name: 'SSOT',
    category: 'ssot',
    location: 'design/',
    purpose: 'TypeScript models (source of truth) = requirement/design definitions',
    driftTarget: false,
  },
  {
    id: 'ART-002',
    name: 'Human-readable artifacts',
    category: 'human-readable',
    location: 'docs/',
    purpose: 'Markdown/Mermaid (for review)',
    driftTarget: true,
    generatedFrom: 'ART-001',
  },
  {
    id: 'ART-003',
    name: 'Machine-readable artifacts',
    category: 'machine-readable',
    location: 'specs/',
    purpose: 'JSON/JSON Schema for consistency checking',
    driftTarget: true,
    generatedFrom: 'ART-001',
  },
  {
    id: 'ART-004',
    name: 'Implementation code',
    category: 'implementation',
    location: 'src/',
    purpose: 'Application implementation (not managed by spects)',
    driftTarget: false,
  },
];

// ============================================================================
// Directory Structure Definition
// ============================================================================

export const directoryStructure: DirectoryEntry[] = [
  // SSOT (design/)
  {
    id: 'DIR-001',
    path: 'design/',
    description: 'TypeScript (source of truth) = upstream SSOT (requirement/design models)',
    artifactId: 'ART-001',
    children: [
      { id: 'DIR-001-01', path: '_models/', description: 'Model definitions (schemas, lint rules, exporters)', filePattern: '*.ts' },
      { id: 'DIR-001-02', path: 'requirements.ts', description: 'Requirement definitions', filePattern: '*.ts' },
      { id: 'DIR-001-03', path: 'usecases.ts', description: 'Use case and actor definitions', filePattern: '*.ts' },
      { id: 'DIR-001-04', path: 'architecture.ts', description: 'Logical architecture (C4 System/Container)', filePattern: '*.ts' },
      { id: 'DIR-001-05', path: 'concept-model.ts', description: 'Concept model (Entity/Relation)', filePattern: '*.ts' },
      { id: 'DIR-001-06', path: 'glossary.ts', description: 'Glossary', filePattern: '*.ts' },
      { id: 'DIR-001-07', path: 'artifacts.ts', description: 'Artifact and directory structure definitions', filePattern: '*.ts' },
      { id: 'DIR-001-08', path: 'cli-commands.ts', description: 'CLI command specifications', filePattern: '*.ts' },
    ],
  },
  
  // Human-readable (docs/)
  {
    id: 'DIR-002',
    path: 'docs/',
    description: 'Human-readable documents (auto-updated via embedoc)',
    artifactId: 'ART-002',
    children: [
      { id: 'DIR-002-01', path: 'framework_requirements_spec.md', description: 'Framework requirements specification (sections auto-updated via embedoc)' },
      { id: 'DIR-002-02', path: 'model-design.md', description: 'Model design guide' },
      { id: 'DIR-002-03', path: 'model-guide.md', description: 'Model definition guide' },
      { id: 'DIR-002-04', path: 'model_entity_catalog.md', description: 'Model and entity catalog' },
      { id: 'DIR-002-05', path: 'framework_evaluation.md', description: 'Framework evaluation' },
    ],
  },
  
  // Machine-readable (specs/)
  {
    id: 'DIR-003',
    path: 'specs/',
    description: 'Machine-readable artifacts (JSON Schema for consistency checking)',
    artifactId: 'ART-003',
    children: [
      {
        id: 'DIR-003-01',
        path: 'schemas/',
        description: 'JSON Schema',
        children: [
          { id: 'DIR-003-01-01', path: 'entities/', description: 'Entity JSON Schema (E-001.json, etc.)', filePattern: '*.json' },
        ],
      },
      { id: 'DIR-003-02', path: 'index.json', description: 'Aggregated data (reference graph for all models)' },
    ],
  },
  
  // Implementation (src/)
  {
    id: 'DIR-004',
    path: 'src/',
    description: 'Application implementation code (not managed by spects)',
    artifactId: 'ART-004',
  },
];

// Re-export categoryLabels from _models for convenience
export { categoryLabels } from './_models/artifact.ts';
