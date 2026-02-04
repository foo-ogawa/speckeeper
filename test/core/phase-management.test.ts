/**
 * FR-102: Phase management tests
 * 
 * Can set phases (REQ/HLD/LLD/OPS) on models and validate phase gates
 */

import { describe, it, expect } from 'vitest';

// Phase types
type Phase = 'REQ' | 'HLD' | 'LLD' | 'OPS';

interface PhaseGateConfig {
  phase: Phase;
  allowTBD: boolean;
  requiredFields: string[];
}

const PHASE_ORDER: Phase[] = ['REQ', 'HLD', 'LLD', 'OPS'];

const DEFAULT_PHASE_GATES: Record<Phase, PhaseGateConfig> = {
  REQ: { phase: 'REQ', allowTBD: true, requiredFields: ['id', 'name'] },
  HLD: { phase: 'HLD', allowTBD: true, requiredFields: ['id', 'name', 'description'] },
  LLD: { phase: 'LLD', allowTBD: false, requiredFields: ['id', 'name', 'description', 'details'] },
  OPS: { phase: 'OPS', allowTBD: false, requiredFields: ['id', 'name', 'description', 'details', 'runbook'] },
};

interface ModelSpec {
  id: string;
  name: string;
  description?: string;
  details?: string;
  runbook?: string;
  phase?: Phase;
  [key: string]: unknown;
}

function isValidPhase(phase: string): phase is Phase {
  return PHASE_ORDER.includes(phase as Phase);
}

function hasTBD(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.includes('TBD') || value.includes('TODO') || value.includes('未定');
  }
  if (Array.isArray(value)) {
    return value.some(v => hasTBD(v));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some(v => hasTBD(v));
  }
  return false;
}

