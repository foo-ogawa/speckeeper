/**
 * speckeeper Architecture - Architecture Definition
 * 
 * Defines the logical architecture of speckeeper itself.
 */
import type { Component, Boundary, Layer, ArchitectureRelation } from './_models/architecture.ts';
import { ActorComponentModel, ExternalSystemModel, ContainerModel, BoundaryModel, LayerModel, RelationModel } from './_models/architecture.ts';
import { defineSpecs } from '../dist/index.js';

// ============================================================================
// Actors (People) and External Systems
// ============================================================================

export const actors: Component[] = [
  { id: 'ACTOR-001', name: 'Requirements Engineer', type: 'person', description: 'Requirements engineer. Defines requirements and acceptance criteria in TS models' },
  { id: 'ACTOR-002', name: 'Architect', type: 'person', description: 'Architect. Defines logical architecture and concept models in TS models' },
  { id: 'ACTOR-003', name: 'Developer', type: 'person', description: 'Developer. Defines screen specifications and process flows in TS models, maintains consistency with implementation' },
  { id: 'ACTOR-004', name: 'CI/CD System', type: 'person', description: 'CI/CD pipeline. Automatically executes lint/drift/check commands' },
];

export const externalSystems: Component[] = [
  { id: 'EXT-001', name: 'OpenAPI Specification', type: 'system', description: 'External SSOT managing API specifications. speckeeper references via APIRef', external: true },
  { id: 'EXT-002', name: 'Database Schema', type: 'system', description: 'External SSOT managing DB definitions via DDL/Prisma. speckeeper references via TableRef', external: true },
  { id: 'EXT-003', name: 'Infrastructure as Code', type: 'system', description: 'IaC definitions like Terraform/CloudFormation. speckeeper references via IaCRef', external: true },
  { id: 'EXT-004', name: 'GitHub/GitLab', type: 'system', description: 'Repository managing source code and documentation', external: true },
];

// ============================================================================
// System Boundaries
// ============================================================================

export const boundaries: Boundary[] = [
  { id: 'BND-001', name: 'speckeeper System', description: 'speckeeper framework as a whole', type: 'system' },
  { id: 'BND-002', name: 'Core Library', description: 'speckeeper core library', type: 'container' },
  { id: 'BND-003', name: 'CLI Application', description: 'speckeeper CLI application', type: 'container' },
];

// ============================================================================
// Layer Definition
// ============================================================================

export const layers: Layer[] = [
  { id: 'LAYER-001', name: 'Presentation', description: 'CLI, error display, user interaction layer', order: 4, allowedDependencies: ['LAYER-002', 'LAYER-003', 'LAYER-004'] },
  { id: 'LAYER-002', name: 'Application', description: 'Command execution, workflow control layer', order: 3, allowedDependencies: ['LAYER-003', 'LAYER-004'] },
  { id: 'LAYER-003', name: 'Domain', description: 'Domain model, business logic layer', order: 2, allowedDependencies: ['LAYER-004'] },
  { id: 'LAYER-004', name: 'Infrastructure', description: 'File I/O, external system integration layer', order: 1, allowedDependencies: [] },
];

// ============================================================================
// Containers (Main Modules)
// ============================================================================

