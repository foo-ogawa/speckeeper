#!/usr/bin/env node

// Use tsx to enable dynamic import of TypeScript files
import { register } from 'tsx/esm/api';

// Register tsx ESM loader
register();

// Run CLI
import('../dist/cli.js');
