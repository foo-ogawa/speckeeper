import type { CheckerTemplateParams } from '../types.js';

export function generateTestChecker(params: CheckerTemplateParams): string {
  return `import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import type { ExternalChecker, CheckResult } from 'speckeeper';
import type { ${params.sourceModelName} } from '../_models/${params.sourceModelFile}.ts';

/**
 * Test Checker: verifies that ${params.sourceModelName} items have
 * corresponding test code that exists and references the spec ID.
 *
 * Checks:
 * 1. Test file(s) exist at the expected path
 * 2. Test file content references the spec ID (in describe/it/test blocks or embedoc markers)
 */
export const ${toCamelCase(params.checkerName)}: ExternalChecker<${params.sourceModelName}> = {
  targetType: '${params.targetType}',

  sourcePath: () => '.',

  check: (spec, _externalData): CheckResult => {
    const errors: CheckResult['errors'] = [];
    const warnings: CheckResult['warnings'] = [];
    const basePath = process.cwd();

    // TODO: configure test file path pattern per spec
    // For now, search common test directories
    const testPatterns = [
      'test/**/*.test.ts',
      'test/**/*.spec.ts',
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
    ];

    let testFiles: string[] = [];
    for (const pattern of testPatterns) {
      testFiles = testFiles.concat(glob.sync(pattern, { cwd: basePath }));
    }

    if (testFiles.length === 0) {
      warnings.push({
        message: \`No test files found for \${spec.id}\`,
        specId: spec.id,
      });
      return { success: true, errors, warnings };
    }

    // Check if spec ID is referenced in any test file
    let specIdFound = false;
    for (const testFile of testFiles) {
      const fullPath = join(basePath, testFile);
      try {
        const content = readFileSync(fullPath, 'utf-8');
        const patterns = [
          new RegExp(\`describe\\\\s*\\\\(\\\\s*['\\\`"].*\${spec.id}\`, 'm'),
          new RegExp(\`it\\\\s*\\\\(\\\\s*['\\\`"].*\${spec.id}\`, 'm'),
          new RegExp(\`test\\\\s*\\\\(\\\\s*['\\\`"].*\${spec.id}\`, 'm'),
          new RegExp(\`@embedoc.*\${spec.id}\`, 'm'),
        ];
        if (patterns.some(p => p.test(content))) {
          specIdFound = true;
          break;
        }
      } catch {
        // skip unreadable files
      }
    }

    if (!specIdFound) {
      warnings.push({
        message: \`Spec ID "\${spec.id}" not found in any test file — test should reference the spec ID in describe/it/test or embedoc marker\`,
        specId: spec.id,
      });
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  },
};
`;
}

function toCamelCase(s: string): string {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