export const containers: Component[] = [
  {
    id: 'CONT-001',
    name: 'CLI',
    type: 'container',
    description: 'Command line interface',
    technology: { name: 'TypeScript + Commander' },
    boundaryId: 'BND-003',
    layerId: 'LAYER-001',
    // L2(Component) implements→ L1(Requirement)
    relations: [
      { type: 'implements', target: 'FR-300', description: 'Implements build command' },
      { type: 'implements', target: 'FR-400', description: 'Implements lint command' },
      { type: 'implements', target: 'FR-500', description: 'Implements drift command' },
      { type: 'implements', target: 'FR-600', description: 'Implements check command' },
      { type: 'implements', target: 'FR-700', description: 'Implements impact command' },
    ],
  },
  {
    id: 'CONT-002',
    name: 'Types',
    type: 'container',
    description: 'Type definitions with Zod schemas',
    technology: { name: 'TypeScript + Zod' },
    boundaryId: 'BND-002',
    layerId: 'LAYER-003',
    relations: [
      { type: 'implements', target: 'FR-104', description: 'Implements model definition requirement' },
    ],
  },
  {
    id: 'CONT-003',
    name: 'DSL',
    type: 'container',
    description: 'Builder functions',
    technology: { name: 'TypeScript' },
    boundaryId: 'BND-002',
    layerId: 'LAYER-003',
    relations: [
      { type: 'implements', target: 'FR-104', description: 'Implements model definition requirement' },
      { type: 'dependsOn', target: 'CONT-002', description: 'Depends on type definitions' },
    ],
  },
  {
    id: 'CONT-004',
    name: 'Generators',
    type: 'container',
    description: 'Markdown, Mermaid, JSON Schema generation engine',
    technology: { name: 'TypeScript' },
    boundaryId: 'BND-002',
    layerId: 'LAYER-002',
    relations: [
      { type: 'implements', target: 'FR-300', description: 'Implements build functionality' },
      { type: 'implements', target: 'FR-301', description: 'Implements Markdown rendering' },
      { type: 'dependsOn', target: 'CONT-002', description: 'Depends on type definitions' },
    ],
  },
  {
    id: 'CONT-005',
    name: 'Validators',
    type: 'container',
    description: 'Validation and lint rule execution engine',
    technology: { name: 'TypeScript' },
    boundaryId: 'BND-002',
    layerId: 'LAYER-002',
    relations: [
      { type: 'implements', target: 'FR-400', description: 'Implements lint functionality' },
      { type: 'implements', target: 'FR-701', description: 'Implements relation validation' },
      { type: 'dependsOn', target: 'CONT-002', description: 'Depends on type definitions' },
    ],
  },
  {
    id: 'CONT-006',
    name: 'Checkers',
    type: 'container',
    description: 'External SSOT consistency checker',
    technology: { name: 'TypeScript' },
    boundaryId: 'BND-002',
    layerId: 'LAYER-002',
    relations: [
      { type: 'implements', target: 'FR-600', description: 'Implements external SSOT consistency check' },
      { type: 'implements', target: 'FR-603', description: 'Implements external checker functionality' },
      { type: 'dependsOn', target: 'CONT-007', description: 'Depends on utilities' },
    ],
  },
  {
    id: 'CONT-007',
    name: 'Utils',
    type: 'container',
    description: 'Utilities for file I/O, config loading, ID generation, etc.',
    technology: { name: 'TypeScript' },
    boundaryId: 'BND-002',
    layerId: 'LAYER-004',
    relations: [
      { type: 'implements', target: 'FR-101', description: 'Implements ID management utilities' },
    ],
  },
];

// ============================================================================
// Component Relations
// ============================================================================

export const relations: ArchitectureRelation[] = [
  // Internal relations
  { id: 'REL-A001', from: 'CONT-001', to: 'CONT-004', label: 'calls', technology: 'function call' },
  { id: 'REL-A002', from: 'CONT-001', to: 'CONT-005', label: 'calls', technology: 'function call' },
  { id: 'REL-A003', from: 'CONT-001', to: 'CONT-006', label: 'calls', technology: 'function call' },
  { id: 'REL-A004', from: 'CONT-001', to: 'CONT-007', label: 'uses', technology: 'function call' },
  { id: 'REL-A005', from: 'CONT-004', to: 'CONT-002', label: 'reads', technology: 'import' },
  { id: 'REL-A006', from: 'CONT-005', to: 'CONT-002', label: 'validates', technology: 'import' },
  { id: 'REL-A007', from: 'CONT-006', to: 'CONT-007', label: 'uses', technology: 'function call' },
  { id: 'REL-A008', from: 'CONT-003', to: 'CONT-002', label: 'implements', technology: 'import' },
  // External relations
  { id: 'REL-A010', from: 'ACTOR-001', to: 'CONT-003', label: 'defines models', technology: 'TypeScript' },
  { id: 'REL-A011', from: 'ACTOR-002', to: 'CONT-003', label: 'defines architecture', technology: 'TypeScript' },
  { id: 'REL-A012', from: 'ACTOR-003', to: 'CONT-003', label: 'defines screens', technology: 'TypeScript' },
  { id: 'REL-A013', from: 'ACTOR-004', to: 'CONT-001', label: 'executes', technology: 'CLI' },
  { id: 'REL-A014', from: 'CONT-006', to: 'EXT-001', label: 'reads', technology: 'file system' },
  { id: 'REL-A015', from: 'CONT-006', to: 'EXT-002', label: 'reads', technology: 'file system' },
  { id: 'REL-A016', from: 'CONT-004', to: 'EXT-004', label: 'writes docs/', technology: 'file system' },
];

// ============================================================================
// All Components
// ============================================================================

export const allComponents: Component[] = [...actors, ...externalSystems, ...containers];

export default defineSpecs(
  [ActorComponentModel.instance, actors],
  [ExternalSystemModel.instance, externalSystems],
  [ContainerModel.instance, containers],
  [BoundaryModel.instance, boundaries],
  [LayerModel.instance, layers],
  [RelationModel.instance, relations],
);
