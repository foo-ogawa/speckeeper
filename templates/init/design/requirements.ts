/**
 * Requirements
 */
import type { Requirement } from './_models/requirement.ts';
import { RequirementModel } from './_models/requirement.ts';

export const requirements: Requirement[] = [
  {
    id: 'REQ-001',
    name: 'User Authentication',
    type: 'functional',
    priority: 'must',
    description: 'Users can authenticate using email and password',
    acceptanceCriteria: [
      { id: 'REQ-001-01', description: 'Valid credentials grant access', verificationMethod: 'test' },
      { id: 'REQ-001-02', description: 'Invalid credentials show error message', verificationMethod: 'test' },
    ],
  },
];

RequirementModel.instance.register(requirements);

console.log(`Requirements loaded: ${requirements.length} items`);
