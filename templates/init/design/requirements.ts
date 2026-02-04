/**
 * Requirements
 */
import type { Requirement } from './_models/requirement.ts';

export const requirements: Requirement[] = [
  {
    id: 'FR-001',
    name: 'User Authentication',
    type: 'functional',
    priority: 'must',
    description: 'Users can authenticate using email and password',
    acceptanceCriteria: [
      { id: 'FR-001-01', description: 'Valid credentials grant access', verificationMethod: 'test' },
      { id: 'FR-001-02', description: 'Invalid credentials show error message', verificationMethod: 'test' },
    ],
  },
];

console.log(`Requirements loaded: ${requirements.length} items`);
