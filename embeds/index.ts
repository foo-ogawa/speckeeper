/**
 * spects embeds for embedoc
 * 
 * Exports only. Each feature is defined in individual files.
 */

import { modelData } from './model-data.js';
import { models } from './model-list.js';
import { codeSnippet } from './file-ref.js';

export const embeds = {
  // Generic model data rendering
  model_data: modelData,
  
  // Model list
  models,
  
  // File reference
  code_snippet: codeSnippet,
};
