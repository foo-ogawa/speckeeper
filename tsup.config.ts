import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'dsl/index': 'src/core/dsl/index.ts',
    'external/insight-provider': 'src/external/insight-provider.ts',
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
  external: ['chalk', 'cli-contracts', 'commander', 'glob', 'yaml', 'zod', 'agent-contracts-runtime', 'agent-contracts-analyzer'],
  // Copy templates directory after build
  onSuccess: 'cp -r templates dist/',
});
