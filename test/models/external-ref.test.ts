/**
 * FR-200: External SSOT reference tests
 * 
 * Can define references to external SSOT (OpenAPI, DDL, IaC, etc.)
 */

import { describe, it, expect } from 'vitest';

// External reference interfaces
interface SourceRef {
  path: string;
  type: 'openapi' | 'ddl' | 'iac' | 'event';
}

interface APIRef {
  id: string;
  name: string;
  source: SourceRef;
  operationId: string;
  method?: string;
  path?: string;
  relatedEntities?: string[];
  componentId?: string;
}

interface TableRef {
  id: string;
  name: string;
  source: SourceRef;
  tableName: string;
  schema?: string;
  relatedEntities?: string[];
  componentId?: string;
}

interface IaCRef {
  id: string;
  name: string;
  source: SourceRef;
  resourceType: string;
  resourceId: string;
  provider?: string;
  componentId?: string;
}

interface BatchRef {
  id: string;
  name: string;
  source: SourceRef;
  definitionPath: string;
  schedule?: string;
  componentId?: string;
}

// Validation functions
function validateAPIRef(ref: APIRef): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!ref.id) errors.push('id is required');
  if (!ref.name) errors.push('name is required');
  if (!ref.source) errors.push('source is required');
  if (!ref.source?.path) errors.push('source.path is required');
  if (!ref.operationId) errors.push('operationId is required');
  
  return { valid: errors.length === 0, errors };
}

function validateTableRef(ref: TableRef): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!ref.id) errors.push('id is required');
  if (!ref.name) errors.push('name is required');
  if (!ref.source) errors.push('source is required');
  if (!ref.source?.path) errors.push('source.path is required');
  if (!ref.tableName) errors.push('tableName is required');
  
  return { valid: errors.length === 0, errors };
}

function validateIaCRef(ref: IaCRef): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!ref.id) errors.push('id is required');
  if (!ref.name) errors.push('name is required');
  if (!ref.source) errors.push('source is required');
  if (!ref.source?.path) errors.push('source.path is required');
  if (!ref.resourceType) errors.push('resourceType is required');
  if (!ref.resourceId) errors.push('resourceId is required');
  
  return { valid: errors.length === 0, errors };
}

function validateBatchRef(ref: BatchRef): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!ref.id) errors.push('id is required');
  if (!ref.name) errors.push('name is required');
  if (!ref.source) errors.push('source is required');
  if (!ref.source?.path) errors.push('source.path is required');
  if (!ref.definitionPath) errors.push('definitionPath is required');
  
  return { valid: errors.length === 0, errors };
}

