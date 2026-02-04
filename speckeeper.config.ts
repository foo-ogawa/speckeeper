/**
 * speckeeper configuration file
 */
import { defineConfig } from './dist/index.js';
import { allModels } from './design/_models/index';

export default defineConfig({
  projectName: 'speckeeper',
  version: '0.1.0',
  models: allModels,
});
