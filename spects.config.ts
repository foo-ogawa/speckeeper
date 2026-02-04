/**
 * spects configuration file
 */
import { defineConfig } from './dist/index.js';
import { allModels } from './design/_models/index.ts';

export default defineConfig({
  projectName: 'spects',
  version: '0.1.0',
  models: allModels,
});
