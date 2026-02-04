/**
 * speckeeper Self-Model - Requirement and Design Model for speckeeper itself
 * 
 * This file models the requirement specification and design of the speckeeper framework
 * itself in TypeScript. speckeeper uses itself as "dogfooding".
 */

// Glossary
export { acronyms, terms, allTerms } from './glossary';

// Requirements
export { functionalRequirements, nonFunctionalRequirements, constraints, allRequirements } from './requirements';

// Concept Model
export { entities, relations as entityRelations, rules } from './concept-model';

// Architecture
export { actors as archActors, externalSystems, boundaries, layers, containers, relations as archRelations, allComponents } from './architecture';

// Use Cases
export { actors as useCaseActors, useCases, phaseWorkflowSummaries, phaseConfig } from './usecases';

// CLI Commands
export { commands } from './cli-commands';

// Artifacts
export { artifacts, directoryStructure, categoryLabels } from './artifacts';

console.log('speckeeper Self-Model loaded successfully!');
