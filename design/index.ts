/**
 * Design entry point — loads YAML spec data files via loadYamlDir()
 */
import { join } from 'node:path';
import { mergeSpecs, loadYamlDir } from '../src/core/model';
import { allModels } from './_models/index';

const yamlModules = loadYamlDir(join(import.meta.dirname, '.'), allModels);

export default mergeSpecs(...yamlModules);
