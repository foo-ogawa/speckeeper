/**
 * speckeeper configuration file
 */
import { defineConfig } from 'speckeeper';
import design from './design/index';

export default defineConfig({
  projectName: 'my-project',
  version: '1.0.0',
  models: design.models,
  specs: design.specs,
});
