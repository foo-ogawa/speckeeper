/**
 * Model definitions export
 */

// Types
export type { Requirement } from './requirement.ts';
export type { UseCase, Actor } from './usecase.ts';
export type { Term } from './term.ts';
export type { Entity } from './entity.ts';
export type { Component } from './component.ts';

// Model classes
export { RequirementModel } from './requirement.ts';
export { UseCaseModel, ActorModel } from './usecase.ts';
export { TermModel } from './term.ts';
export { EntityModel } from './entity.ts';
export { ComponentModel } from './component.ts';

// All models for registry (use XXXModel.instance)
import { RequirementModel } from './requirement.ts';
import { UseCaseModel, ActorModel } from './usecase.ts';
import { TermModel } from './term.ts';
import { EntityModel } from './entity.ts';
import { ComponentModel } from './component.ts';

export const allModels = [
  RequirementModel.instance,
  UseCaseModel.instance,
  ActorModel.instance,
  TermModel.instance,
  EntityModel.instance,
  ComponentModel.instance,
];
