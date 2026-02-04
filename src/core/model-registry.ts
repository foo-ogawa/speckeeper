import { z } from 'zod';
import type {
  ModelDefinition,
  MetaModelRegistry,
  LintRule,
  LintContext,
  LintIssue,
  ExportContext,
  CheckContext,
  CheckResult,
  MarkdownExporter,
  MermaidExporter,
  ExternalChecker,
} from '../types/meta-model.js';

// ============================================================================
// Global Registry
// ============================================================================

/**
 * Global model registry
 */
const globalRegistry: MetaModelRegistry = {
  definitions: new Map(),
  instances: new Map(),
};

// ============================================================================
// Model Definition Registration
// ============================================================================

/**
 * Register model definition
 */
export function registerModelDefinition<T extends z.ZodTypeAny>(
  definition: ModelDefinition<T>
): void {
  if (globalRegistry.definitions.has(definition.id)) {
    console.warn(`Model definition '${definition.id}' is already registered. Overwriting.`);
  }
  
  // Store in generic registry while maintaining type safety
  globalRegistry.definitions.set(definition.id, definition as unknown as ModelDefinition);
  
  // Initialize Map for instances
  if (!globalRegistry.instances.has(definition.id)) {
    globalRegistry.instances.set(definition.id, new Map());
  }
}

/**
 * Register multiple model definitions at once
 */
export function registerModelDefinitions(definitions: ModelDefinition[]): void {
  for (const def of definitions) {
    registerModelDefinition(def);
  }
}

/**
 * Get model definition
 */
export function getModelDefinition(modelId: string): ModelDefinition | undefined {
  return globalRegistry.definitions.get(modelId);
}

/**
 * Get all model definitions
 */
export function getAllModelDefinitions(): ModelDefinition[] {
  return Array.from(globalRegistry.definitions.values());
}

// ============================================================================
// Model Instance Registration
// ============================================================================

/**
 * Register model instance
 */
export function registerModelInstance<T extends { id: string }>(
  modelId: string,
  instance: T
): void {
  const definition = globalRegistry.definitions.get(modelId);
  if (!definition) {
    throw new Error(`Model definition '${modelId}' not found. Register the definition first.`);
  }
  
  // Validate with schema
  const result = definition.schema.safeParse(instance);
  if (!result.success) {
    throw new Error(
      `Invalid instance for model '${modelId}': ${result.error.message}`
    );
  }
  
  let instances = globalRegistry.instances.get(modelId);
  if (!instances) {
    instances = new Map();
    globalRegistry.instances.set(modelId, instances);
  }
  
  instances.set(instance.id, instance);
}

/**
 * Get model instance
 */
export function getModelInstance<T = unknown>(
  modelId: string,
  instanceId: string
): T | undefined {
  const instances = globalRegistry.instances.get(modelId);
  return instances?.get(instanceId) as T | undefined;
}

/**
 * Get all instances of a model
 */
export function getAllModelInstances<T = unknown>(modelId: string): T[] {
  const instances = globalRegistry.instances.get(modelId);
  if (!instances) return [];
  return Array.from(instances.values()) as T[];
}

/**
 * Get all instances of all models (flattened)
 */
export function getAllInstances(): Array<{ modelId: string; instance: unknown }> {
  const result: Array<{ modelId: string; instance: unknown }> = [];
  
  for (const [modelId, instances] of globalRegistry.instances) {
    for (const instance of instances.values()) {
      result.push({ modelId, instance });
    }
  }
  
  return result;
}

// ============================================================================
// Registry Access
// ============================================================================

/**
 * Get global registry
 */
export function getGlobalModelRegistry(): MetaModelRegistry {
  return globalRegistry;
}

/**
 * Reset registry (for testing)
 */
export function resetModelRegistry(): void {
  globalRegistry.definitions.clear();
  globalRegistry.instances.clear();
}

/**
 * Reset instances only (keep definitions)
 */
export function resetModelInstances(): void {
  for (const instances of globalRegistry.instances.values()) {
    instances.clear();
  }
}

// ============================================================================
// Lint Execution
// ============================================================================

/**
 * Execute lint for specific model
 */
export function lintModel<T extends { id: string }>(
  modelId: string,
  instance: T,
  context: LintContext
): Array<{ rule: LintRule<T>; issue: LintIssue }> {
  const definition = globalRegistry.definitions.get(modelId);
  if (!definition || !definition.lintRules) return [];
  
  const issues: Array<{ rule: LintRule<T>; issue: LintIssue }> = [];
  
  for (const rule of definition.lintRules as LintRule<T>[]) {
    const issue = rule.check(instance, context);
    if (issue) {
      issues.push({ rule, issue });
    }
  }
  
  return issues;
}

/**
 * Execute lint for all models
 */
export function lintAllModels(context: LintContext): Array<{
  modelId: string;
  instanceId: string;
  rule: LintRule<unknown>;
  issue: LintIssue;
}> {
  const allIssues: Array<{
    modelId: string;
    instanceId: string;
    rule: LintRule<unknown>;
    issue: LintIssue;
  }> = [];
  
  for (const [modelId, instances] of globalRegistry.instances) {
    const definition = globalRegistry.definitions.get(modelId);
    if (!definition || !definition.lintRules) continue;
    
    for (const [instanceId, instance] of instances) {
      for (const rule of definition.lintRules) {
        const issue = rule.check(instance, context);
        if (issue) {
          allIssues.push({
            modelId,
            instanceId,
            rule,
            issue,
          });
        }
      }
    }
  }
  
  return allIssues;
}

// ============================================================================
// Export Execution
// ============================================================================

/**
 * Execute Markdown export
 */
