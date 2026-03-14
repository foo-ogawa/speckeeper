import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Specification-compliant output path definitions
 * 
 * Human-readable artifacts (docs/):
 *   requirements/     - Requirements Markdown
 *   usecases/         - Use cases
 *   architecture/     - Architecture (C4 diagrams)
 *   data-model/       - Conceptual model (ER diagrams)
 *   screens/          - Screen specifications
 *   flows/            - Process flows
 *   glossary/         - Glossary
 * 
 * Machine-readable artifacts (specs/):
 *   schemas/entities/       - Entity JSON Schema
 *   index.json              - Aggregated data
 */
export interface OutputPaths {
  // docs/ subdirectories
  requirements: string;
  usecases: string;
  architecture: string;
  dataModel: string;
  screens: string;
  flows: string;
  glossary: string;
  component: string;
  
  // specs/ subdirectories
  schemasEntities: string;
}

export interface SpeckeeperConfig {
  // Project info
  projectName?: string;
  version?: string;
  
  // Source paths
  srcDir: string;
  requirementsDir?: string;
  designDir?: string;
  usecasesDir?: string;
  
  // Output paths
  docsDir: string;
  specsDir: string;
  
  // Global source definitions for spec ID scanning
  sources?: import('../core/config-api.js').SourceConfig[];
  
  // External SSOT paths
  externalSsot?: {
    openapi?: {
      enabled: boolean;
      paths: string[];
      microContracts?: {
        enabled: boolean;
        requiredExtensions?: string[];
        strictMode?: boolean;
      };
    };
    ddl?: {
      enabled: boolean;
      paths: string[];
      type: 'ddl' | 'prisma' | 'typeorm' | 'drizzle';
    };
    iac?: {
      enabled: boolean;
      paths: string[];
      type: 'cloudformation' | 'terraform' | 'cdk';
    };
  };
  
  // Lint configuration
  lint?: {
    architecture?: {
      allowCrossBoundaryDependencies?: boolean;
      allowCrossLayerViolations?: boolean;
      maxComponentsPerDiagram?: number;
    };
    conceptModel?: {
      requireEntityDescription?: boolean;
      requireAggregateRoot?: boolean;
      warnOnOrphanEntities?: boolean;
      namingConvention?: 'PascalCase' | 'camelCase' | 'snake_case' | 'none';
    };
    screen?: {
      warnOnOrphanScreens?: boolean;
      warnOnDeadEnds?: boolean;
      checkAuthPaths?: boolean;
    };
    phaseGate?: {
      currentPhase?: 'REQ' | 'HLD' | 'LLD' | 'OPS';
      strictMode?: boolean;
    };
  };
  
  // Build configuration
  build?: {
    generateMermaidImages?: boolean;
    mermaidCliPath?: string;
  };
  
  // Custom model definitions
  models?: unknown[];
  
  // Spec data entries (from design/index.ts via mergeSpecs())
  specs?: import('../core/model.js').SpecEntry[];
  
  // Coverage configuration
  coverage?: {
    transitiveRelations?: string[];
  };
}

// Default configuration
const defaultConfig: SpeckeeperConfig = {
  srcDir: 'src',
  designDir: 'design',  // Directory for requirements/design TS models
  docsDir: 'docs',
  specsDir: 'specs',
};

// ============================================================================
// Output Paths (spec-compliant)
// ============================================================================

/**
 * Get output paths compliant with specification
 */
export function getOutputPaths(config: SpeckeeperConfig, cwd: string = process.cwd()): OutputPaths {
  const docsDir = resolve(cwd, config.docsDir);
  const specsDir = resolve(cwd, config.specsDir);
  
  return {
    // docs/ subdirectories (compliant with spec section 7.1)
    requirements: join(docsDir, 'requirements'),
    usecases: join(docsDir, 'usecases'),
    architecture: join(docsDir, 'architecture'),
    dataModel: join(docsDir, 'data-model'),
    screens: join(docsDir, 'screens'),
    flows: join(docsDir, 'flows'),
    glossary: join(docsDir, 'glossary'),
    component: join(docsDir, 'component'),
    
    // specs/ subdirectories (compliant with spec section 7.1)
    schemasEntities: join(specsDir, 'schemas', 'entities'),
  };
}