function validatePhaseGate(spec: ModelSpec, targetPhase: Phase): { 
  valid: boolean; 
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const gate = DEFAULT_PHASE_GATES[targetPhase];
  
  // Check required fields
  for (const field of gate.requiredFields) {
    if (spec[field] === undefined || spec[field] === null || spec[field] === '') {
      errors.push(`Required field '${field}' is missing for phase ${targetPhase}`);
    }
  }
  
  // Check TBD
  if (!gate.allowTBD && hasTBD(spec)) {
    const tbdFields = Object.entries(spec)
      .filter(([_, value]) => hasTBD(value))
      .map(([key, _]) => key);
    errors.push(`TBD values not allowed in phase ${targetPhase}: ${tbdFields.join(', ')}`);
  } else if (gate.allowTBD && hasTBD(spec)) {
    warnings.push(`TBD values found (allowed in phase ${targetPhase})`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function getPhaseCompletion(specs: ModelSpec[], targetPhase: Phase): {
  total: number;
  passing: number;
  failing: number;
  percentage: number;
} {
  let passing = 0;
  let failing = 0;
  
  for (const spec of specs) {
    const result = validatePhaseGate(spec, targetPhase);
    if (result.valid) {
      passing++;
    } else {
      failing++;
    }
  }
  
  return {
    total: specs.length,
    passing,
    failing,
    percentage: specs.length > 0 ? Math.round((passing / specs.length) * 100) : 0,
  };
}

describe('FR-102: Phase management', () => {
  // FR-102-01: Can handle phases as REQ | HLD | LLD | OPS
  describe('FR-102-01: Phase configuration', () => {
    it('should recognize valid phase values', () => {
      expect(isValidPhase('REQ')).toBe(true);
      expect(isValidPhase('HLD')).toBe(true);
      expect(isValidPhase('LLD')).toBe(true);
      expect(isValidPhase('OPS')).toBe(true);
    });
    
    it('should reject invalid phase values', () => {
      expect(isValidPhase('INVALID')).toBe(false);
      expect(isValidPhase('req')).toBe(false); // lowercase
      expect(isValidPhase('')).toBe(false);
    });
    
    it('should allow phase assignment to model spec', () => {
      const spec: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
        phase: 'HLD',
      };
      
      expect(spec.phase).toBe('HLD');
      expect(isValidPhase(spec.phase!)).toBe(true);
    });
    
    it('should maintain phase order', () => {
      expect(PHASE_ORDER.indexOf('REQ')).toBeLessThan(PHASE_ORDER.indexOf('HLD'));
      expect(PHASE_ORDER.indexOf('HLD')).toBeLessThan(PHASE_ORDER.indexOf('LLD'));
      expect(PHASE_ORDER.indexOf('LLD')).toBeLessThan(PHASE_ORDER.indexOf('OPS'));
    });
  });
  
  // FR-102-02: Can set phase in model definition and validate phase gates
  describe('FR-102-02: Phase gate validation', () => {
    it('should validate REQ phase gate (minimal requirements)', () => {
      const spec: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
      };
      
      const result = validatePhaseGate(spec, 'REQ');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate HLD phase gate (requires description)', () => {
      const specWithoutDescription: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
      };
      
      const resultFail = validatePhaseGate(specWithoutDescription, 'HLD');
      expect(resultFail.valid).toBe(false);
      expect(resultFail.errors).toContain("Required field 'description' is missing for phase HLD");
      
      const specWithDescription: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
        description: 'This is a description',
      };
      
      const resultPass = validatePhaseGate(specWithDescription, 'HLD');
      expect(resultPass.valid).toBe(true);
    });
    
    it('should validate LLD phase gate (requires details)', () => {
      const spec: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
        description: 'Description',
        details: 'Detailed implementation notes',
      };
      
      const result = validatePhaseGate(spec, 'LLD');
      
      expect(result.valid).toBe(true);
    });
    
    it('should validate OPS phase gate (requires runbook)', () => {
      const specWithRunbook: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
        description: 'Description',
        details: 'Details',
        runbook: 'Operational runbook',
      };
      
      const result = validatePhaseGate(specWithRunbook, 'OPS');
      
      expect(result.valid).toBe(true);
    });
    
    it('should report multiple missing fields', () => {
      const spec: ModelSpec = {
        id: 'REQ-001',
        name: '', // Empty
        // Missing: description, details, runbook
      };
      
      const result = validatePhaseGate(spec, 'OPS');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
    
    it('should calculate phase completion percentage', () => {
      const specs: ModelSpec[] = [
        { id: 'REQ-001', name: 'Req 1', description: 'Desc 1' },
        { id: 'REQ-002', name: 'Req 2', description: 'Desc 2' },
        { id: 'REQ-003', name: 'Req 3' }, // Missing description
      ];
      
      const completion = getPhaseCompletion(specs, 'HLD');
      
      expect(completion.total).toBe(3);
      expect(completion.passing).toBe(2);
      expect(completion.failing).toBe(1);
      expect(completion.percentage).toBe(67); // 2/3 = 66.67% rounded
    });
  });
  
  // FR-102-03: TBD is allowed/prohibited based on specified phase
  describe('FR-102-03: TBD allowed/prohibited', () => {
    it('should allow TBD in REQ phase', () => {
      const spec: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
        description: 'TBD - to be determined later',
      };
      
      const result = validatePhaseGate(spec, 'REQ');
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
    
    it('should allow TBD in HLD phase', () => {
      const spec: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
        description: 'Implementation details TBD',
      };
      
      const result = validatePhaseGate(spec, 'HLD');
      
      expect(result.valid).toBe(true);
    });
    
    it('should forbid TBD in LLD phase', () => {
      const spec: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
        description: 'This has TBD content',
        details: 'Some details',
      };
      
      const result = validatePhaseGate(spec, 'LLD');
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('TBD'))).toBe(true);
    });
    
    it('should forbid TBD in OPS phase', () => {
      const spec: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
        description: 'Description',
        details: 'TODO: add more details',
        runbook: 'Runbook content',
      };
      
      const result = validatePhaseGate(spec, 'OPS');
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('TBD'))).toBe(true);
    });
    
    it('should detect TBD in nested objects', () => {
      const spec: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
        description: 'Description',
        details: 'Details',
        runbook: 'Runbook',
        metadata: {
          owner: 'TBD',
        },
      };
      
      const result = validatePhaseGate(spec, 'OPS');
      
      expect(result.valid).toBe(false);
    });
    
    it('should detect TBD in arrays', () => {
      const spec: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
        description: 'Description',
        details: 'Details',
        runbook: 'Runbook',
        acceptanceCriteria: ['Criterion 1', 'TBD', 'Criterion 3'],
      };
      
      const result = validatePhaseGate(spec, 'OPS');
      
      expect(result.valid).toBe(false);
    });
    
    it('should detect Japanese TBD markers (未定)', () => {
      const spec: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
        description: '詳細は未定',
        details: 'Details',
        runbook: 'Runbook',
      };
      
      expect(hasTBD(spec.description)).toBe(true);
      
      const result = validatePhaseGate(spec, 'OPS');
      
      expect(result.valid).toBe(false);
    });
    
    it('should pass OPS phase with no TBD', () => {
      const spec: ModelSpec = {
        id: 'REQ-001',
        name: 'Test Requirement',
        description: 'Complete description',
        details: 'Complete details',
        runbook: 'Complete runbook',
      };
      
      const result = validatePhaseGate(spec, 'OPS');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
