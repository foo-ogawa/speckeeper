import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import modelDesignPlugin from './eslint-rules/model-design-plugin.js';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    rules: {
      // Allow unused variables with _ prefix
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      // Allow any in test files for mocking
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['design/_models/**/*.ts'],
    plugins: {
      'model-design': modelDesignPlugin,
    },
    rules: {
      'model-design/model-type-export': 'error',
      'model-design/model-class-extends': 'error',
      'model-design/model-import': 'error',
      'model-design/no-js-extension': 'error',
    },
  },
  {
    files: ['design/*.ts'],
    ignores: ['design/index.ts'],
    plugins: {
      'model-design': modelDesignPlugin,
    },
    rules: {
      'model-design/spec-type-import': 'warn',
      'model-design/spec-array-export': 'warn',
      'model-design/no-js-extension': 'error',
    },
  },
);
