import type { CheckerTemplateParams } from '../types.js';

export function generateDdlChecker(_params: CheckerTemplateParams): string {
  return `import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExternalChecker, CheckResult } from 'speckeeper';
import type { LogicalEntity } from '../_models/logical-entity.ts';

/**
 * DDL Checker: verifies that logical entity definitions
 * have corresponding tables/columns in schema.sql.
 */
export const ddlChecker: ExternalChecker<LogicalEntity> = {
  targetType: 'ddl',

  sourcePath: () => resolve('..', 'db', 'schema.sql'),

  check: (spec, _externalData): CheckResult => {
    const errors: CheckResult['errors'] = [];
    const warnings: CheckResult['warnings'] = [];

    const schemaPath = resolve('..', 'db', 'schema.sql');
    if (!existsSync(schemaPath)) {
      warnings.push({
        message: \`schema.sql not found: \${schemaPath}\`,
        specId: spec.id,
      });
      return { success: true, errors, warnings };
    }

    const _schemaSql = readFileSync(schemaPath, 'utf-8');

    // TODO: implement table/column existence check
    warnings.push({
      message: \`DDL checker not fully implemented for \${spec.id} — add table/column verification logic\`,
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
