import { z } from 'zod';

// ============================================================================
// Meta Model Types - Types for defining models
// ============================================================================

/**
 * Export Context
 * Context information passed to exporter functions
 */
export interface ExportContext {
  /** Access to all models (MetaModelRegistry type, using unknown to avoid circular references) */
  registry: unknown;
  /** Configuration (SpeckeeperConfig type, using unknown to avoid circular references) */
  config: unknown;
  /** Output base directory */
  outputDir: string;
  /** Current date/time */
  generatedAt: Date;
}

/**
 * Lint Context
 * Context information passed to lint functions
 */
export interface LintContext {
  /** Access to all models (MetaModelRegistry type) */
  registry: unknown;
  /** Current phase */
  phase?: 'REQ' | 'HLD' | 'LLD' | 'OPS';
  /** Strict mode */
  strict?: boolean;
}

/**
 * Check Context
 * Context information passed to external SSOT check functions
 */
export interface CheckContext {
  /** Access to all models (MetaModelRegistry type) */
  registry: unknown;
  /** External SSOT file path */
  sourcePath: string;
  /** Configuration (SpeckeeperConfig type) */
  config: unknown;
}

/**
 * Lint Issue
 */
export interface LintIssue {
  /** Issue message */
  message: string;
  /** Problematic field (optional) */
  field?: string;
  /** Fix suggestion (optional) */
  suggestion?: string;
}

/**
 * Check Result
 */
export interface CheckResult {
  /** Whether successful */
  success: boolean;
  /** List of error messages */
  errors: CheckError[];
  /** List of warning messages */
  warnings: CheckWarning[];
}

export interface CheckError {
  /** Error message */
  message: string;
  /** Target model ID */
  modelId: string;
  /** External SSOT reference */
  externalRef?: string;
}

export interface CheckWarning {
  /** Warning message */
  message: string;
  /** Target model ID */
  modelId: string;
}

// ============================================================================
// Exporter Interfaces
// ============================================================================

/**
 * Markdown Exporter
 */
export interface MarkdownExporter<T> {
  /** Single document generation */
  single: (model: T, context: ExportContext) => string;
  /** Index page generation (optional) */
  index?: (models: T[], context: ExportContext) => string;
  /** Output directory (relative path from docs/) */
  outputDir: string;
  /** Filename generation (default is model.id) */
  filename?: (model: T) => string;
}

/**
 * Mermaid Diagram Exporter
 */
export interface MermaidExporter<T> {
  /** Diagram type */
  diagramType: 'flowchart' | 'sequenceDiagram' | 'erDiagram' | 'stateDiagram' | 'C4Context' | 'C4Container' | 'C4Component' | 'custom';
  /** Diagram generation function */
  generate: (models: T[], context: ExportContext) => string;
  /** Output file path (relative path from docs/) */
  outputPath: string;
  /** Diagram title */
  title?: string;
}

/**
 * JSON Schema Exporter Settings
 */
export interface JsonSchemaExporter {
  /** Enabled */
  enabled: boolean;
  /** Output directory (relative path from specs/) */
  outputDir: string;
}

// ============================================================================
// Lint Rule Interface
// ============================================================================

/**
 * Lint Rule
 */
export interface LintRule<T> {
  /** Rule ID */
  id: string;
  /** Rule description */
  description: string;
  /** Severity */
  severity: 'error' | 'warning' | 'info';
  /** Check function */
  check: (model: T, context: LintContext) => LintIssue | null;
}

// ============================================================================
// External Checker Interface
// ============================================================================

/**
 * External SSOT Checker
 */
export interface ExternalChecker<T> {
  /** External SSOT type to check */
  targetType: 'openapi' | 'ddl' | 'iac' | 'custom';
  /** Execute check */
  check: (model: T, externalSource: unknown, context: CheckContext) => CheckResult;
  /** Get external SSOT file path (from model) */
  getSourcePath?: (model: T) => string | undefined;
}

