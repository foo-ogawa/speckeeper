/**
 * Global Scanner — Scans all configured sources for spec IDs
 *
 * Replaces per-model externalChecker with a single global scan pass.
 * Built-in scanners: openapi, ddl, annotation.
 * Custom scanners can be plugged in via SourceConfig.scanner.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { glob } from 'glob';
import { parse as parseYaml } from 'yaml';
import nodeSqlParser from 'node-sql-parser';
import type { SourceConfig, SourceMatch, SourceScanner } from './config-api.js';
import type { CheckResult, DeepValidationConfig, OpenAPIValidationMapping, DDLValidationMapping } from './model.js';
import { isTypeContainedBy } from './dsl/type-compat.js';

// ============================================================================
// Scan Result Types
// ============================================================================

export interface GlobalScanMatch extends SourceMatch {
  /** Which source config produced this match */
  sourceType: string;
  /** Relation type from the source config */
  relation: 'implements' | 'verifiedBy';
  /** File path where the match was found */
  filePath: string;
}

export type GlobalScanResult = Map<string, GlobalScanMatch[]>;

// ============================================================================
// Built-in: OpenAPI Scanner
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveRef(doc: any, ref: string): any {
  if (!ref.startsWith('#/')) return undefined;
  const parts = ref.substring(2).split('/');
  let current = doc;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function maybeResolveRef(doc: any, value: any): any {
  if (value && typeof value === 'object' && typeof value.$ref === 'string') {
    return resolveRef(doc, value.$ref);
  }
  return value;
}

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

export const openapiScanner: SourceScanner = {
  findSpecIds(content: unknown, specIds: string[], filePath: string): SourceMatch[] {
    const doc = content;
    if (!doc || typeof doc !== 'object') return [];

    const matches: SourceMatch[] = [];
    for (const specId of specIds) {
      const match = findSpecIdInOpenAPI(doc, specId);
      if (match) {
        matches.push({
          specId,
          location: `${filePath}:${match.pathKey}`,
          context: { doc, match },
        });
      }
    }
    return matches;
  },
};

// ============================================================================
// Built-in: DDL Scanner
// ============================================================================

interface TableDefinition {
  name: string;
  columns: Array<{ name: string; type: string }>;
}

function stripSchemaPrefix(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.substring(dotIndex + 1) : name;
}

function parseDDLWithParser(content: string): TableDefinition[] | null {
  const parser = new nodeSqlParser.Parser();
  const tables: TableDefinition[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ast = parser.astify(content) as any;
    const statements = Array.isArray(ast) ? ast : [ast];

    for (const stmt of statements) {
      if (stmt.type !== 'create' || stmt.keyword !== 'table') continue;

      const rawName: string = typeof stmt.table === 'string'
        ? stmt.table
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : (stmt.table as any[])?.[0]?.table ?? '';
      const tableName = stripSchemaPrefix(rawName);

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

function parseDDLWithRegex(content: string): TableDefinition[] {
  const tables: TableDefinition[] = [];
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:[`"']?\w+[`"']?\s*\.\s*)?)[`"']?(\w+)[`"']?\s*\(([\s\S]*?)\);/gi;

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

export const ddlScanner: SourceScanner = {
  findSpecIds(content: unknown, specIds: string[], filePath: string): SourceMatch[] {
    if (typeof content !== 'string') return [];

    let tables = parseDDLWithParser(content);
    if (!tables) {
      tables = parseDDLWithRegex(content);
    }

    const matches: SourceMatch[] = [];
    for (const specId of specIds) {
      const table = tables.find(
        (t) => t.name.toLowerCase() === specId.toLowerCase(),
      );
      if (table) {
        matches.push({
          specId,
          location: `${filePath}:${table.name}`,
          context: { table },
        });
      }
    }
    return matches;
  },
};

// ============================================================================
// Built-in: Annotation Scanner
// ============================================================================

function extractSpecIds(captured: string): string[] {
  return captured.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
}

export const annotationScanner: SourceScanner = {
  findSpecIds(content: unknown, specIds: string[], filePath: string): SourceMatch[] {
    if (typeof content !== 'string') return [];

    const specIdSet = new Set(specIds);
    const matches: SourceMatch[] = [];
    const defaultPattern = /@(?:verifies|implements|traces)\s+([\w-]+(?:[,\s]+[\w-]+)*)/g;

    const lines = content.split('\n');
    for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
      const line = lines[lineNum - 1];
      const copy = new RegExp(defaultPattern.source, defaultPattern.flags);
      let m: RegExpExecArray | null;
      while ((m = copy.exec(line)) !== null) {
        const ids = extractSpecIds(m[1] ?? '');
        for (const id of ids) {
          if (specIdSet.has(id)) {
            matches.push({
              specId: id,
              location: `${filePath}:${lineNum}`,
              context: { filePath, line: lineNum },
            });
          }
        }
      }
    }
    return matches;
  },
};

/**
 * Create an annotation scanner with custom content patterns.
 */
export function createAnnotationScanner(contentPatterns: RegExp[]): SourceScanner {
  return {
    findSpecIds(content: unknown, specIds: string[], filePath: string): SourceMatch[] {
      if (typeof content !== 'string') return [];

      const specIdSet = new Set(specIds);
      const matches: SourceMatch[] = [];

      const lines = content.split('\n');
      for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
        const line = lines[lineNum - 1];
        for (const re of contentPatterns) {
          const copy = new RegExp(re.source, re.flags);
          let m: RegExpExecArray | null;
          while ((m = copy.exec(line)) !== null) {
            const ids = extractSpecIds(m[1] ?? '');
            for (const id of ids) {
              if (specIdSet.has(id)) {
                matches.push({
                  specId: id,
                  location: `${filePath}:${lineNum}`,
                  context: { filePath, line: lineNum },
                });
              }
            }
          }
        }
      }
      return matches;
    },
  };
}

// ============================================================================
// Scanner Registry
// ============================================================================

const BUILT_IN_SCANNERS: Record<string, SourceScanner> = {
  openapi: openapiScanner,
  ddl: ddlScanner,
  annotation: annotationScanner,
};

function getScannerForSource(source: SourceConfig): SourceScanner | null {
  if (source.scanner) return source.scanner;
  if (source.type === 'annotation' && source.contentPatterns && source.contentPatterns.length > 0) {
    return createAnnotationScanner(source.contentPatterns);
  }
  return BUILT_IN_SCANNERS[source.type] ?? null;
}

// ============================================================================
// File Loading
// ============================================================================

function loadFileContent(filePath: string, sourceType: string): unknown {
  const content = readFileSync(filePath, 'utf-8');
  if (!content || content.length === 0) return null;

  if (sourceType === 'openapi') {
    if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    }
    return parseYaml(content);
  }

  return content;
}

// ============================================================================
// Global Scan Orchestrator
// ============================================================================

export interface ScanWarning {
  message: string;
  sourceType: string;
  filePath?: string;
}

export interface GlobalScanOutput {
  matches: GlobalScanResult;
  warnings: ScanWarning[];
}

/**
 * Run global scan across all configured sources.
 * Returns a map of specId -> matches for all spec IDs found.
 */
export function runGlobalScan(
  sources: SourceConfig[],
  specIds: string[],
  basePath?: string,
): GlobalScanOutput {
  const cwd = basePath ?? process.cwd();
  const result: GlobalScanResult = new Map();
  const warnings: ScanWarning[] = [];

  for (const source of sources) {
    const scanner = getScannerForSource(source);
    if (!scanner) {
      warnings.push({
        message: `No scanner found for source type "${source.type}". Provide a custom scanner.`,
        sourceType: source.type,
      });
      continue;
    }

    const allFiles = new Set<string>();
    for (const pattern of source.paths) {
      const found = glob.sync(pattern, {
        cwd,
        ignore: source.exclude ?? [],
      });
      for (const f of found) {
        allFiles.add(f);
      }
    }

    for (const relPath of allFiles) {
      const fullPath = isAbsolute(relPath) ? relPath : join(cwd, relPath);
      if (!existsSync(fullPath)) continue;

      let content: unknown;
      try {
        content = loadFileContent(fullPath, source.type);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push({
          message: `Failed to load ${relPath}: ${msg}`,
          sourceType: source.type,
          filePath: relPath,
        });
        continue;
      }

      if (content == null) continue;

      let matches: SourceMatch[];
      try {
        matches = scanner.findSpecIds(content, specIds, relPath);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push({
          message: `Scanner error for ${relPath}: ${msg}`,
          sourceType: source.type,
          filePath: relPath,
        });
        continue;
      }

      for (const match of matches) {
        const globalMatch: GlobalScanMatch = {
          ...match,
          sourceType: source.type,
          relation: source.relation,
          filePath: relPath,
        };

        const existing = result.get(match.specId);
        if (existing) {
          existing.push(globalMatch);
        } else {
          result.set(match.specId, [globalMatch]);
        }
      }
    }
  }

  return { matches: result, warnings };
}

// ============================================================================
// Deep Validation
// ============================================================================

/**
 * Run deep validation for a spec against its matched sources.
 * Uses the model's deepValidation config to perform Level 2/3 checks.
 */
export function runDeepValidation(
  specId: string,
  matches: GlobalScanMatch[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deepValidation: DeepValidationConfig<any>,
  spec: unknown,
): CheckResult {
  const errors: CheckResult['errors'] = [];
  const warnings: CheckResult['warnings'] = [];

  for (const match of matches) {
    const rule = deepValidation[match.sourceType];
    if (!rule) continue;

    if (match.sourceType === 'openapi') {
      const mapping = rule.mapper(spec) as OpenAPIValidationMapping;
      const ctx = match.context as { doc: unknown; match: { pathKey: string; operation?: unknown; method?: string } } | undefined;
      if (!ctx?.match?.operation) continue;

      validateOpenAPIDeep(specId, mapping, ctx.doc, ctx.match, warnings);
    } else if (match.sourceType === 'ddl') {
      const mapping = rule.mapper(spec) as DDLValidationMapping;
      const ctx = match.context as { table: { name: string; columns: Array<{ name: string; type: string }> } } | undefined;
      if (!ctx?.table) continue;

      validateDDLDeep(specId, mapping, ctx.table, warnings);
    }
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
  };
}

function validateOpenAPIDeep(
  specId: string,
  mapping: OpenAPIValidationMapping,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  match: { pathKey: string; operation?: any; method?: string },
  warnings: CheckResult['warnings'],
): void {
  if (mapping.method && match.operation) {
    const expectedMethod = mapping.method.toLowerCase();
    const actualMethod = match.method?.toLowerCase();
    if (actualMethod && actualMethod !== expectedMethod) {
      warnings.push({
        message: `Method mismatch for "${specId}": expected ${expectedMethod.toUpperCase()}, found ${actualMethod.toUpperCase()}`,
        specId,
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
          message: `Parameter "${expectedParam.name}" not found in operation "${specId}"`,
          specId,
          field: expectedParam.name,
        });
      } else if (expectedParam.type && found.schema?.type) {
        if (!isTypeContainedBy(expectedParam.type, found.schema.type)) {
          warnings.push({
            message: `Parameter "${expectedParam.name}" type mismatch: expected ${expectedParam.type}, found ${found.schema.type}`,
            specId,
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
          message: `Response property "${expectedProp.name}" not found in operation "${specId}"`,
          specId,
          field: expectedProp.name,
        });
      } else if (expectedProp.type && foundProp.type) {
        if (!isTypeContainedBy(expectedProp.type, foundProp.type)) {
          warnings.push({
            message: `Response property "${expectedProp.name}" type mismatch: expected ${expectedProp.type}, found ${foundProp.type}`,
            specId,
            field: expectedProp.name,
          });
        }
      }
    }
  }
}

function validateDDLDeep(
  specId: string,
  mapping: DDLValidationMapping,
  table: { name: string; columns: Array<{ name: string; type: string }> },
  warnings: CheckResult['warnings'],
): void {
  if (!mapping.columns) return;

  for (const expectedCol of mapping.columns) {
    const foundCol = table.columns.find(
      (c) => c.name.toLowerCase() === expectedCol.name.toLowerCase(),
    );

    if (!foundCol) {
      warnings.push({
        message: `Column "${expectedCol.name}" not found in table "${mapping.tableName}"`,
        specId,
        field: expectedCol.name,
      });
      continue;
    }

    if (mapping.checkTypes && expectedCol.type && foundCol.type) {
      if (!isTypeContainedBy(expectedCol.type, foundCol.type)) {
        warnings.push({
          message: `Column "${expectedCol.name}" type mismatch in table "${mapping.tableName}": expected ${expectedCol.type}, found ${foundCol.type}`,
          specId,
          field: expectedCol.name,
        });
      }
    }
  }
}
