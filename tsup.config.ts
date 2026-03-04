import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'dsl/index': 'src/core/dsl/index.ts',
    cli: 'src/cli/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: 'node18',
  outDir: 'dist',
  external: ['chalk', 'commander', 'glob', 'yaml', 'zod'],
  // Copy templates directory after build
  onSuccess: 'cp -r templates dist/',
});