export function exportMarkdown(
  modelId: string,
  context: ExportContext
): Array<{ path: string; content: string }> {
  const definition = globalRegistry.definitions.get(modelId);
  if (!definition || !definition.exporters?.markdown) return [];
  
  const exporter = definition.exporters.markdown as MarkdownExporter<unknown>;
  const instances = getAllModelInstances(modelId);
  const files: Array<{ path: string; content: string }> = [];
  
  // Generate individual files
  for (const instance of instances) {
    const content = exporter.single(instance, context);
    const filename = exporter.filename
      ? exporter.filename(instance)
      : (instance as { id: string }).id;
    
    files.push({
      path: `${context.outputDir}/${exporter.outputDir}/${filename}.md`,
      content,
    });
  }
  
  // Generate index file
  if (exporter.index && instances.length > 0) {
    const indexContent = exporter.index(instances, context);
    files.push({
      path: `${context.outputDir}/${exporter.outputDir}/index.md`,
      content: indexContent,
    });
  }
  
  return files;
}

/**
 * Execute Mermaid diagram export
 */
export function exportMermaid(
  modelId: string,
  context: ExportContext
): Array<{ path: string; content: string }> {
  const definition = globalRegistry.definitions.get(modelId);
  if (!definition || !definition.exporters?.mermaid) return [];
  
  const exporters = Array.isArray(definition.exporters.mermaid)
    ? definition.exporters.mermaid
    : [definition.exporters.mermaid];
  
  const instances = getAllModelInstances(modelId);
  const files: Array<{ path: string; content: string }> = [];
  
  for (const exporter of exporters as MermaidExporter<unknown>[]) {
    const content = exporter.generate(instances, context);
    files.push({
      path: `${context.outputDir}/${exporter.outputPath}`,
      content,
    });
  }
  
  return files;
}

/**
 * Execute export for all models
 */
export function exportAllModels(context: ExportContext): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  
  for (const modelId of globalRegistry.definitions.keys()) {
    files.push(...exportMarkdown(modelId, context));
    files.push(...exportMermaid(modelId, context));
  }
  
  return files;
}

// ============================================================================
// External Check Execution
// ============================================================================

/**
 * Execute external SSOT check
 */
export function checkExternalSsot<T extends { id: string }>(
  modelId: string,
  externalSource: unknown,
  context: CheckContext
): CheckResult {
  const definition = globalRegistry.definitions.get(modelId);
  if (!definition || !definition.externalChecker) {
    return { success: true, errors: [], warnings: [] };
  }
  
  const checker = definition.externalChecker as ExternalChecker<T>;
  const instances = getAllModelInstances<T>(modelId);
  
  const allErrors: CheckResult['errors'] = [];
  const allWarnings: CheckResult['warnings'] = [];
  
  for (const instance of instances) {
    const result = checker.check(instance, externalSource, context);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }
  
  return {
    success: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

// ============================================================================
// Reference Resolution
// ============================================================================

/**
 * Resolve reference
 */
export function resolveReference(
  modelId: string,
  instanceId: string,
  field: string
): unknown | undefined {
  const definition = globalRegistry.definitions.get(modelId);
  if (!definition || !definition.references) return undefined;
  
  const refDef = definition.references.find(r => r.field === field);
  if (!refDef) return undefined;
  
  const instance = getModelInstance(modelId, instanceId) as Record<string, unknown> | undefined;
  if (!instance) return undefined;
  
  const refValue = instance[field];
  if (!refValue) return undefined;
  
  if (refDef.isArray && Array.isArray(refValue)) {
    return refValue.map(id => getModelInstance(refDef.targetModel, id as string));
  }
  
  return getModelInstance(refDef.targetModel, refValue as string);
}

/**
 * Check reference integrity
 */
export function checkReferenceIntegrity(): Array<{
  modelId: string;
  instanceId: string;
  field: string;
  targetModel: string;
  missingIds: string[];
}> {
  const issues: Array<{
    modelId: string;
    instanceId: string;
    field: string;
    targetModel: string;
    missingIds: string[];
  }> = [];
  
  for (const [modelId, definition] of globalRegistry.definitions) {
    if (!definition.references) continue;
    
    const instances = globalRegistry.instances.get(modelId);
    if (!instances) continue;
    
    for (const [instanceId, instance] of instances) {
      const inst = instance as Record<string, unknown>;
      
      for (const refDef of definition.references) {
        const refValue = inst[refDef.field];
        if (!refValue) {
          if (refDef.required) {
            issues.push({
              modelId,
              instanceId,
              field: refDef.field,
              targetModel: refDef.targetModel,
              missingIds: ['(required but not provided)'],
            });
          }
          continue;
        }
        
        const targetInstances = globalRegistry.instances.get(refDef.targetModel);
        const missingIds: string[] = [];
        
        if (refDef.isArray && Array.isArray(refValue)) {
          for (const id of refValue) {
            if (!targetInstances?.has(id as string)) {
              missingIds.push(id as string);
            }
          }
        } else {
          if (!targetInstances?.has(refValue as string)) {
            missingIds.push(refValue as string);
          }
        }
        
        if (missingIds.length > 0) {
          issues.push({
            modelId,
            instanceId,
            field: refDef.field,
            targetModel: refDef.targetModel,
            missingIds,
          });
        }
      }
    }
  }
  
  return issues;
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get registry statistics
 */
export function getModelRegistryStats(): {
  definitionCount: number;
  instanceCounts: Record<string, number>;
  totalInstances: number;
} {
  const instanceCounts: Record<string, number> = {};
  let totalInstances = 0;
  
  for (const [modelId, instances] of globalRegistry.instances) {
    instanceCounts[modelId] = instances.size;
    totalInstances += instances.size;
  }
  
  return {
    definitionCount: globalRegistry.definitions.size,
    instanceCounts,
    totalInstances,
  };
}
