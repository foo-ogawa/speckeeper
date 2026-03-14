/**
 * Artifact class defaults for scaffold and config generation.
 *
 * Used by model-generator for annotationChecker code generation
 * and by config generator for speckeeper.config.ts artifacts section.
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

export const SPECIALIZED_CHECKER_MAP: Record<string, string> = {
  openapi: 'externalOpenAPIChecker',
  sqlschema: 'externalSqlSchemaChecker',
};

export interface CheckerBindingInput {
  edgeType: 'implements' | 'verifiedBy';
  targetClass: string;
}

export interface GeneratedCheckerCode {
  code: string;
  dslImports: string[];
}

export function generateCheckerCode(
  bindings: CheckerBindingInput[],
  modelName: string,
): GeneratedCheckerCode {
  const dslImports = new Set<string>(['annotationChecker']);
  for (const b of bindings) {
    const specialized = SPECIALIZED_CHECKER_MAP[b.targetClass];
    if (specialized) dslImports.add(specialized);
  }

  const checks = bindings.map((b) => {
    const specialized = SPECIALIZED_CHECKER_MAP[b.targetClass];
    const artifact = `'${b.targetClass}'`;
    const relationType = `'${b.edgeType}'`;
    if (specialized) {
      return `{ artifact: ${artifact}, relationType: ${relationType}, checker: ${specialized}() }`;
    }
    return `{ artifact: ${artifact}, relationType: ${relationType} }`;
  });

  let config: string;
  if (checks.length === 1) {
    config = checks[0]!;
  } else {
    config = `{\n    checks: [\n      ${checks.join(',\n      ')}\n    ],\n  }`;
  }

  const code = `protected externalChecker = annotationChecker<${modelName}>(${config});`;

  return {
    code,
    dslImports: Array.from(dslImports),
  };
}
