import type { CheckerTemplateParams } from '../types.js';

export function generateOpenapiChecker(_params: CheckerTemplateParams): string {
  return `import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExternalChecker, CheckResult } from 'speckeeper';
import type { UseCase } from '../_models/usecase.ts';

/**
 * OpenAPI Checker: verifies that use cases have corresponding
 * endpoint definitions in the OpenAPI spec.
 */
export const openapiChecker: ExternalChecker<UseCase> = {
  targetType: 'openapi',

  sourcePath: () => resolve('..', 'api', 'spec'),

  check: (spec, _externalData): CheckResult => {
    const errors: CheckResult['errors'] = [];
    const warnings: CheckResult['warnings'] = [];

    const specDir = resolve('..', 'api', 'spec');
    if (!existsSync(specDir)) {
      warnings.push({
        message: \`OpenAPI spec directory not found: \${specDir}\`,
        specId: spec.id,
      });
      return { success: true, errors, warnings };
    }

    // TODO: implement endpoint existence check
    warnings.push({
      message: \`OpenAPI checker not fully implemented for \${spec.id} — add endpoint verification logic\`,
      specId: spec.id,
    });

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  },
};
`;
}
