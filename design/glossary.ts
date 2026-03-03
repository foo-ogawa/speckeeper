/**
 * speckeeper Glossary - Term Definitions
 * 
 * Defines key terms used in the speckeeper requirement specification.
 * This file is the SSOT, and the "4. Terms & Definitions" section
 * in docs/framework_requirements_spec.md is generated from this file.
 */
import type { Term } from './_models/term.ts';
import { defineSpecs } from '../dist/index.js';
import { TermModel } from './_models/term.ts';

// ============================================================================
// Acronym Definitions
// ============================================================================

export const acronyms: Term[] = [
  { id: 'TERM-A001', term: 'SSOT', abbreviation: 'SSOT', expandedForm: 'Single Source of Truth', definition: 'The single authoritative source of information. The canonical location for data and design', category: 'acronym' },
  { id: 'TERM-A002', term: 'TS', abbreviation: 'TS', expandedForm: 'TypeScript', definition: 'Statically typed JavaScript developed by Microsoft', category: 'acronym' },
  { id: 'TERM-A003', term: 'DSL', abbreviation: 'DSL', expandedForm: 'Domain Specific Language', definition: 'Domain-specific language. A programming language specialized for a particular domain', category: 'acronym' },
  { id: 'TERM-A004', term: 'CLI', abbreviation: 'CLI', expandedForm: 'Command Line Interface', definition: 'Command line interface', category: 'acronym' },
  { id: 'TERM-A005', term: 'API', abbreviation: 'API', expandedForm: 'Application Programming Interface', definition: 'Application programming interface', category: 'acronym' },
  { id: 'TERM-A006', term: 'DDL', abbreviation: 'DDL', expandedForm: 'Data Definition Language', definition: 'Data definition language. A language for defining database schemas', category: 'acronym' },
  { id: 'TERM-A007', term: 'IaC', abbreviation: 'IaC', expandedForm: 'Infrastructure as Code', definition: 'Infrastructure definition through code', category: 'acronym' },
  { id: 'TERM-A008', term: 'DTO', abbreviation: 'DTO', expandedForm: 'Data Transfer Object', definition: 'Data transfer object. A structure for passing data between systems', category: 'acronym' },
  { id: 'TERM-A009', term: 'ER', abbreviation: 'ER', expandedForm: 'Entity Relationship', definition: 'Entity relationship. A data modeling technique', category: 'acronym' },
  { id: 'TERM-A010', term: 'C4', abbreviation: 'C4', expandedForm: 'Context, Container, Component, Code', definition: 'Software architecture visualization model', category: 'acronym' },
];

// ============================================================================
// Core Concepts (fully synchronized with framework_requirements_spec.md 4. Terms & Definitions)
// ============================================================================

export const terms: Term[] = [
  {
    id: 'TERM-001',
    term: 'TS-SSOT',
    category: 'core',
    definition: 'A policy where TypeScript is the source of truth and generated artifacts are regeneratable derivatives',
    // L0(Term) traces→ L1(Requirement)
    relations: [
      { type: 'traces', target: 'FR-100', description: 'Concept referenced in common requirements' },
    ],
  },
  {
    id: 'TERM-002',
    term: 'External SSOT',
    englishTerm: 'External SSOT',
    category: 'core',
    definition: 'Artifacts managed by existing tools/formats (OpenAPI, DDL, IaC, etc.). This framework does not generate them but checks consistency against them',
    relations: [
      { type: 'traces', target: 'FR-200', description: 'Concept used in external SSOT reference requirement' },
      { type: 'traces', target: 'FR-600', description: 'Concept used in external SSOT consistency check requirement' },
    ],
  },
  {
    id: 'TERM-003',
    term: 'External SSOT Reference',
    englishTerm: 'External SSOT Reference',
    category: 'core',
    definition: 'Minimal interface for referencing external SSOT from TS models (ID, path, correspondence, etc.)',
    relations: [
      { type: 'traces', target: 'FR-200', description: 'Concept defined in external SSOT reference requirement' },
    ],
  },
  {
    id: 'TERM-004',
    term: 'Model',
    englishTerm: 'Model',
    category: 'core',
    definition: 'A unit of design information defined in TypeScript. Inherits from Model base class and has schema, lint rules, renderers, etc.',
  },
  {
    id: 'TERM-010',
    term: 'Design Artifact',
    englishTerm: 'Artifact',
    category: 'core',
    definition: 'Design artifacts to satisfy requirements such as monitoring, Runbook, Dashboard, data schema, etc.',
  },
  {
    id: 'TERM-011',
    term: 'Concretization Slot',
    englishTerm: 'Concretization slot',
    category: 'core',
    definition: 'Items to be filled in subsequent phases (allows TBD while having a deadline phase)',
  },
  {
    id: 'TERM-012',
    term: 'ID Linkage',
    category: 'core',
    definition: 'A mechanism that ensures componentId/entityId/requirementId from TS models appear in external SSOT, generated artifacts, implementation, and IaC to connect design and implementation',
  },
  {
    id: 'TERM-013',
    term: 'Drift',
    englishTerm: 'drift',
    category: 'process',
    definition: 'A state where docs//specs/ that should have been generated from TS have differences due to manual edits, etc.',
  },
  {
    id: 'TERM-014',
    term: 'Reconciliation',
    englishTerm: 'Reconciliation',
    category: 'process',
    definition: 'Checks to bridge gaps between design and external SSOT/implementation (design consistency, external SSOT consistency, implementation existence verification)',
  },
  {
    id: 'TERM-015',
    term: 'User-defined Model',
    englishTerm: 'User-defined Model',
    category: 'core',
    definition: 'Project-specific models defined by users inheriting from the Model base class. The standard way to use speckeeper',
  },
];

// ============================================================================
// All Terms
// ============================================================================

export const allTerms: Term[] = [...acronyms, ...terms];

export default defineSpecs(
  [TermModel.instance, allTerms],
);
