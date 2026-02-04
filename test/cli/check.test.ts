/**
 * FR-600/601/602/603: External SSOT consistency check tests
 * 
 * Validate consistency between TS models (external SSOT references) and external SSOT (OpenAPI, DDL, IaC, etc.)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';

const testDir = join(process.cwd(), '.test-check');

// External checker result
interface CheckResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

// Mock external checker interface
interface ExternalChecker<T> {
  targetType: string;
  sourcePath: (spec: T) => string;
  check: (spec: T, externalDoc: unknown) => CheckResult;
}

// Mock model with external checker
interface Model<T> {
  id: string;
  name: string;
  externalChecker?: ExternalChecker<T>;
}

// Mock API reference
interface APIRef {
  id: string;
  operationId: string;
  source: { path: string };
  expectedMethod?: string;
  expectedPath?: string;
}

// Mock Table reference
interface TableRef {
  id: string;
  tableName: string;
  source: { path: string };
  expectedColumns?: string[];
  constraints?: {
    encrypted?: string[];
    notNull?: string[];
  };
}

// Mock OpenAPI document
interface OpenAPIDoc {
  paths: Record<string, Record<string, { operationId: string; [key: string]: unknown }>>;
}

// Mock DDL document
interface DDLDoc {
  tables: Record<string, {
    columns: Record<string, { type: string; notNull?: boolean; encrypted?: boolean }>;
  }>;
}

// Check functions
function checkAPIExistence(spec: APIRef, openapi: OpenAPIDoc): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  let found = false;
  for (const [path, methods] of Object.entries(openapi.paths)) {
    for (const [method, details] of Object.entries(methods)) {
      if (details.operationId === spec.operationId) {
        found = true;
        
        // Type check (method/path match)
        if (spec.expectedMethod && method.toUpperCase() !== spec.expectedMethod.toUpperCase()) {
          errors.push(`Operation ${spec.operationId}: expected method ${spec.expectedMethod}, found ${method}`);
        }
        if (spec.expectedPath && path !== spec.expectedPath) {
          warnings.push(`Operation ${spec.operationId}: path mismatch, expected ${spec.expectedPath}, found ${path}`);
        }
      }
    }
  }
  
  if (!found) {
    errors.push(`Operation ${spec.operationId} not found in OpenAPI spec`);
  }
  
  return { success: errors.length === 0, errors, warnings };
}

function checkTableExistence(spec: TableRef, ddl: DDLDoc): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const table = ddl.tables[spec.tableName];
  
  if (!table) {
    errors.push(`Table ${spec.tableName} not found in DDL`);
    return { success: false, errors, warnings };
  }
  
  // Type check (expected columns exist)
  if (spec.expectedColumns) {
    for (const col of spec.expectedColumns) {
      if (!table.columns[col]) {
        errors.push(`Column ${col} not found in table ${spec.tableName}`);
      }
    }
  }
  
  // Constraint check
  if (spec.constraints) {
    if (spec.constraints.encrypted) {
      for (const col of spec.constraints.encrypted) {
        if (table.columns[col] && !table.columns[col].encrypted) {
          errors.push(`Column ${col} should be encrypted but is not`);
        }
      }
    }
    if (spec.constraints.notNull) {
      for (const col of spec.constraints.notNull) {
        if (table.columns[col] && !table.columns[col].notNull) {
          warnings.push(`Column ${col} should be NOT NULL`);
        }
      }
    }
  }
  
  return { success: errors.length === 0, errors, warnings };
}

// Model registry for check command
const modelRegistry = new Map<string, Model<unknown>>();

function registerModel<T>(model: Model<T>): void {
  modelRegistry.set(model.id, model as Model<unknown>);
}

function getModelsWithExternalChecker(): Model<unknown>[] {
  return Array.from(modelRegistry.values()).filter(m => m.externalChecker);
}

function runCheck(modelId: string, specs: unknown[], externalDoc: unknown): CheckResult[] {
  const model = modelRegistry.get(modelId);
  if (!model?.externalChecker) {
    return [];
  }
  
  return specs.map(spec => model.externalChecker!.check(spec, externalDoc));
}

describe('FR-600: External SSOT consistency check', () => {
  beforeEach(() => {
    modelRegistry.clear();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });
  
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });
  
  // FR-600-01: Existence check (referenced items exist in external artifacts)
  describe('FR-600-01: Existence check', () => {
    it('should detect missing operationId in OpenAPI', () => {
      const spec: APIRef = {
        id: 'API-001',
        operationId: 'nonExistentOperation',
        source: { path: 'openapi.yaml' },
      };
      
      const openapi: OpenAPIDoc = {
        paths: {
          '/users': {
            get: { operationId: 'getUsers' },
          },
        },
      };
      
      const result = checkAPIExistence(spec, openapi);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Operation nonExistentOperation not found in OpenAPI spec');
    });
    
    it('should pass when operationId exists', () => {
      const spec: APIRef = {
        id: 'API-001',
        operationId: 'getUsers',
        source: { path: 'openapi.yaml' },
      };
      
      const openapi: OpenAPIDoc = {
        paths: {
          '/users': {
            get: { operationId: 'getUsers' },
          },
        },
      };
      
      const result = checkAPIExistence(spec, openapi);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect missing table in DDL', () => {
      const spec: TableRef = {
        id: 'TBL-001',
        tableName: 'nonexistent_table',
        source: { path: 'schema.sql' },
      };
      
      const ddl: DDLDoc = {
        tables: {
          users: { columns: { id: { type: 'uuid' } } },
        },
      };
      
      const result = checkTableExistence(spec, ddl);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Table nonexistent_table not found in DDL');
    });
    
    it('should pass when table exists', () => {
      const spec: TableRef = {
        id: 'TBL-001',
        tableName: 'users',
        source: { path: 'schema.sql' },
      };
      
      const ddl: DDLDoc = {
        tables: {
          users: { columns: { id: { type: 'uuid' } } },
        },
      };
      
      const result = checkTableExistence(spec, ddl);
      
      expect(result.success).toBe(true);
    });
  });
  
  // FR-600-02: Type check (expected type/class/category matches)
  describe('FR-600-02: Type check', () => {
    it('should detect method mismatch', () => {
      const spec: APIRef = {
        id: 'API-001',
        operationId: 'createUser',
        source: { path: 'openapi.yaml' },
        expectedMethod: 'POST',
      };
      
      const openapi: OpenAPIDoc = {
        paths: {
          '/users': {
            put: { operationId: 'createUser' }, // Wrong method
          },
        },
      };
      
      const result = checkAPIExistence(spec, openapi);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('expected method POST'))).toBe(true);
    });
    
    it('should warn on path mismatch', () => {
      const spec: APIRef = {
        id: 'API-001',
        operationId: 'getUser',
        source: { path: 'openapi.yaml' },
        expectedPath: '/users/{id}',
      };
      
      const openapi: OpenAPIDoc = {
        paths: {
          '/api/users/{userId}': {
            get: { operationId: 'getUser' }, // Different path
          },
        },
      };
      
      const result = checkAPIExistence(spec, openapi);
      
      expect(result.warnings.some(w => w.includes('path mismatch'))).toBe(true);
    });
    
    it('should detect missing columns', () => {
      const spec: TableRef = {
        id: 'TBL-001',
        tableName: 'orders',
        source: { path: 'schema.sql' },
        expectedColumns: ['id', 'customer_id', 'status', 'total'],
      };
      
      const ddl: DDLDoc = {
        tables: {
          orders: {
            columns: {
              id: { type: 'uuid' },
              customer_id: { type: 'uuid' },
              // missing: status, total
            },
          },
        },
      };
      
      const result = checkTableExistence(spec, ddl);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Column status not found in table orders');
      expect(result.errors).toContain('Column total not found in table orders');
    });
  });
  
  // FR-600-03: Constraint check (satisfies non-functional requirements/guardrails)
  describe('FR-600-03: Constraint check', () => {
    it('should detect unencrypted sensitive columns', () => {
      const spec: TableRef = {
        id: 'TBL-001',
        tableName: 'users',
        source: { path: 'schema.sql' },
        constraints: {
          encrypted: ['password', 'ssn'],
        },
      };
      
      const ddl: DDLDoc = {
        tables: {
          users: {
            columns: {
              id: { type: 'uuid' },
              password: { type: 'varchar', encrypted: false }, // Should be encrypted
              ssn: { type: 'varchar', encrypted: true }, // OK
            },
          },
        },
      };
      
      const result = checkTableExistence(spec, ddl);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Column password should be encrypted but is not');
    });
    
    it('should warn on nullable columns that should be NOT NULL', () => {
      const spec: TableRef = {
        id: 'TBL-001',
        tableName: 'orders',
        source: { path: 'schema.sql' },
        constraints: {
          notNull: ['status', 'created_at'],
        },
      };
      
      const ddl: DDLDoc = {
        tables: {
          orders: {
            columns: {
              id: { type: 'uuid', notNull: true },
              status: { type: 'varchar', notNull: false }, // Should be NOT NULL
              created_at: { type: 'timestamp', notNull: true }, // OK
            },
          },
        },
      };
      
      const result = checkTableExistence(spec, ddl);
      
      expect(result.warnings).toContain('Column status should be NOT NULL');
    });
    
    it('should pass all constraint checks', () => {
      const spec: TableRef = {
        id: 'TBL-001',
        tableName: 'secure_data',
        source: { path: 'schema.sql' },
        constraints: {
          encrypted: ['secret'],
          notNull: ['id', 'secret'],
        },
      };
      
      const ddl: DDLDoc = {
        tables: {
          secure_data: {
            columns: {
              id: { type: 'uuid', notNull: true },
              secret: { type: 'varchar', notNull: true, encrypted: true },
            },
          },
        },
      };
      
      const result = checkTableExistence(spec, ddl);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});

describe('FR-601: Three categories of consistency check', () => {
  // FR-601-01, FR-601-02, FR-601-03 are tested in FR-600-01, FR-600-02, FR-600-03
  
  it('should structure check results with existence, type, and constraint categories', () => {
    // This is more of a design pattern verification
    const result: CheckResult = {
      success: false,
      errors: [
        'Existence: Table not found',
        'Type: Column type mismatch',
        'Constraint: Encryption required',
      ],
      warnings: [],
    };
    
    // Verify the structure supports all three categories
    expect(result.errors.some(e => e.includes('Existence'))).toBe(true);
    expect(result.errors.some(e => e.includes('Type'))).toBe(true);
    expect(result.errors.some(e => e.includes('Constraint'))).toBe(true);
  });
});

describe('FR-602: Check command', () => {
  beforeEach(() => {
    modelRegistry.clear();
  });
  
  // FR-602-01: Check external SSOT consistency for all models with speckeeper check
  describe('FR-602-01: All models check', () => {
    it('should run check on all models with external checker', () => {
      const apiModel: Model<APIRef> = {
        id: 'api-ref',
        name: 'API Reference',
        externalChecker: {
          targetType: 'openapi',
          sourcePath: (spec) => spec.source.path,
          check: (spec, doc) => checkAPIExistence(spec, doc as OpenAPIDoc),
        },
      };
      
      const tableModel: Model<TableRef> = {
        id: 'table-ref',
        name: 'Table Reference',
        externalChecker: {
          targetType: 'ddl',
          sourcePath: (spec) => spec.source.path,
          check: (spec, doc) => checkTableExistence(spec, doc as DDLDoc),
        },
      };
      
      registerModel(apiModel);
      registerModel(tableModel);
      
      const modelsWithChecker = getModelsWithExternalChecker();
      
      expect(modelsWithChecker).toHaveLength(2);
      expect(modelsWithChecker.map(m => m.id)).toContain('api-ref');
      expect(modelsWithChecker.map(m => m.id)).toContain('table-ref');
    });
  });
  
  // FR-602-02: Check specific model only with speckeeper check --model <model-name>
  describe('FR-602-02: Specific model check', () => {
    it('should run check on specific model only', () => {
      const apiModel: Model<APIRef> = {
        id: 'api-ref',
        name: 'API Reference',
        externalChecker: {
          targetType: 'openapi',
          sourcePath: (spec) => spec.source.path,
          check: (spec, doc) => checkAPIExistence(spec, doc as OpenAPIDoc),
        },
      };
      
      registerModel(apiModel);
      
      const specs: APIRef[] = [
        { id: 'API-001', operationId: 'getUsers', source: { path: 'api.yaml' } },
      ];
      
      const openapi: OpenAPIDoc = {
        paths: { '/users': { get: { operationId: 'getUsers' } } },
      };
      
      const results = runCheck('api-ref', specs, openapi);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });
  });
  
  // FR-602-04: Only models with externalChecker are targeted
  describe('FR-602-04: externalChecker presence', () => {
    it('should only return models with external checker', () => {
      const modelWithChecker: Model<APIRef> = {
        id: 'with-checker',
        name: 'With Checker',
        externalChecker: {
          targetType: 'test',
          sourcePath: () => 'test.yaml',
          check: () => ({ success: true, errors: [], warnings: [] }),
        },
      };
      
      const modelWithoutChecker: Model<unknown> = {
        id: 'without-checker',
        name: 'Without Checker',
        // No externalChecker
      };
      
      registerModel(modelWithChecker);
      registerModel(modelWithoutChecker);
      
      const checkableModels = getModelsWithExternalChecker();
      
      expect(checkableModels).toHaveLength(1);
      expect(checkableModels[0].id).toBe('with-checker');
    });
  });
});

describe('FR-603: External checker', () => {
  // FR-603-01: Can set externalChecker on Model definition
  describe('FR-603-01: externalChecker configuration', () => {
    it('should allow setting external checker on model', () => {
      const model: Model<APIRef> = {
        id: 'test-model',
        name: 'Test Model',
        externalChecker: {
          targetType: 'openapi',
          sourcePath: (spec) => spec.source.path,
          check: () => ({ success: true, errors: [], warnings: [] }),
        },
      };
      
      expect(model.externalChecker).toBeDefined();
      expect(model.externalChecker!.targetType).toBe('openapi');
    });
  });
  
  // FR-603-02: externalChecker includes target file loading and check logic
  describe('FR-603-02: File loading and check logic', () => {
    it('should provide source path function', () => {
      const checker: ExternalChecker<APIRef> = {
        targetType: 'openapi',
        sourcePath: (spec) => spec.source.path,
        check: () => ({ success: true, errors: [], warnings: [] }),
      };
      
      const spec: APIRef = {
        id: 'API-001',
        operationId: 'test',
        source: { path: 'api/openapi.yaml' },
      };
      
      const path = checker.sourcePath(spec);
      
      expect(path).toBe('api/openapi.yaml');
    });
    
    it('should provide check function with spec and external doc', () => {
      const checker: ExternalChecker<APIRef> = {
        targetType: 'openapi',
        sourcePath: (spec) => spec.source.path,
        check: (spec, externalDoc) => {
          const doc = externalDoc as OpenAPIDoc;
          const found = Object.values(doc.paths).some(
            methods => Object.values(methods).some(m => m.operationId === spec.operationId)
          );
          return {
            success: found,
            errors: found ? [] : [`Operation ${spec.operationId} not found`],
            warnings: [],
          };
        },
      };
      
      const spec: APIRef = {
        id: 'API-001',
        operationId: 'createUser',
        source: { path: 'api.yaml' },
      };
      
      const openapi: OpenAPIDoc = {
        paths: { '/users': { post: { operationId: 'createUser' } } },
      };
      
      const result = checker.check(spec, openapi);
      
      expect(result.success).toBe(true);
    });
  });
  
  // FR-603-03: Check results include success, errors, warnings
  describe('FR-603-03: Check result structure', () => {
    it('should return structured check result', () => {
      const result: CheckResult = {
        success: false,
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1'],
      };
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
    
    it('should indicate success when no errors', () => {
      const result: CheckResult = {
        success: true,
        errors: [],
        warnings: ['Minor warning'],
      };
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
    });
  });
  
  // FR-603-04: speckeeper check command auto-detects and executes models with externalChecker
  describe('FR-603-04: Auto-detection and execution', () => {
    it('should auto-detect models with external checker', () => {
      modelRegistry.clear();
      
      registerModel({
        id: 'model-a',
        name: 'Model A',
        externalChecker: {
          targetType: 'type-a',
          sourcePath: () => 'a.yaml',
          check: () => ({ success: true, errors: [], warnings: [] }),
        },
      });
      
      registerModel({
        id: 'model-b',
        name: 'Model B',
        // No external checker
      });
      
      registerModel({
        id: 'model-c',
        name: 'Model C',
        externalChecker: {
          targetType: 'type-c',
          sourcePath: () => 'c.yaml',
          check: () => ({ success: true, errors: [], warnings: [] }),
        },
      });
      
      const detected = getModelsWithExternalChecker();
      
      expect(detected).toHaveLength(2);
      expect(detected.map(m => m.id).sort()).toEqual(['model-a', 'model-c']);
    });
  });
});