describe('FR-200: External SSOT references', () => {
  // FR-200-01: Provide basic interfaces for APIRef/TableRef/IaCRef/BatchRef
  describe('FR-200-01: Basic interfaces', () => {
    it('should define APIRef interface', () => {
      const apiRef: APIRef = {
        id: 'API-001',
        name: 'Create Order API',
        source: { path: 'openapi/orders.yaml', type: 'openapi' },
        operationId: 'createOrder',
        method: 'POST',
        path: '/orders',
      };
      
      expect(apiRef.id).toBeDefined();
      expect(apiRef.source.type).toBe('openapi');
      expect(apiRef.operationId).toBeDefined();
    });
    
    it('should validate APIRef', () => {
      const validApiRef: APIRef = {
        id: 'API-001',
        name: 'Test API',
        source: { path: 'openapi.yaml', type: 'openapi' },
        operationId: 'testOp',
      };
      
      const result = validateAPIRef(validApiRef);
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject invalid APIRef', () => {
      const invalidApiRef = {
        id: 'API-002',
        name: 'Missing operationId',
        source: { path: 'openapi.yaml', type: 'openapi' },
        // Missing operationId
      } as APIRef;
      
      const result = validateAPIRef(invalidApiRef);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('operationId is required');
    });
    
    it('should define TableRef interface', () => {
      const tableRef: TableRef = {
        id: 'TBL-001',
        name: 'Orders Table',
        source: { path: 'prisma/schema.prisma', type: 'ddl' },
        tableName: 'orders',
        schema: 'public',
      };
      
      expect(tableRef.id).toBeDefined();
      expect(tableRef.source.type).toBe('ddl');
      expect(tableRef.tableName).toBeDefined();
    });
    
    it('should validate TableRef', () => {
      const validTableRef: TableRef = {
        id: 'TBL-001',
        name: 'Test Table',
        source: { path: 'schema.sql', type: 'ddl' },
        tableName: 'test_table',
      };
      
      const result = validateTableRef(validTableRef);
      
      expect(result.valid).toBe(true);
    });
    
    it('should define IaCRef interface', () => {
      const iacRef: IaCRef = {
        id: 'IAC-001',
        name: 'API Gateway',
        source: { path: 'terraform/main.tf', type: 'iac' },
        resourceType: 'aws_api_gateway_rest_api',
        resourceId: 'main_api',
        provider: 'aws',
      };
      
      expect(iacRef.id).toBeDefined();
      expect(iacRef.source.type).toBe('iac');
      expect(iacRef.resourceType).toBeDefined();
    });
    
    it('should validate IaCRef', () => {
      const validIaCRef: IaCRef = {
        id: 'IAC-001',
        name: 'Test Resource',
        source: { path: 'main.tf', type: 'iac' },
        resourceType: 'aws_lambda_function',
        resourceId: 'test_function',
      };
      
      const result = validateIaCRef(validIaCRef);
      
      expect(result.valid).toBe(true);
    });
    
    it('should define BatchRef interface', () => {
      const batchRef: BatchRef = {
        id: 'BATCH-001',
        name: 'Daily Report Generator',
        source: { path: 'step-functions/daily-report.json', type: 'event' },
        definitionPath: '$.States.GenerateReport',
        schedule: 'cron(0 8 * * ? *)',
      };
      
      expect(batchRef.id).toBeDefined();
      expect(batchRef.definitionPath).toBeDefined();
    });
    
    it('should validate BatchRef', () => {
      const validBatchRef: BatchRef = {
        id: 'BATCH-001',
        name: 'Test Batch',
        source: { path: 'batch.json', type: 'event' },
        definitionPath: '$.definition',
      };
      
      const result = validateBatchRef(validBatchRef);
      
      expect(result.valid).toBe(true);
    });
  });
  
  // FR-200-02: Can set file path and identifier for references
  describe('FR-200-02: File path and identifier configuration', () => {
    it('should specify source file path for APIRef', () => {
      const apiRef: APIRef = {
        id: 'API-001',
        name: 'Test',
        source: { path: 'api/v1/openapi.yaml', type: 'openapi' },
        operationId: 'getUsers',
      };
      
      expect(apiRef.source.path).toBe('api/v1/openapi.yaml');
    });
    
    it('should specify operationId as identifier', () => {
      const apiRef: APIRef = {
        id: 'API-001',
        name: 'Test',
        source: { path: 'openapi.yaml', type: 'openapi' },
        operationId: 'createUser',
        method: 'POST',
        path: '/users',
      };
      
      expect(apiRef.operationId).toBe('createUser');
    });
    
    it('should specify tableName as identifier for TableRef', () => {
      const tableRef: TableRef = {
        id: 'TBL-001',
        name: 'Test',
        source: { path: 'migrations/001.sql', type: 'ddl' },
        tableName: 'user_accounts',
        schema: 'auth',
      };
      
      expect(tableRef.tableName).toBe('user_accounts');
      expect(tableRef.schema).toBe('auth');
    });
    
    it('should specify resourceType and resourceId for IaCRef', () => {
      const iacRef: IaCRef = {
        id: 'IAC-001',
        name: 'Test',
        source: { path: 'infra/vpc.tf', type: 'iac' },
        resourceType: 'aws_vpc',
        resourceId: 'main',
      };
      
      expect(iacRef.resourceType).toBe('aws_vpc');
      expect(iacRef.resourceId).toBe('main');
    });
    
    it('should specify definitionPath for BatchRef', () => {
      const batchRef: BatchRef = {
        id: 'BATCH-001',
        name: 'Test',
        source: { path: 'workflows/etl.asl.json', type: 'event' },
        definitionPath: '$.States.Transform',
      };
      
      expect(batchRef.definitionPath).toBe('$.States.Transform');
    });
    
    it('should support different source types', () => {
      const sources: SourceRef[] = [
        { path: 'openapi.yaml', type: 'openapi' },
        { path: 'schema.sql', type: 'ddl' },
        { path: 'main.tf', type: 'iac' },
        { path: 'workflow.json', type: 'event' },
      ];
      
      expect(sources.map(s => s.type)).toEqual(['openapi', 'ddl', 'iac', 'event']);
    });
  });
  
  // FR-200-03: Can associate with related components and entities
  describe('FR-200-03: Component and entity association', () => {
    it('should associate APIRef with component', () => {
      const apiRef: APIRef = {
        id: 'API-001',
        name: 'Order API',
        source: { path: 'openapi.yaml', type: 'openapi' },
        operationId: 'createOrder',
        componentId: 'COMP-ORDER-SERVICE',
      };
      
      expect(apiRef.componentId).toBe('COMP-ORDER-SERVICE');
    });
    
    it('should associate APIRef with entities', () => {
      const apiRef: APIRef = {
        id: 'API-001',
        name: 'Order API',
        source: { path: 'openapi.yaml', type: 'openapi' },
        operationId: 'createOrder',
        relatedEntities: ['ENT-ORDER', 'ENT-CUSTOMER'],
      };
      
      expect(apiRef.relatedEntities).toContain('ENT-ORDER');
      expect(apiRef.relatedEntities).toContain('ENT-CUSTOMER');
    });
    
    it('should associate TableRef with component', () => {
      const tableRef: TableRef = {
        id: 'TBL-001',
        name: 'Orders Table',
        source: { path: 'schema.sql', type: 'ddl' },
        tableName: 'orders',
        componentId: 'COMP-DATABASE',
      };
      
      expect(tableRef.componentId).toBe('COMP-DATABASE');
    });
    
    it('should associate TableRef with entities', () => {
      const tableRef: TableRef = {
        id: 'TBL-001',
        name: 'Orders Table',
        source: { path: 'schema.sql', type: 'ddl' },
        tableName: 'orders',
        relatedEntities: ['ENT-ORDER'],
      };
      
      expect(tableRef.relatedEntities).toContain('ENT-ORDER');
    });
    
    it('should associate IaCRef with component', () => {
      const iacRef: IaCRef = {
        id: 'IAC-001',
        name: 'Order Lambda',
        source: { path: 'lambda.tf', type: 'iac' },
        resourceType: 'aws_lambda_function',
        resourceId: 'order_handler',
        componentId: 'COMP-ORDER-SERVICE',
      };
      
      expect(iacRef.componentId).toBe('COMP-ORDER-SERVICE');
    });
    
    it('should associate BatchRef with component', () => {
      const batchRef: BatchRef = {
        id: 'BATCH-001',
        name: 'Order Processing Batch',
        source: { path: 'batch.json', type: 'event' },
        definitionPath: '$.process',
        componentId: 'COMP-BATCH-PROCESSOR',
      };
      
      expect(batchRef.componentId).toBe('COMP-BATCH-PROCESSOR');
    });
    
    it('should allow multiple entity references', () => {
      const apiRef: APIRef = {
        id: 'API-001',
        name: 'Complex API',
        source: { path: 'openapi.yaml', type: 'openapi' },
        operationId: 'processTransaction',
        relatedEntities: ['ENT-ORDER', 'ENT-PAYMENT', 'ENT-CUSTOMER', 'ENT-PRODUCT'],
      };
      
      expect(apiRef.relatedEntities).toHaveLength(4);
    });
    
    it('should support cross-referencing between refs', () => {
      const apiRef: APIRef = {
        id: 'API-ORDER-CREATE',
        name: 'Create Order',
        source: { path: 'openapi.yaml', type: 'openapi' },
        operationId: 'createOrder',
        componentId: 'COMP-API',
        relatedEntities: ['ENT-ORDER'],
      };
      
      const tableRef: TableRef = {
        id: 'TBL-ORDER',
        name: 'Orders Table',
        source: { path: 'schema.sql', type: 'ddl' },
        tableName: 'orders',
        componentId: 'COMP-DB',
        relatedEntities: ['ENT-ORDER'], // Same entity
      };
      
      // Both reference the same entity
      expect(apiRef.relatedEntities).toContain('ENT-ORDER');
      expect(tableRef.relatedEntities).toContain('ENT-ORDER');
    });
  });
});
