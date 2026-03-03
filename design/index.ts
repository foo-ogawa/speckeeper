/**
 * Design entry point — aggregates all spec data via mergeSpecs()
 */
import { mergeSpecs } from '../dist/index.js';
import glossary from './glossary';
import requirements from './requirements';
import conceptModel from './concept-model';
import architecture from './architecture';
import usecases from './usecases';
import cliCommands from './cli-commands';
import artifacts from './artifacts';
import testRefs from './test-refs';

export default mergeSpecs(
  glossary,
  requirements,
  conceptModel,
  architecture,
  usecases,
  cliCommands,
  artifacts,
  testRefs,
);
