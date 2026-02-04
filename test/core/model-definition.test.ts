/**
 * FR-104: Model definition tests
 * 
 * Can define and register models required by the project in TypeScript
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mock LintRule type
interface LintRule<T> {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  check: (spec: T) => boolean;
}

// Mock LintResult type
interface LintResult {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  targetId: string;
}

// Mock Exporter type
interface Exporter<T> {
  format: 'markdown' | 'json';
  single?: (spec: T) => string;
  index?: (specs: T[]) => string;
  mermaid?: (spec: T) => string;
  outputDir?: string;
  filename?: (spec: T) => string;
}

// Mock ExternalChecker type
interface ExternalChecker<T> {
  targetType: string;
  sourcePath: (spec: T) => string;
  check: (spec: T, externalDoc: unknown) => { success: boolean; errors: string[]; warnings: string[] };
}

// Base Model class (simplified for testing)
abstract class Model<TSchema extends z.ZodType> {
  abstract id: string;
  abstract name: string;
  abstract idPrefix: string;
  abstract schema: TSchema;
  protected lintRules: LintRule<z.infer<TSchema>>[] = [];
  protected exporters: Exporter<z.infer<TSchema>>[] = [];
  protected externalChecker?: ExternalChecker<z.infer<TSchema>>;
  
  validate(data: unknown): { success: boolean; data?: z.infer<TSchema>; errors?: z.ZodError } {
    const result = this.schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  }
  
  lint(specs: z.infer<TSchema>[]): LintResult[] {
    const results: LintResult[] = [];
    for (const spec of specs) {
      for (const rule of this.lintRules) {
        if (rule.check(spec)) {
          results.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: rule.message,
            targetId: spec.id,
          });
        }
      }
    }
    return results;
  }
  
  export(format: 'markdown' | 'json', type: 'single' | 'index', specOrSpecs: z.infer<TSchema> | z.infer<TSchema>[]): string | null {
    const exporter = this.exporters.find(e => e.format === format);
    if (!exporter) return null;
    
    if (type === 'single' && exporter.single && !Array.isArray(specOrSpecs)) {
      return exporter.single(specOrSpecs);
    }
    if (type === 'index' && exporter.index && Array.isArray(specOrSpecs)) {
      return exporter.index(specOrSpecs);
    }
    return null;
  }
  
  checkExternal(spec: z.infer<TSchema>, externalDoc: unknown): { success: boolean; errors: string[]; warnings: string[] } | null {
    if (!this.externalChecker) return null;
    return this.externalChecker.check(spec, externalDoc);
  }
}

// Example: Runbook Model for testing
const RunbookSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  symptoms: z.array(z.string()),
  steps: z.array(z.object({
    order: z.number(),
    action: z.string(),
    verification: z.string().optional(),
  })),
});

type Runbook = z.infer<typeof RunbookSchema>;

class RunbookModel extends Model<typeof RunbookSchema> {
  id = 'runbook';
  name = 'Runbook';
  idPrefix = 'RB';
  schema = RunbookSchema;
  
  protected lintRules: LintRule<Runbook>[] = [
    {
      id: 'runbook-has-steps',
      severity: 'error',
      message: 'Runbook must have at least one step',
      check: (spec) => spec.steps.length === 0,
    },
    {
      id: 'runbook-has-symptoms',
      severity: 'warning',
      message: 'Runbook should have at least one symptom',
      check: (spec) => spec.symptoms.length === 0,
    },
    {
      id: 'runbook-steps-ordered',
      severity: 'error',
      message: 'Runbook steps must be in sequential order',
      check: (spec) => {
        for (let i = 0; i < spec.steps.length; i++) {
          if (spec.steps[i].order !== i + 1) return true;
        }
        return false;
      },
    },
  ];
  
  protected exporters: Exporter<Runbook>[] = [
    {
      format: 'markdown',
      single: (spec) => {
        const lines = [
          `# ${spec.title}`,
          '',
          `**Severity**: ${spec.severity}`,
          '',
          '## Symptoms',
          ...spec.symptoms.map(s => `- ${s}`),
          '',
          '## Steps',
          ...spec.steps.map(s => `${s.order}. ${s.action}${s.verification ? ` (Verify: ${s.verification})` : ''}`),
        ];
        return lines.join('\n');
      },
      index: (specs) => {
        const lines = [
          '# Runbooks',
          '',
          '| ID | Title | Severity |',
          '|----|-------|----------|',
          ...specs.map(s => `| ${s.id} | ${s.title} | ${s.severity} |`),
        ];
        return lines.join('\n');
      },
      outputDir: 'runbooks',
      filename: (spec) => spec.id,
    },
    {
      format: 'json',
      single: (spec) => JSON.stringify(spec, null, 2),
      index: (specs) => JSON.stringify(specs, null, 2),
    },
  ];
  
  protected externalChecker: ExternalChecker<Runbook> = {
    targetType: 'alertmanager',
    sourcePath: (_spec) => 'alertmanager.yaml',
    check: (spec, externalDoc) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const alerts = (externalDoc as { alerts?: string[] })?.alerts || [];
      
      // Check if runbook is referenced by any alert
      if (!alerts.includes(spec.id)) {
        warnings.push(`Runbook ${spec.id} is not referenced by any alert`);
      }
      
      return { success: errors.length === 0, errors, warnings };
    },
  };
}

// Model Registry for testing
const modelRegistry = new Map<string, Model<z.ZodType>>();

function registerModel(model: Model<z.ZodType>): void {
  modelRegistry.set(model.id, model);
}

function getModel(id: string): Model<z.ZodType> | undefined {
  return modelRegistry.get(id);
}

describe('FR-104: Model definition', () => {
  // FR-104-01: Can define models by extending Model base class
  describe('FR-104-01: Model base class inheritance', () => {
    it('should create a model by extending Model base class', () => {
      const runbookModel = new RunbookModel();
      
      expect(runbookModel).toBeInstanceOf(Model);
      expect(runbookModel.id).toBe('runbook');
      expect(runbookModel.name).toBe('Runbook');
      expect(runbookModel.idPrefix).toBe('RB');
    });
    
    it('should have required properties (id, name, idPrefix, schema)', () => {
      const runbookModel = new RunbookModel();
      
      expect(runbookModel.id).toBeDefined();
      expect(runbookModel.name).toBeDefined();
      expect(runbookModel.idPrefix).toBeDefined();
      expect(runbookModel.schema).toBeDefined();
    });
  });
  
  // FR-104-02: Can define runtime validation via Zod schema
  describe('FR-104-02: Zod schema validation', () => {
    it('should validate valid data against schema', () => {
      const runbookModel = new RunbookModel();
      
      const validData = {
        id: 'RB-001',
        title: 'Database Connection Failure',
        severity: 'critical',
        symptoms: ['Connection timeout', 'Query errors'],
        steps: [
          { order: 1, action: 'Check database status', verification: 'Service is running' },
          { order: 2, action: 'Restart database', verification: 'Connection restored' },
        ],
      };
      
      const result = runbookModel.validate(validData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
    
    it('should reject invalid data', () => {
      const runbookModel = new RunbookModel();
      
      const invalidData = {
        id: 'RB-002',
        // Missing: title, severity, symptoms, steps
      };
      
      const result = runbookModel.validate(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
    
    it('should validate enum fields', () => {
      const runbookModel = new RunbookModel();
      
      const invalidSeverity = {
        id: 'RB-003',
        title: 'Test',
        severity: 'invalid-severity', // Invalid enum value
        symptoms: [],
        steps: [],
      };
      
      const result = runbookModel.validate(invalidSeverity);
      
      expect(result.success).toBe(false);
    });
    
    it('should validate nested object structures', () => {
      const runbookModel = new RunbookModel();
      
      const invalidSteps = {
        id: 'RB-004',
        title: 'Test',
        severity: 'low',
        symptoms: [],
        steps: [
          { order: 'not-a-number', action: 'Step 1' }, // order should be number
        ],
      };
      
      const result = runbookModel.validate(invalidSteps);
      
      expect(result.success).toBe(false);
    });
  });
  
  // FR-104-03: Can define model-specific lint rules
  describe('FR-104-03: Custom lint rules', () => {
    it('should define custom lint rules', () => {
      const runbookModel = new RunbookModel();
      
      const specsWithIssues: Runbook[] = [
        {
          id: 'RB-001',
          title: 'Empty Runbook',
          severity: 'low',
          symptoms: [],
          steps: [], // No steps - should trigger error
        },
      ];
      
      const results = runbookModel.lint(specsWithIssues);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.ruleId === 'runbook-has-steps')).toBe(true);
    });
    
    it('should return no lint errors for valid specs', () => {
      const runbookModel = new RunbookModel();
      
      const validSpecs: Runbook[] = [
        {
          id: 'RB-001',
          title: 'Valid Runbook',
          severity: 'medium',
          symptoms: ['Symptom 1'],
          steps: [{ order: 1, action: 'Step 1' }],
        },
      ];
      
      const results = runbookModel.lint(validSpecs);
      
      expect(results.filter(r => r.severity === 'error')).toHaveLength(0);
    });
    
    it('should include target ID in lint results', () => {
      const runbookModel = new RunbookModel();
      
      const specs: Runbook[] = [
        {
          id: 'RB-LINT-001',
          title: 'Runbook',
          severity: 'low',
          symptoms: [],
          steps: [],
        },
      ];
      
      const results = runbookModel.lint(specs);
      
      expect(results.every(r => r.targetId === 'RB-LINT-001')).toBe(true);
    });
  });
  
  // FR-104-04: Can define model-specific renderers (text output functions)
  describe('FR-104-04: Renderers', () => {
    it('should export single spec to Markdown', () => {
      const runbookModel = new RunbookModel();
      
      const spec: Runbook = {
        id: 'RB-001',
        title: 'Test Runbook',
        severity: 'high',
        symptoms: ['Error A', 'Error B'],
        steps: [
          { order: 1, action: 'Step 1', verification: 'Check 1' },
          { order: 2, action: 'Step 2' },
        ],
      };
      
      const markdown = runbookModel.export('markdown', 'single', spec);
      
      expect(markdown).toContain('# Test Runbook');
      expect(markdown).toContain('**Severity**: high');
      expect(markdown).toContain('- Error A');
      expect(markdown).toContain('1. Step 1');
    });
    
    it('should export index to Markdown', () => {
      const runbookModel = new RunbookModel();
      
      const specs: Runbook[] = [
        { id: 'RB-001', title: 'Runbook 1', severity: 'high', symptoms: [], steps: [{ order: 1, action: 'x' }] },
        { id: 'RB-002', title: 'Runbook 2', severity: 'low', symptoms: [], steps: [{ order: 1, action: 'y' }] },
      ];
      
      const markdown = runbookModel.export('markdown', 'index', specs);
      
      expect(markdown).toContain('# Runbooks');
      expect(markdown).toContain('| RB-001 | Runbook 1 | high |');
      expect(markdown).toContain('| RB-002 | Runbook 2 | low |');
    });
    
    it('should export to JSON', () => {
      const runbookModel = new RunbookModel();
      
      const spec: Runbook = {
        id: 'RB-001',
        title: 'Test',
        severity: 'medium',
        symptoms: [],
        steps: [{ order: 1, action: 'x' }],
      };
      
      const json = runbookModel.export('json', 'single', spec);
      
      expect(json).toBeDefined();
      const parsed = JSON.parse(json!);
      expect(parsed.id).toBe('RB-001');
    });
    
    it('should return null for unsupported format', () => {
      const runbookModel = new RunbookModel();
      
      const spec: Runbook = {
        id: 'RB-001',
        title: 'Test',
        severity: 'low',
        symptoms: [],
        steps: [{ order: 1, action: 'x' }],
      };
      
      // TypeScript would catch this, but runtime should handle gracefully
      const result = runbookModel.export('xml' as 'markdown', 'single', spec);
      
      expect(result).toBeNull();
    });
  });
  
  // FR-104-05: Can define external SSOT consistency checker (optional)
  describe('FR-104-05: External checker', () => {
    it('should define external checker', () => {
      const runbookModel = new RunbookModel();
      
      const spec: Runbook = {
        id: 'RB-001',
        title: 'Test',
        severity: 'critical',
        symptoms: [],
        steps: [{ order: 1, action: 'x' }],
      };
      
      const externalDoc = { alerts: ['RB-001', 'RB-002'] };
      const result = runbookModel.checkExternal(spec, externalDoc);
      
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
    });
    
    it('should detect missing external references', () => {
      const runbookModel = new RunbookModel();
      
      const spec: Runbook = {
        id: 'RB-MISSING',
        title: 'Missing Runbook',
        severity: 'low',
        symptoms: [],
        steps: [{ order: 1, action: 'x' }],
      };
      
      const externalDoc = { alerts: ['RB-001', 'RB-002'] }; // RB-MISSING not included
      const result = runbookModel.checkExternal(spec, externalDoc);
      
      expect(result).toBeDefined();
      expect(result!.warnings.length).toBeGreaterThan(0);
    });
    
    it('should return null if no external checker defined', () => {
      // Create a model without external checker
      class SimpleModel extends Model<typeof RunbookSchema> {
        id = 'simple';
        name = 'Simple';
        idPrefix = 'SMP';
        schema = RunbookSchema;
        // No externalChecker defined
      }
      
      const simpleModel = new SimpleModel();
      const spec: Runbook = {
        id: 'SMP-001',
        title: 'Test',
        severity: 'low',
        symptoms: [],
        steps: [{ order: 1, action: 'x' }],
      };
      
      const result = simpleModel.checkExternal(spec, {});
      
      expect(result).toBeNull();
    });
  });
  
  // FR-104-06 is 'demo' verification, skipped for unit tests
  
  // FR-104-07: Registered models are targets for lint/build/drift/check
  describe('FR-104-07: Model registration and targeting', () => {
    it('should register model in registry', () => {
      const runbookModel = new RunbookModel();
      registerModel(runbookModel);
      
      const retrieved = getModel('runbook');
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('runbook');
    });
    
    it('should iterate over registered models', () => {
      modelRegistry.clear();
      
      const runbookModel = new RunbookModel();
      registerModel(runbookModel);
      
      class AnotherModel extends Model<typeof RunbookSchema> {
        id = 'another';
        name = 'Another';
        idPrefix = 'ANT';
        schema = RunbookSchema;
      }
      registerModel(new AnotherModel());
      
      const modelIds = Array.from(modelRegistry.keys());
      
      expect(modelIds).toContain('runbook');
      expect(modelIds).toContain('another');
    });
    
    it('should allow linting all registered models', () => {
      modelRegistry.clear();
      
      const runbookModel = new RunbookModel();
      registerModel(runbookModel);
      
      const allResults: LintResult[] = [];
      const testSpecs: Runbook[] = [
        { id: 'RB-001', title: 'Test', severity: 'low', symptoms: [], steps: [] },
      ];
      
      for (const model of modelRegistry.values()) {
        const results = model.lint(testSpecs);
        allResults.push(...results);
      }
      
      expect(allResults.length).toBeGreaterThan(0);
    });
  });
});
