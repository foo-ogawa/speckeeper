/**
 * Core DSL — Checker and coverage factories
 *
 * Target-class-specific external checkers and relation-based coverage checkers.
 * Scaffold auto-binds these based on edge type and target node class.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { glob } from 'glob';
import { parse as parseYaml } from 'yaml';
import nodeSqlParser from 'node-sql-parser';
import type { ExternalChecker, CheckResult, CoverageChecker, CoverageResult } from '../model.js';
import type { ArtifactConfig } from '../config-api.js';
import { isTypeContainedBy } from './type-compat.js';

// ---------------------------------------------------------------------------
// Test checker (target class: "test")
// ---------------------------------------------------------------------------

export interface TestCheckerConfig<T> {
  sourcePath?: (spec: T) => string;
}

/**
 * Creates an ExternalChecker that verifies test file existence and spec ID references.
 */
export function testChecker<T extends { id: string }>(
  config?: TestCheckerConfig<T>,
): ExternalChecker<T> {
  return {
    targetType: 'test',
    sourcePath: config?.sourcePath ?? (() => '.'),
    check: (spec): CheckResult => {
      const errors: CheckResult['errors'] = [];
      const warnings: CheckResult['warnings'] = [];
      const basePath = process.cwd();

      const testPatterns = [
        'test/**/*.test.ts',
        'test/**/*.spec.ts',
        'tests/**/*.test.ts',
        'tests/**/*.spec.ts',
      ];

      let testFiles: string[] = [];
      for (const pattern of testPatterns) {
        testFiles = testFiles.concat(glob.sync(pattern, { cwd: basePath }));
      }

      if (testFiles.length === 0) {
        warnings.push({ message: `No test files found for ${spec.id}`, specId: spec.id });
        return { success: true, errors, warnings };
      }

      let specIdFound = false;
      for (const testFile of testFiles) {
        const fullPath = join(basePath, testFile);
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const patterns = [
            new RegExp(`describe\\s*\\(\\s*['"\`].*${spec.id}`, 'm'),
            new RegExp(`it\\s*\\(\\s*['"\`].*${spec.id}`, 'm'),
            new RegExp(`test\\s*\\(\\s*['"\`].*${spec.id}`, 'm'),
          ];
          if (patterns.some(p => p.test(content))) {
            specIdFound = true;
            break;
          }
        } catch {
          // skip unreadable files
        }
      }

      if (!specIdFound) {
        warnings.push({
          message: `Spec ID "${spec.id}" not found in any test file`,
          specId: spec.id,
        });
      }

      return { success: errors.length === 0, errors, warnings };
    },
  };
}

// ---------------------------------------------------------------------------
// Annotation checker (target type: "annotation")
// ---------------------------------------------------------------------------

export type AnnotationRelationType = 'verifiedBy' | 'implements' | 'traces';

export interface AnnotationCheckEntry {
  artifact: string;
  relationType: AnnotationRelationType;
  contentPatterns?: RegExp[];
  checker?: ExternalChecker<{ id: string }>;
}

export interface AnnotationCheckerConfig<_T extends { id: string }> {
  artifact?: string;
  relationType?: AnnotationRelationType;
  checks?: AnnotationCheckEntry[];
  contentPatterns?: RegExp[];
}

function relationTypeToAnnotation(relationType: AnnotationRelationType): string {
  return relationType === 'verifiedBy' ? 'verifies' : relationType;
}

function getDefaultPatternForRelation(relationType: AnnotationRelationType): RegExp {
  const ann = relationTypeToAnnotation(relationType);
  return new RegExp(`@${ann}\\s+([\\w-]+(?:[,\\s]+[\\w-]+)*)`, 'g');
}

function extractSpecIds(captured: string): string[] {
  return captured.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
}

let _artifactsConfig: Record<string, ArtifactConfig> | undefined;

export function setArtifactsConfig(config: Record<string, ArtifactConfig>): void {
  _artifactsConfig = config;
}

export function getArtifactsConfig(): Record<string, ArtifactConfig> | undefined {
  return _artifactsConfig;
}

type MatchedFile = NonNullable<CheckResult['matchedFiles']>[number];

