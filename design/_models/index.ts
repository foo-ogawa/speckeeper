/**
 * Model Definition Export
 * 
 * Exports types (for specification authors) and model classes (for CLI internal use)
 */

// Types
export type { Requirement, RequirementType } from './requirement.ts';
export type { UseCase, Actor } from './usecase.ts';
export type { Term } from './term.ts';
export type { Entity, EntityRelation, Rule } from './concept-model.ts';
export type { Component, Boundary, Layer, ArchitectureRelation } from './architecture.ts';
export type { Artifact, ArtifactCategory } from './artifact.ts';
export type { DirectoryEntry } from './directory-entry.ts';
export type { CLICommand, CommandParameter, SubCommand, ExitCode, CIStep } from './cli-command.ts';
export type { TestRef, TestSource, TestCasePattern } from './test-ref.ts';

// Schemas (for external use)
export { RequirementSchema, RequirementTypeSchema } from './requirement.ts';
export { ArtifactSchema } from './artifact.ts';
export { CLICommandSchema, CommandParameterSchema, SubCommandSchema, ExitCodeSchema, CIStepSchema } from './cli-command.ts';
export { TestRefSchema, TestSourceSchema, TestCasePatternSchema } from './test-ref.ts';

// Utility functions
export {
  categoryLabels,
  getArtifactsByCategory,
  getGeneratedArtifacts,
  getDriftTargets,
  getArtifactById,
  validateArtifactDirectoryMapping,
} from './artifact.ts';
export {
  getAllDirectoryEntries,
  getDirectoryById,
  getDirectoryByArtifact,
  generateDirectoryTreeMarkdown,
} from './directory-entry.ts';

// Model classes
export { RequirementModel } from './requirement.ts';
export { UseCaseModel, ActorModel } from './usecase.ts';
export { TermModel } from './term.ts';
export { EntityModel } from './concept-model.ts';
export { ComponentModel, BoundaryModel, LayerModel, RelationModel } from './architecture.ts';
export { ArtifactModel } from './artifact.ts';
export { DirectoryEntryModel } from './directory-entry.ts';
export { CLICommandModel } from './cli-command.ts';
export { TestRefModel } from './test-ref.ts';

// All models for registry (use XXXModel.instance)
import { RequirementModel } from './requirement.ts';
import { UseCaseModel, ActorModel } from './usecase.ts';
import { TermModel } from './term.ts';
import { EntityModel } from './concept-model.ts';
import { ComponentModel, BoundaryModel, LayerModel, RelationModel } from './architecture.ts';
import { ArtifactModel } from './artifact.ts';
import { DirectoryEntryModel } from './directory-entry.ts';
import { CLICommandModel } from './cli-command.ts';
import { TestRefModel } from './test-ref.ts';

export const allModels = [
  RequirementModel.instance,
  UseCaseModel.instance,
  ActorModel.instance,
  TermModel.instance,
  EntityModel.instance,
  ComponentModel.instance,
  BoundaryModel.instance,
  LayerModel.instance,
  RelationModel.instance,
  ArtifactModel.instance,
  DirectoryEntryModel.instance,
  CLICommandModel.instance,
  TestRefModel.instance,
];
