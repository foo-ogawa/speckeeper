/**
 * speckeeper Concept Model - Concept Model
 * 
 * Defines the domain model (entities, relations, rules) of speckeeper itself.
 */
import type { Entity, EntityRelation, Rule } from './_models/concept-model.ts';
import { EntityModel } from './_models/concept-model.ts';
import { defineSpecs } from '../src/core/model.ts';

// ============================================================================
// Core Entities
// ============================================================================

export const entities: Entity[] = [
  {
    id: 'E-001',
    name: 'Requirement',
    description: 'Entity representing requirements. Base for functional requirements, non-functional requirements, and constraints',
    attributes: [
      { name: 'id', type: 'string', description: 'Unique ID (FR-001, etc.)', required: true },
      { name: 'name', type: 'string', description: 'Requirement name', required: true },
      { name: 'description', type: 'string', description: 'Detailed description of requirement', required: true },
      { name: 'rationale', type: 'string', description: 'Reason/background for requirement', required: false },
      { name: 'priority', type: 'enum', enumValues: ['must', 'should', 'could', 'wont'], description: 'Priority', required: true },
      { name: 'status', type: 'enum', enumValues: ['draft', 'review', 'approved', 'implemented'], description: 'Status', required: false },
    ],
    // L2(Entity) refines→ L1(Requirement)
    relations: [
      { type: 'refines', target: 'FR-104', description: 'Refines model definition requirement' },
    ],
  },
  {
    id: 'E-010',
    name: 'Component',
    description: 'Architecture component (system, container, component, person)',
    attributes: [
      { name: 'id', type: 'string', description: 'Unique ID (COMP-001, etc.)', required: true },
      { name: 'name', type: 'string', description: 'Component name', required: true },
      { name: 'description', type: 'string', description: 'Description', required: true },
      { name: 'type', type: 'enum', enumValues: ['person', 'system', 'container', 'component'], description: 'Component type', required: true },
      { name: 'external', type: 'boolean', description: 'Whether external component', required: false },
      { name: 'layerId', type: 'string', description: 'Belonging layer ID', required: false },
      { name: 'boundaryId', type: 'string', description: 'Belonging boundary ID', required: false },
    ],
    relations: [
      { type: 'refines', target: 'FR-104', description: 'Refines model definition requirement' },
    ],
  },
  {
    id: 'E-011',
    name: 'Boundary',
    description: 'Architecture boundary (system boundary, subsystem boundary, etc.)',
    attributes: [
      { name: 'id', type: 'string', description: 'Unique ID', required: true },
      { name: 'name', type: 'string', description: 'Boundary name', required: true },
      { name: 'description', type: 'string', description: 'Description', required: false },
      { name: 'type', type: 'enum', enumValues: ['enterprise', 'system', 'container'], description: 'Boundary type', required: false },
    ],
  },
  {
    id: 'E-012',
    name: 'Layer',
    description: 'Architecture layer (presentation, business, data, etc.)',
    attributes: [
      { name: 'id', type: 'string', description: 'Unique ID', required: true },
      { name: 'name', type: 'string', description: 'Layer name', required: true },
      { name: 'order', type: 'integer', description: 'Layer order (higher is more upper)', required: true },
    ],
  },
  {
    id: 'E-020',
    name: 'Entity',
    description: 'Concept model entity',
    attributes: [
      { name: 'id', type: 'string', description: 'Unique ID (ENT-001, etc.)', required: true },
      { name: 'name', type: 'string', description: 'Entity name', required: true },
      { name: 'description', type: 'string', description: 'Description', required: true },
      { name: 'isAggregate', type: 'boolean', description: 'Whether aggregate root', required: false },
      { name: 'boundaryId', type: 'string', description: 'Belonging boundary ID', required: false },
    ],
  },
  {
    id: 'E-030',
    name: 'Screen',
    description: 'Screen definition',
    attributes: [
      { name: 'id', type: 'string', description: 'Unique ID (SCR-001, etc.)', required: true },
      { name: 'name', type: 'string', description: 'Screen name', required: true },
      { name: 'description', type: 'string', description: 'Description', required: true },
      { name: 'type', type: 'enum', enumValues: ['page', 'modal', 'drawer', 'panel', 'wizard'], description: 'Screen type', required: false },
      { name: 'url', type: 'string', description: 'URL path', required: false },
      { name: 'authRequired', type: 'boolean', description: 'Whether authentication required', required: false },
    ],
  },
  {
    id: 'E-040',
    name: 'APIRef',
    description: 'Reference to external API (OpenAPI)',
    attributes: [
      { name: 'id', type: 'string', description: 'Unique ID', required: true },
      { name: 'specPath', type: 'string', description: 'OpenAPI file path', required: true },
      { name: 'operationId', type: 'string', description: 'Operation ID', required: true },
      { name: 'componentId', type: 'string', description: 'Related component ID', required: false },
    ],
    // L3(External SSOT reference) implements→ L1(Requirement)
    relations: [
      { type: 'implements', target: 'FR-200', description: 'Implements external SSOT reference requirement' },
    ],
  },
  {
    id: 'E-041',
    name: 'TableRef',
    description: 'Reference to external table definition (DDL/Prisma)',
    attributes: [
      { name: 'id', type: 'string', description: 'Unique ID', required: true },
      { name: 'tableName', type: 'string', description: 'Table name', required: true },
      { name: 'sourceType', type: 'enum', enumValues: ['ddl', 'prisma'], description: 'Source type', required: false },
      { name: 'sourcePath', type: 'string', description: 'Source file path', required: true },
      { name: 'entityId', type: 'string', description: 'Corresponding concept entity ID', required: false },
    ],
    relations: [
      { type: 'implements', target: 'FR-200', description: 'Implements external SSOT reference requirement' },
      { type: 'dependsOn', target: 'E-020', description: 'Depends on Entity' },
    ],
  },
  {
    id: 'E-050',
    name: 'Artifact',
    description: 'Artifact classification. Manages human-readable/machine-readable artifacts generated from SSOT',
    attributes: [
      { name: 'id', type: 'string', description: 'Unique ID', required: true },
      { name: 'name', type: 'string', description: 'Artifact name', required: true },
      { name: 'category', type: 'enum', enumValues: ['ssot', 'human-readable', 'machine-readable', 'implementation'], description: 'Classification (SSOT/human-readable/machine-readable/implementation code)', required: true },
      { name: 'location', type: 'string', description: 'Directory path (design/, docs/, specs/, src/)', required: true },
      { name: 'purpose', type: 'string', description: 'Purpose', required: true },
      { name: 'driftTarget', type: 'boolean', description: 'Whether drift detection target', required: false },
      { name: 'generatedFrom', type: 'string', description: 'Source (SSOT ID)', required: false },
    ],
  },
];