// ============================================================================
// Reference Definition
// ============================================================================

/**
 * Inter-model Reference Definition (for traceability)
 */
export interface ReferenceDefinition {
  /** Field name with reference */
  field: string;
  /** Referenced model ID */
  targetModel: string;
  /** Whether reference is required */
  required?: boolean;
  /** Whether reference is array */
  isArray?: boolean;
}

// ============================================================================
// Model Definition Interface
// ============================================================================

/**
 * Model Definition
 * Interface for users to define new entities
 */
export interface ModelDefinition<T extends z.ZodTypeAny = z.ZodTypeAny> {
  /** Model unique identifier (kebab-case recommended) */
  id: string;
  /** Model name (PascalCase recommended) */
  name: string;
  /** Model description */
  description: string;
  
  /** Zod Schema */
  schema: T;
  
  /** ID prefix for generation */
  idPrefix: string;
  
  /** Exporter settings */
  exporters?: {
    /** Markdown exporter */
    markdown?: MarkdownExporter<z.infer<T>>;
    /** Mermaid diagram exporter (multiple allowed) */
    mermaid?: MermaidExporter<z.infer<T>> | MermaidExporter<z.infer<T>>[];
    /** JSON Schema exporter */
    jsonSchema?: JsonSchemaExporter;
  };
  
  /** Lint rules */
  lintRules?: LintRule<z.infer<T>>[];
  
  /** External SSOT checker */
  externalChecker?: ExternalChecker<z.infer<T>>;
  
  /** Reference definitions (for traceability) */
  references?: ReferenceDefinition[];
  
  /** DSL function name (the Xxx part of defineXxx) */
  dslName?: string;
  
  /** Phase (the phase where this model is primarily used) */
  phase?: 'REQ' | 'HLD' | 'LLD' | 'OPS';
}

// ============================================================================
// Model Registry Interface
// ============================================================================

/**
 * Meta Model Registry
 * Manages registered model definitions and model instances
 */
export interface MetaModelRegistry {
  /** Registered model definitions */
  definitions: Map<string, ModelDefinition>;
  /** Model instances (Map<instanceId, instance> for each model ID) */
  instances: Map<string, Map<string, unknown>>;
}

// ============================================================================
// Meta Config Interface (extends base config)
// ============================================================================

/**
 * Additional settings for meta model
 */
export interface MetaModelConfig {
  /** Custom model definitions */
  models?: ModelDefinition[];
  /** External SSOT settings */
  externalSsot?: {
    openapi?: {
      enabled: boolean;
      paths: string[];
    };
    ddl?: {
      enabled: boolean;
      type: 'ddl' | 'prisma' | 'typeorm' | 'drizzle';
      path: string;
    };
    iac?: {
      enabled: boolean;
      type: 'cloudformation' | 'cdk' | 'terraform';
      path: string;
    };
  };
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Base type for model instances
 * All model instances have an id
 */
export interface BaseModelInstance {
  id: string;
}

/**
 * Helper type for creating type-safe model definitions
 */
export type InferModelType<T extends ModelDefinition> = z.infer<T['schema']>;

// ============================================================================
// Zod Schemas for Meta Types
// ============================================================================

export const ReferenceDefinitionSchema = z.object({
  field: z.string(),
  targetModel: z.string(),
  required: z.boolean().optional(),
  isArray: z.boolean().optional(),
});

export const LintIssueSchema = z.object({
  message: z.string(),
  field: z.string().optional(),
  suggestion: z.string().optional(),
});

export const CheckErrorSchema = z.object({
  message: z.string(),
  modelId: z.string(),
  externalRef: z.string().optional(),
});

export const CheckWarningSchema = z.object({
  message: z.string(),
  modelId: z.string(),
});

export const CheckResultSchema = z.object({
  success: z.boolean(),
  errors: z.array(CheckErrorSchema),
  warnings: z.array(CheckWarningSchema),
});
