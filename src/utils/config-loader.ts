import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';

// ============================================================================
// Configuration Types
// ============================================================================

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

/**
 * Merge a loaded config document over the defaults
 *
 * A config file that does not yield a plain object carries no settings, so it is
 * rejected instead of collapsing into the defaults.
 */
function mergeOverDefaults(parsed: unknown, resolvedPath: string): SpeckeeperConfig {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `Config at ${resolvedPath} must export an object, received ${parsed === null ? 'null' : typeof parsed}`,
    );
  }

  return { ...defaultConfig, ...(parsed as Partial<SpeckeeperConfig>) };
}

/**
 * Load the project config
 *
 * Returns the built-in defaults only when no config file exists. A config file
 * that exists but cannot be loaded throws, so callers fail instead of reporting
 * success against settings that were never applied.
 */
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
      return mergeOverDefaults(parseYaml(content), resolvedPath);
    }

    if (ext === 'json') {
      const content = readFileSync(resolvedPath, 'utf-8');
      return mergeOverDefaults(JSON.parse(content), resolvedPath);
    }

    if (ext === 'ts' || ext === 'js') {
      const module = await import(resolvedPath);
      return mergeOverDefaults(module.default ?? module, resolvedPath);
    }
  } catch (error) {
    throw new Error(
      `Failed to load config from ${resolvedPath}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  throw new Error(
    `Unsupported config file extension: ${resolvedPath}. ` +
    `Supported extensions: ${CONFIG_FILES.map(file => file.split('.').pop()).join(', ')}`,
  );
}