/**
 * List of expected output paths (for drift check)
 */
export function getExpectedOutputDirs(config: SpeckeeperConfig, cwd: string = process.cwd()): string[] {
  const paths = getOutputPaths(config, cwd);
  return [
    paths.requirements,
    paths.usecases,
    paths.architecture,
    paths.dataModel,
    paths.screens,
    paths.flows,
    paths.glossary,
    paths.component,
    paths.schemasEntities,
  ];
}

/**
 * Validate if output path complies with specification
 */
export function validateOutputPaths(actualPath: string, config: SpeckeeperConfig, cwd: string = process.cwd()): {
  valid: boolean;
  expectedPaths: string[];
  message?: string;
} {
  const expectedDirs = getExpectedOutputDirs(config, cwd);
  const docsDir = resolve(cwd, config.docsDir);
  const specsDir = resolve(cwd, config.specsDir);
  
  // Check if actualPath is under docs/ or specs/
  const isUnderDocs = actualPath.startsWith(docsDir);
  const isUnderSpecs = actualPath.startsWith(specsDir);
  
  if (!isUnderDocs && !isUnderSpecs) {
    return {
      valid: false,
      expectedPaths: expectedDirs,
      message: `Output path "${actualPath}" is not under docs/ or specs/`,
    };
  }
  
  // Check if under any of the expected paths
  const isValidPath = expectedDirs.some(dir => actualPath.startsWith(dir));
  
  if (!isValidPath) {
    return {
      valid: false,
      expectedPaths: expectedDirs,
      message: `Output path "${actualPath}" does not match spec-compliant paths. Expected one of: ${expectedDirs.map(d => d.replace(cwd + '/', '')).join(', ')}`,
    };
  }
  
  return { valid: true, expectedPaths: expectedDirs };
}

// ============================================================================
// Configuration Loading
// ============================================================================

const CONFIG_FILES = [
  'speckeeper.config.yaml',
  'speckeeper.config.yml',
  'speckeeper.config.json',
  'speckeeper.config.ts',
  'speckeeper.config.js',
];

export function findConfigFile(startDir: string = process.cwd()): string | null {
  let currentDir = startDir;
  
  while (currentDir !== dirname(currentDir)) {
    for (const configFile of CONFIG_FILES) {
      const configPath = resolve(currentDir, configFile);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    currentDir = dirname(currentDir);
  }
  
  return null;
}

export async function loadConfig(
  configPath?: string,
  cwd: string = process.cwd()
): Promise<SpeckeeperConfig> {
  const resolvedPath = configPath ?? findConfigFile(cwd);
  
  if (!resolvedPath) {
    return { ...defaultConfig };
  }
  
  const ext = resolvedPath.split('.').pop()?.toLowerCase();
  
  try {
    if (ext === 'yaml' || ext === 'yml') {
      const content = readFileSync(resolvedPath, 'utf-8');
      const parsed = parseYaml(content) as Partial<SpeckeeperConfig>;
      return { ...defaultConfig, ...parsed };
    }
    
    if (ext === 'json') {
      const content = readFileSync(resolvedPath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<SpeckeeperConfig>;
      return { ...defaultConfig, ...parsed };
    }
    
    if (ext === 'ts' || ext === 'js') {
      const module = await import(resolvedPath);
      const parsed = module.default ?? module;
      return { ...defaultConfig, ...parsed };
    }
    
    return { ...defaultConfig };
  } catch (error) {
    console.error(`Failed to load config from ${resolvedPath}:`, error);
    return { ...defaultConfig };
  }
}

// ============================================================================
// Configuration Validation
// ============================================================================

export function validateConfig(config: SpeckeeperConfig): string[] {
  const errors: string[] = [];
  
  if (!config.srcDir) {
    errors.push('srcDir is required');
  }
  
  if (!config.docsDir) {
    errors.push('docsDir is required');
  }
  
  if (!config.specsDir) {
    errors.push('specsDir is required');
  }
  
  return errors;
}
