/**
 * speckeeper configuration file
 */
import { defineConfig } from './dist/index.js';
import design from './design/index';

export default defineConfig({
  projectName: 'speckeeper',
  version: '0.2.1',
  models: design.models,
  specs: design.specs,
});