// ============================================================================
// Relation Definition
// ============================================================================

export const relations: EntityRelation[] = [
  { id: 'REL-001', from: 'E-001', to: 'E-010', multiplicity: 'N:M', verb: 'relates to' },
  { id: 'REL-002', from: 'E-010', to: 'E-012', multiplicity: 'N:1', verb: 'belongs to' },
  { id: 'REL-003', from: 'E-010', to: 'E-011', multiplicity: 'N:1', verb: 'contained in' },
  { id: 'REL-004', from: 'E-041', to: 'E-020', multiplicity: '1:1', verb: 'maps to' },
  // Note: Artifact generation relationship is expressed via Artifact.generatedFrom attribute, so self-referencing relation is not needed
  { id: 'REL-005', from: 'E-001', to: 'E-050', multiplicity: 'N:M', verb: 'documented in', description: 'Requirements are documented in artifacts' },
];

// ============================================================================
// Business Rules
// ============================================================================

export const rules: Rule[] = [
  {
    id: 'RULE-001',
    name: 'ID Uniqueness Constraint',
    type: 'constraint',
    description: 'IDs must be unique among model elements of the same type',
    appliesTo: ['E-001', 'E-010', 'E-020', 'E-030'],
    expression: 'FORALL x, y IN Entity: x.id = y.id => x = y',
    severity: 'error',
  },
  {
    id: 'RULE-002',
    name: 'Reference Integrity Constraint',
    type: 'constraint',
    description: 'Referenced IDs must actually exist',
    appliesTo: ['E-010', 'E-030'],
    expression: 'FORALL ref IN Reference: EXISTS e IN Entity: e.id = ref.targetId',
    severity: 'error',
  },
  {
    id: 'RULE-003',
    name: 'Layer Dependency Direction Constraint',
    type: 'constraint',
    description: 'Dependencies from lower layers to upper layers are prohibited',
    appliesTo: ['E-012'],
    expression: 'FORALL rel IN Relation: from.layer.order >= to.layer.order',
    severity: 'warning',
  },
];

export default defineSpecs(
  [EntityModel.instance, entities],
);