function runAnnotationScan(
  specId: string,
  artifact: string,
  relationType: AnnotationRelationType,
  contentPatterns: RegExp[],
  basePath: string,
): { matchedFiles: MatchedFile[]; warnings: CheckResult['warnings'] } {
  const matchedFiles: MatchedFile[] = [];
  const warnings: CheckResult['warnings'] = [];

  const artifactsConfig = getArtifactsConfig();
  const artifactConfig = artifactsConfig?.[artifact];
  if (!artifactConfig) {
    warnings.push({
      message: `Artifact config "${artifact}" not found; set artifacts in config and call setArtifactsConfig()`,
      specId,
    });
    return { matchedFiles, warnings };
  }

  const allFiles = new Set<string>();
  for (const pattern of artifactConfig.globs) {
    const found = glob.sync(pattern, {
      cwd: basePath,
      ignore: artifactConfig.exclude ?? [],
    });
    for (const f of found) {
      allFiles.add(f);
    }
  }

  const patterns =
    contentPatterns.length > 0
      ? contentPatterns
      : [getDefaultPatternForRelation(relationType)];

  for (const filePath of allFiles) {
    const fullPath = join(basePath, filePath);
    let content: string;
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
      const line = lines[lineNum - 1];
      for (const re of patterns) {
        const copy = new RegExp(re.source, re.flags);
        let m: RegExpExecArray | null;
        while ((m = copy.exec(line)) !== null) {
          const ids = extractSpecIds(m[1] ?? '');
          if (ids.includes(specId)) {
            matchedFiles.push({ specId, filePath, line: lineNum, relationType });
          }
        }
      }
    }
  }

  return { matchedFiles, warnings };
}

