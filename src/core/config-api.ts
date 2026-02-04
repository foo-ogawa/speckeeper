/**
 * Configuration API for speckeeper
 * 
 * Provides `defineConfig` and `defineModel` functions for users to
 * create speckeeper.config.ts files with custom model definitions.
 */

import { z } from 'zod';
import type {
  ModelDefinition,
  MarkdownExporter,
  MermaidExporter,
  JsonSchemaExporter,
  LintRule,
  ExternalChecker,
  ReferenceDefinition,
} from '../types/meta-model.js';
import { registerModelDefinitions } from './model-registry.js';

// ============================================================================
// Config Types
// ============================================================================

/**
 * speckeeper configuration type
 */
export interface SpeckeeperConfigInput {
  /** Project name */
  projectName?: string;
  /** Project version */
  version?: string;
  /** Design files directory */
  designDir?: string;
  /** Docs output directory */
  docsDir?: string;
  /** Specs output directory */
  specsDir?: string;
  /** Custom model definitions (Model instances or ModelDefinition objects) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  models?: any[];
  /** External SSOT configuration */
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
  /** Lint configuration */
  lint?: {
    /** Strict mode */
    strict?: boolean;
    /** Disable specific rules */
    disabledRules?: string[];
  };
}

/**
 * Resolved speckeeper configuration
 */
export interface ResolvedSpeckeeperConfig extends SpeckeeperConfigInput {
  designDir: string;
  docsDir: string;
  specsDir: string;
}

// ============================================================================
// Config API
// ============================================================================

/**
 * Define speckeeper configuration
 * 
 * @example
 * ```typescript
 * // speckeeper.config.ts
 * import { defineConfig, defineModel } from 'speckeeper';
 * 
 * export default defineConfig({
 *   projectName: 'My Project',
 *   models: [
 *     // Custom model definitions
 *   ],
 * });
 * ```
 */
export function defineConfig(input: SpeckeeperConfigInput): ResolvedSpeckeeperConfig {
  const resolved: ResolvedSpeckeeperConfig = {
    ...input,
    designDir: input.designDir ?? 'design',
    docsDir: input.docsDir ?? 'docs',
    specsDir: input.specsDir ?? 'specs',
  };
  
  // Register custom models
  if (input.models && input.models.length > 0) {
    registerModelDefinitions(input.models);
  }
  
  return resolved;
}

// ============================================================================
// Model Definition API
// ============================================================================

/**
 * Model definition input type
 */
export interface ModelDefinitionInput<T extends z.ZodTypeAny> {
  /** Unique identifier for the model (kebab-case recommended) */
  id: string;
  /** Model name (PascalCase recommended) */
  name: string;
  /** Model description */
  description: string;
  /** Zod schema */
  schema: T;
  /** Prefix for ID generation */
  idPrefix: string;
  /** Exporter configuration */
  exporters?: {
    markdown?: MarkdownExporter<z.infer<T>>;
    mermaid?: MermaidExporter<z.infer<T>> | MermaidExporter<z.infer<T>>[];
    jsonSchema?: JsonSchemaExporter;
  };
  /** Lint rules */
  lintRules?: LintRule<z.infer<T>>[];
  /** External SSOT checker */
  externalChecker?: ExternalChecker<z.infer<T>>;
  /** Reference definitions */
  references?: ReferenceDefinition[];
  /** DSL function name */
  dslName?: string;
  /** Phase */
  phase?: 'REQ' | 'HLD' | 'LLD' | 'OPS';
}

/**
 * Create a custom model definition
 * 
 * @example
 * ```typescript
 * const RetryPolicyModel = defineModel({
 *   id: 'retry-policy',
 *   name: 'RetryPolicy',
 *   description: 'Retry policy definition',
 *   schema: z.object({
 *     id: z.string(),
 *     name: z.string(),
 *     maxAttempts: z.number().min(1),
 *     initialDelay: z.number().min(0),
 *     backoffMultiplier: z.number().min(1),
 *   }),
 *   idPrefix: 'RETRY',
 *   exporters: {
 *     markdown: {
 *       single: (m) => `# ${m.name}\n\n- Max Attempts: ${m.maxAttempts}`,
 *       outputDir: 'docs/retry-policies',
 *     },
 *   },
 *   lintRules: [
 *     {
 *       id: 'retry-max-limit',
 *       description: 'maxAttempts should not exceed 10',
 *       severity: 'warning',
 *       check: (m) => m.maxAttempts > 10 
 *         ? { message: `maxAttempts ${m.maxAttempts} exceeds recommended limit` } 
 *         : null,
 *     },
 *   ],
 * });
 * ```
 */
export function defineModel<T extends z.ZodTypeAny>(
  input: ModelDefinitionInput<T>
): ModelDefinition<T> {
  const definition: ModelDefinition<T> = {
    id: input.id,
    name: input.name,
    description: input.description,
    schema: input.schema,
    idPrefix: input.idPrefix,
    exporters: input.exporters,
    lintRules: input.lintRules,
    externalChecker: input.externalChecker,
    references: input.references,
    dslName: input.dslName,
    phase: input.phase,
  };
  
  return definition;
}

// ============================================================================
// Helper Functions for Creating Exporters
// ============================================================================

/**
 * Helper to create Markdown exporter
 */
export function createMarkdownExporter<T>(
  config: {
    outputDir: string;
    single: (model: T, context: unknown) => string;
    index?: (models: T[], context: unknown) => string;
    filename?: (model: T) => string;
  }
): MarkdownExporter<T> {
  return {
    single: config.single,
    index: config.index,
    outputDir: config.outputDir,
    filename: config.filename,
  };
}

/**
 * Helper to create Mermaid diagram exporter
 */
export function createMermaidExporter<T>(
  config: {
    diagramType: MermaidExporter<T>['diagramType'];
    outputPath: string;
    generate: (models: T[], context: unknown) => string;
    title?: string;
  }
): MermaidExporter<T> {
  return {
    diagramType: config.diagramType,
    outputPath: config.outputPath,
    generate: config.generate,
    title: config.title,
  };
}

/**
 * Helper to create lint rule
 */
export function createLintRule<T>(
  config: {
    id: string;
    description: string;
    severity: 'error' | 'warning' | 'info';
    check: (model: T, context: unknown) => { message: string; field?: string; suggestion?: string } | null;
  }
): LintRule<T> {
  return {
    id: config.id,
    description: config.description,
    severity: config.severity,
    check: config.check,
  };
}

// ============================================================================
// Config Loading
// ============================================================================

/**
 * Load speckeeper.config.ts file and register custom models
 */
export async function loadSpeckeeperConfig(configPath?: string): Promise<ResolvedSpeckeeperConfig | null> {
  const possiblePaths = configPath 
    ? [configPath]
    : [
        'speckeeper.config.ts',
        'speckeeper.config.js',
        'speckeeper.config.mjs',
      ];
  
  for (const path of possiblePaths) {
    try {
      const fullPath = path.startsWith('/') ? path : `${process.cwd()}/${path}`;
      const module = await import(fullPath);
      const config = module.default || module;
      
      if (config && typeof config === 'object') {
        // Register custom models
        if (config.models && Array.isArray(config.models)) {
          registerModelDefinitions(config.models);
        }
        
        return {
          ...config,
          designDir: config.designDir ?? 'design',
          docsDir: config.docsDir ?? 'docs',
          specsDir: config.specsDir ?? 'specs',
        };
      }
    } catch {
      // Config file not found or invalid, continue to next
    }
  }
  
  return null;
}
