/**
 * speckeeper configuration file
 */
import { defineConfig } from 'speckeeper';
import { allModels } from './design/_models/index';

export default defineConfig({
  projectName: 'my-project',
  version: '1.0.0',
  models: allModels,
});
