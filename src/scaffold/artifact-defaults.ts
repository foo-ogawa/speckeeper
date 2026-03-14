/**
 * Artifact class defaults for scaffold and config generation.
 *
 * Used by config generator for speckeeper.config.ts sources/artifacts sections.
 */

export interface ArtifactClassDefaults {
  globs: string[];
  exclude?: string[];
  contentPatterns?: string[];
}

export const ARTIFACT_CLASS_DEFAULTS: Record<string, ArtifactClassDefaults> = {
  test: {
    globs: ['test/**/*.test.ts', 'test/**/*.spec.ts', 'tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    contentPatterns: ['/@verifies\\s+([\\w-]+(?:[,\\s]+[\\w-]+)*)/'],
  },
  'e2e-test': {
    globs: ['e2e/**/*.spec.ts'],
    contentPatterns: ['/@verifies\\s+([\\w-]+(?:[,\\s]+[\\w-]+)*)/'],
  },
  'unit-test': {
    globs: ['test/unit/**/*.test.ts'],
    contentPatterns: ['/@verifies\\s+([\\w-]+(?:[,\\s]+[\\w-]+)*)/'],
  },
  'integration-test': {
    globs: ['test/integration/**/*.test.ts'],
    contentPatterns: ['/@verifies\\s+([\\w-]+(?:[,\\s]+[\\w-]+)*)/'],
  },
  typescript: {
    globs: ['src/**/*.ts'],
    exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    contentPatterns: ['/@implements\\s+([\\w-]+(?:[,\\s]+[\\w-]+)*)/'],
  },
  openapi: {
    globs: ['api/openapi.yaml', 'api/openapi.json'],
  },
  sqlschema: {
    globs: ['db/schema.sql', 'db/migration/*.sql'],
  },
};