export function annotationChecker<T extends { id: string }>(
  config?: AnnotationCheckerConfig<T>,
): ExternalChecker<T> {
  return {
    targetType: 'annotation',
    sourcePath: () => '.',
    check: (spec, _externalData): CheckResult => {
      const errors: CheckResult['errors'] = [];
      const warnings: CheckResult['warnings'] = [];
      const allMatchedFiles: MatchedFile[] = [];

      const basePath = process.cwd();

      const checks: AnnotationCheckEntry[] =
        config?.artifact && config?.relationType
          ? [
              {
                artifact: config.artifact,
                relationType: config.relationType,
                contentPatterns: config.contentPatterns,
              },
            ]
          : config?.checks ?? [];

      for (const entry of checks) {
        if (entry.checker) {
          const result = entry.checker.check(spec, undefined);
          errors.push(...result.errors);
          warnings.push(...result.warnings);
          if (result.matchedFiles) {
            allMatchedFiles.push(...result.matchedFiles);
          }
        } else {
          const patterns =
            entry.contentPatterns ??
            getArtifactsConfig()?.[entry.artifact]?.contentPatterns ??
            [];
          const { matchedFiles, warnings: w } = runAnnotationScan(
            spec.id,
            entry.artifact,
            entry.relationType,
            Array.isArray(patterns) ? patterns : [patterns],
            basePath,
          );
          warnings.push(...w);
          allMatchedFiles.push(...matchedFiles);
        }
      }

      if (checks.length > 0 && allMatchedFiles.length === 0) {
        warnings.push({
          message: `No annotation matches found for spec "${spec.id}"`,
          specId: spec.id,
        });
      }

      return {
        success: errors.length === 0,
        errors,
        warnings,
        matchedFiles: allMatchedFiles.length > 0 ? allMatchedFiles : undefined,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Annotation coverage checker
// ---------------------------------------------------------------------------

export interface AnnotationCoverageConfig {
  artifact: string;
  relationType: AnnotationRelationType;
  description: string;
  contentPatterns?: RegExp[];
}

export function annotationCoverage<T extends { id: string }>(
  config: AnnotationCoverageConfig,
): CoverageChecker<T> {
  return {
    targetModel: 'annotation',
    description: config.description,
    check: (specs, _registry): CoverageResult => {
      const basePath = process.cwd();
      const allSpecIds = new Set(specs.map((s) => s.id));
      const coveredIds = new Set<string>();

      const artifactsConfig = getArtifactsConfig();
      const artifactConfig = artifactsConfig?.[config.artifact];
      if (!artifactConfig) {
        return {
          total: allSpecIds.size,
          covered: 0,
          uncovered: allSpecIds.size,
          coveragePercent: 0,
          coveredItems: [],
          uncoveredItems: Array.from(allSpecIds).map((id) => ({ id })),
        };
      }

      const allFiles = new Set<string>();
      for (const pattern of artifactConfig.globs) {
        const found = glob.sync(pattern, {
          cwd: basePath,
          ignore: artifactConfig.exclude ?? [],
        });
        for (const f of found) {
          allFiles.add(f);
        }
      }

      const patterns =
        config.contentPatterns ??
        artifactConfig.contentPatterns ??
        [getDefaultPatternForRelation(config.relationType)];

      const patternList = Array.isArray(patterns) ? patterns : [patterns];

      for (const filePath of allFiles) {
        const fullPath = join(basePath, filePath);
        let content: string;
        try {
          content = readFileSync(fullPath, 'utf-8');
        } catch {
          continue;
        }

        const lines = content.split('\n');
        for (const line of lines) {
          for (const re of patternList) {
            const copy = new RegExp(re.source, re.flags);
            let m: RegExpExecArray | null;
            while ((m = copy.exec(line)) !== null) {
              const ids = extractSpecIds(m[1] ?? '');
              for (const id of ids) {
                if (allSpecIds.has(id)) {
                  coveredIds.add(id);
                }
              }
            }
          }
        }
      }

      const coveredItems = Array.from(coveredIds).map((id) => ({ id }));
      const uncoveredItems = Array.from(allSpecIds)
        .filter((id) => !coveredIds.has(id))
        .map((id) => ({ id }));

      const total = allSpecIds.size;
      const covered = coveredItems.length;
      const coveragePercent = total > 0 ? Math.round((covered / total) * 100) : 100;

      return {
        total,
        covered,
        uncovered: total - covered,
        coveragePercent,
        coveredItems,
        uncoveredItems,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// OpenAPI checker (target class: "openapi")
// ---------------------------------------------------------------------------

export interface OpenAPICheckerConfig<T> {
  sourcePath?: (spec: T) => string;
  mapper: (spec: T) => {
    path: string;
    method?: string;
    parameters?: Array<{ name: string; in?: string; type?: string }>;
    responseProperties?: Array<{ name: string; type?: string }>;
  };
}

/**
 * Resolve a local $ref pointer (e.g., "#/components/schemas/User") within a document.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveRef(doc: any, ref: string): any {
  if (!ref.startsWith('#/')) return undefined;
  const parts = ref.substring(2).split('/');
  let current = doc;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Resolve $ref if the value is a reference object, otherwise return as-is.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maybeResolveRef(doc: any, value: any): any {
  if (value && typeof value === 'object' && typeof value.$ref === 'string') {
    return resolveRef(doc, value.$ref);
  }
  return value;
}

/**
 * Search for a spec ID in an OpenAPI document.
 * Returns the matched path key and operation (if found).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findSpecIdInOpenAPI(doc: any, specId: string): { pathKey: string; operation?: any; method?: string } | null {
  const paths = doc.paths;
  if (!paths || typeof paths !== 'object') return null;

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (pathItem == null || typeof pathItem !== 'object') continue;
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
    for (const method of methods) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const op = (pathItem as any)[method];
      if (!op) continue;
      if (op.operationId === specId) return { pathKey, operation: op, method };
      if (op['x-spec-id'] === specId) return { pathKey, operation: op, method };
    }
  }

  for (const pathKey of Object.keys(paths)) {
    const segments = pathKey.split('/').filter(Boolean);
    const cleanSegments = segments.map(s => s.replace(/^\{|\}$/g, ''));
    if (cleanSegments.includes(specId)) return { pathKey };
  }

  const schemas = doc.components?.schemas;
  if (schemas && typeof schemas === 'object') {
    if (specId in schemas) return { pathKey: `#/components/schemas/${specId}` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function searchXSpecId(obj: any): boolean {
    if (obj == null || typeof obj !== 'object') return false;
    if (obj['x-spec-id'] === specId) return true;
    for (const val of Object.values(obj)) {
      if (searchXSpecId(val)) return true;
    }
    return false;
  }
  if (searchXSpecId(doc)) return { pathKey: '(x-spec-id match)' };

  return null;
}

/**
 * Creates an ExternalChecker that verifies consistency with an OpenAPI spec file.
 *
 * Three validation levels:
 * 1. Existence: spec ID found in operationId, path segment, schema name, or x-spec-id
 * 2. Structural: HTTP method matches the matched path
 * 3. Type: parameter/response property names and types match
 */
export function externalOpenAPIChecker<T extends { id: string }>(
  config?: OpenAPICheckerConfig<T>,
): ExternalChecker<T> {
  return {
    targetType: 'openapi',
    sourcePath: config?.sourcePath ?? (() => 'api/openapi.yaml'),
    check: (spec): CheckResult => {
      const errors: CheckResult['errors'] = [];
      const warnings: CheckResult['warnings'] = [];

      const filePath = (config?.sourcePath ?? (() => 'api/openapi.yaml'))(spec);
      const fullPath = isAbsolute(filePath) ? filePath : join(process.cwd(), filePath);

      if (!existsSync(fullPath)) {
        errors.push({ message: `OpenAPI file not found: ${filePath}`, specId: spec.id });
        return { success: false, errors, warnings };
      }

      let content: string;
      try {
        content = readFileSync(fullPath, 'utf-8');
      } catch {
        errors.push({ message: `Failed to read OpenAPI file: ${filePath}`, specId: spec.id });
        return { success: false, errors, warnings };
      }

      if (content.length === 0) {
        errors.push({ message: `OpenAPI file is empty: ${filePath}`, specId: spec.id });
        return { success: false, errors, warnings };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let doc: any;
      try {
        if (fullPath.endsWith('.json')) {
          doc = JSON.parse(content);
        } else {
          doc = parseYaml(content);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ message: `Failed to parse OpenAPI file ${filePath}: ${msg}`, specId: spec.id });
        return { success: false, errors, warnings };
      }

      const match = findSpecIdInOpenAPI(doc, spec.id);
      if (!match) {
        warnings.push({ message: `Spec ID "${spec.id}" not found in OpenAPI document ${filePath}`, specId: spec.id });
        return { success: true, errors, warnings };
      }

      if (!config?.mapper) {
        return { success: errors.length === 0, errors, warnings };
      }

      const mapping = config.mapper(spec);

      if (mapping.method && match.operation) {
        const expectedMethod = mapping.method.toLowerCase();
        const actualMethod = match.method?.toLowerCase();
        if (actualMethod && actualMethod !== expectedMethod) {
          warnings.push({
            message: `Method mismatch for "${spec.id}": expected ${expectedMethod.toUpperCase()}, found ${actualMethod.toUpperCase()}`,
            specId: spec.id,
          });
        }
      }

      if (match.operation && mapping.parameters) {
        const opParams: Array<{ name: string; in?: string; schema?: { type?: string } }> =
          (match.operation.parameters || []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (p: any) => maybeResolveRef(doc, p),
          );

        for (const expectedParam of mapping.parameters) {
          const found = opParams.find(
            (p) => p?.name === expectedParam.name && (!expectedParam.in || p?.in === expectedParam.in),
          );
          if (!found) {
            warnings.push({
              message: `Parameter "${expectedParam.name}" not found in operation "${spec.id}"`,
              specId: spec.id,
              field: expectedParam.name,
            });
          } else if (expectedParam.type && found.schema?.type) {
            if (!isTypeContainedBy(expectedParam.type, found.schema.type)) {
              warnings.push({
                message: `Parameter "${expectedParam.name}" type mismatch: expected ${expectedParam.type}, found ${found.schema.type}`,
                specId: spec.id,
                field: expectedParam.name,
              });
            }
          }
        }
      }

      if (match.operation && mapping.responseProperties) {
        const successResponse = match.operation.responses?.['200'] || match.operation.responses?.['201'];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let responseSchema: any = successResponse?.content?.['application/json']?.schema;
        responseSchema = maybeResolveRef(doc, responseSchema);

        if (responseSchema?.type === 'array') {
          responseSchema = maybeResolveRef(doc, responseSchema.items);
        }

        const responseProps = responseSchema?.properties || {};

        for (const expectedProp of mapping.responseProperties) {
          const foundProp = responseProps[expectedProp.name];
          if (!foundProp) {
            warnings.push({
              message: `Response property "${expectedProp.name}" not found in operation "${spec.id}"`,
              specId: spec.id,
              field: expectedProp.name,
            });
          } else if (expectedProp.type && foundProp.type) {
            if (!isTypeContainedBy(expectedProp.type, foundProp.type)) {
              warnings.push({
                message: `Response property "${expectedProp.name}" type mismatch: expected ${expectedProp.type}, found ${foundProp.type}`,
                specId: spec.id,
                field: expectedProp.name,
              });
            }
          }
        }
      }

      return { success: errors.length === 0, errors, warnings };
    },
  };
}

// ---------------------------------------------------------------------------
// SQL Schema checker (target class: "sqlschema")
// ---------------------------------------------------------------------------

export interface SqlSchemaCheckerConfig<T> {
  sourcePath?: (spec: T) => string;
  mapper: (spec: T) => {
    tableName: string;
    columns?: Array<{ name: string; type?: string }>;
  };
  checkTypes?: boolean;
}

interface TableDefinition {
  name: string;
  columns: Array<{ name: string; type: string }>;
}

/**
 * Parse DDL using node-sql-parser. Returns table definitions.
 */
function parseDDLWithParser(content: string): TableDefinition[] | null {
  const parser = new nodeSqlParser.Parser();
  const tables: TableDefinition[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ast = parser.astify(content) as any;
    const statements = Array.isArray(ast) ? ast : [ast];

    for (const stmt of statements) {
      if (stmt.type !== 'create' || stmt.keyword !== 'table') continue;

      const tableName: string = typeof stmt.table === 'string'
        ? stmt.table
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : (stmt.table as any[])?.[0]?.table ?? '';

      const columns: Array<{ name: string; type: string }> = (stmt.create_definitions || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((def: any) => def.resource === 'column')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((def: any) => {
          const colName = def.column?.column ?? '';
          let colType = def.definition?.dataType ?? '';
          if (def.definition?.length) {
            colType += `(${def.definition.length})`;
          }
          if (def.definition?.scale) {
            colType = colType.replace(/\)$/, `,${def.definition.scale})`);
          }
          return { name: colName, type: colType };
        });

      if (tableName) {
        tables.push({ name: tableName, columns });
      }
    }

    return tables.length > 0 ? tables : null;
  } catch {
    return null;
  }
}

/**
 * Regex-based fallback for DDL parsing when node-sql-parser fails.
 * Extracts CREATE TABLE ... (...columns...) patterns.
 */
function parseDDLWithRegex(content: string): TableDefinition[] {
  const tables: TableDefinition[] = [];
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|')?(\w+)(?:`|"|')?\s*\(([\s\S]*?)\);/gi;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns: Array<{ name: string; type: string }> = [];

    const lines = body.split(',').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^\s*(PRIMARY\s+KEY|UNIQUE|CHECK|CONSTRAINT|INDEX|FOREIGN\s+KEY)/i.test(line)) continue;

      const colMatch = line.match(/^(?:`|"|')?(\w+)(?:`|"|')?\s+(\w+(?:\([^)]*\))?)/i);
      if (colMatch) {
        columns.push({ name: colMatch[1], type: colMatch[2] });
      }
    }

    if (tableName) {
      tables.push({ name: tableName, columns });
    }
  }

  return tables;
}

/**
 * Creates an ExternalChecker that verifies consistency with a SQL schema (DDL).
 *
 * Three validation levels:
 * 1. Existence: table name found in DDL
 * 2. Structural: column names exist in the DDL table
 * 3. Type: column types use containment-based comparison
 */
export function externalSqlSchemaChecker<T extends { id: string }>(
  config?: SqlSchemaCheckerConfig<T>,
): ExternalChecker<T> {
  return {
    targetType: 'ddl',
    sourcePath: config?.sourcePath ?? (() => 'db/schema.sql'),
    check: (spec): CheckResult => {
      const errors: CheckResult['errors'] = [];
      const warnings: CheckResult['warnings'] = [];

      const filePath = (config?.sourcePath ?? (() => 'db/schema.sql'))(spec);
      const fullPath = isAbsolute(filePath) ? filePath : join(process.cwd(), filePath);

      if (!existsSync(fullPath)) {
        errors.push({ message: `DDL file not found: ${filePath}`, specId: spec.id });
        return { success: false, errors, warnings };
      }

      let content: string;
      try {
        content = readFileSync(fullPath, 'utf-8');
      } catch {
        errors.push({ message: `Failed to read DDL file: ${filePath}`, specId: spec.id });
        return { success: false, errors, warnings };
      }

      if (content.length === 0) {
        errors.push({ message: `DDL file is empty: ${filePath}`, specId: spec.id });
        return { success: false, errors, warnings };
      }

      let tables = parseDDLWithParser(content);
      if (!tables) {
        warnings.push({ message: `DDL parser failed for ${filePath}, using regex fallback`, specId: spec.id });
        tables = parseDDLWithRegex(content);
      }

      if (!config?.mapper) {
        return { success: errors.length === 0, errors, warnings };
      }

      const mapping = config.mapper(spec);

      const table = tables.find(
        (t) => t.name.toLowerCase() === mapping.tableName.toLowerCase(),
      );

      if (!table) {
        warnings.push({
          message: `Table "${mapping.tableName}" not found in DDL file ${filePath}`,
          specId: spec.id,
        });
        return { success: errors.length === 0, errors, warnings };
      }

      if (!mapping.columns) {
        return { success: errors.length === 0, errors, warnings };
      }

      for (const expectedCol of mapping.columns) {
        const foundCol = table.columns.find(
          (c) => c.name.toLowerCase() === expectedCol.name.toLowerCase(),
        );

        if (!foundCol) {
          warnings.push({
            message: `Column "${expectedCol.name}" not found in table "${mapping.tableName}"`,
            specId: spec.id,
            field: expectedCol.name,
          });
          continue;
        }

        if (config.checkTypes && expectedCol.type && foundCol.type) {
          if (!isTypeContainedBy(expectedCol.type, foundCol.type)) {
            warnings.push({
              message: `Column "${expectedCol.name}" type mismatch in table "${mapping.tableName}": expected ${expectedCol.type}, found ${foundCol.type}`,
              specId: spec.id,
              field: expectedCol.name,
            });
          }
        }
      }

      return { success: errors.length === 0, errors, warnings };
    },
  };
}

// ---------------------------------------------------------------------------
// Relation-based coverage checker
// ---------------------------------------------------------------------------

export interface RelationCoverageConfig {
  targetModel: string;
  description: string;
  relationType?: string;
  targetPrefix?: string;
}

/**
 * Creates a CoverageChecker that computes coverage of a target model via relations.
 */
export function relationCoverage<T extends { id: string; relations?: Array<{ type: string; target: string }> }>(
  config: RelationCoverageConfig,
): CoverageChecker<T> {
  return {
    targetModel: config.targetModel,
    description: config.description,
    check: (specs, registry): CoverageResult => {
      const targets = registry[config.targetModel];
      if (!targets) {
        return { total: 0, covered: 0, uncovered: 0, coveragePercent: 100, coveredItems: [], uncoveredItems: [] };
      }

      const allTargetIds = new Set<string>();
      const targetDescriptions = new Map<string, string>();
      for (const t of targets.values() as IterableIterator<{ id: string; name?: string; description?: string }>) {
        if (config.targetPrefix && !t.id.startsWith(config.targetPrefix)) continue;
        allTargetIds.add(t.id);
        targetDescriptions.set(t.id, t.name ?? t.description ?? t.id);
      }

      const coveredIds = new Set<string>();
      for (const spec of specs) {
        if (!spec.relations) continue;
        for (const rel of spec.relations) {
          if (config.relationType && rel.type !== config.relationType) continue;
          if (allTargetIds.has(rel.target)) coveredIds.add(rel.target);
        }
      }

      const coveredItems: CoverageResult['coveredItems'] = [];
      const uncoveredItems: CoverageResult['uncoveredItems'] = [];
      for (const id of allTargetIds) {
        const desc = targetDescriptions.get(id);
        if (coveredIds.has(id)) {
          coveredItems.push({ id, description: desc });
        } else {
          uncoveredItems.push({ id, description: desc });
        }
      }

      const total = allTargetIds.size;
      const covered = coveredItems.length;
      const coveragePercent = total > 0 ? Math.round((covered / total) * 100) : 100;

      return { total, covered, uncovered: total - covered, coveragePercent, coveredItems, uncoveredItems };
    },
  };
}
