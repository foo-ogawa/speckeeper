/**
 * ESLint Plugin: model-design
 * 
 * Validates model definitions and spec instances in the design/ directory
 * Specification: docs/model-design.md
 */

const modelTypeExport = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require type export: export type XXX = z.infer<typeof XXXSchema>',
    },
    messages: {
      missing: 'Missing type export: export type XXX = z.infer<typeof XXXSchema>',
    },
  },
  create(context) {
    let hasTypeExport = false;
    
    // Detect z.infer<...> or z.input<...> patterns
    function isZodTypeHelper(node) {
      return (
        node?.type === 'TSTypeReference' &&
        node.typeName?.type === 'TSQualifiedName' &&
        node.typeName.left?.name === 'z' &&
        (node.typeName.right?.name === 'infer' || node.typeName.right?.name === 'input')
      );
    }
    
    return {
      ExportNamedDeclaration(node) {
        if (node.declaration?.type === 'TSTypeAliasDeclaration') {
          const typeAnnotation = node.declaration.typeAnnotation;
          // Direct z.infer<...> or z.input<...>
          if (isZodTypeHelper(typeAnnotation)) {
            hasTypeExport = true;
          }
          // z.infer<...> & { ... } (intersection type)
          if (typeAnnotation?.type === 'TSIntersectionType') {
            if (typeAnnotation.types.some(t => isZodTypeHelper(t))) {
              hasTypeExport = true;
            }
          }
        }
      },
      'Program:exit'(node) {
        // Skip index.ts
        const filename = context.filename || context.getFilename();
        if (filename.endsWith('index.ts')) return;
        
        if (!hasTypeExport) {
          context.report({
            node,
            messageId: 'missing',
          });
        }
      },
    };
  },
};

const modelClassExtends = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require Model class that extends Model<typeof XXXSchema> and is exported',
    },
    messages: {
      missing: 'Missing Model class: class XXXModel extends Model<typeof XXXSchema> with export',
    },
  },
  create(context) {
    const modelClasses = new Set(); // Classes that extend Model
    const exportedNames = new Set(); // Names exported via export { XXX }
    
    return {
      // Detect: export class XXXModel extends Model<...>
      ExportNamedDeclaration(node) {
        if (node.declaration?.type === 'ClassDeclaration') {
          const className = node.declaration.id?.name || '';
          const superClass = node.declaration.superClass;
          
          if (
            className.endsWith('Model') &&
            superClass?.type === 'Identifier' &&
            superClass.name === 'Model'
          ) {
            modelClasses.add(className);
            exportedNames.add(className);
          }
        }
        // Detect: export { XXXModel }
        if (node.specifiers) {
          for (const spec of node.specifiers) {
            if (spec.exported?.name) {
              exportedNames.add(spec.exported.name);
            }
          }
        }
      },
      // Detect: class XXXModel extends Model<...> (non-exported)
      ClassDeclaration(node) {
        const className = node.id?.name || '';
        const superClass = node.superClass;
        
        if (
          className.endsWith('Model') &&
          superClass?.type === 'Identifier' &&
          superClass.name === 'Model'
        ) {
          modelClasses.add(className);
        }
      },
      'Program:exit'(node) {
        const filename = context.filename || context.getFilename();
        if (filename.endsWith('index.ts')) return;
        
        // Check if at least one Model class exists and is exported
        const hasExportedModelClass = [...modelClasses].some(name => exportedNames.has(name));
        
        if (!hasExportedModelClass) {
          context.report({
            node,
            messageId: 'missing',
          });
        }
      },
    };
  },
};

const modelImport = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require Model import from src/core/model',
    },
    messages: {
      missing: 'Missing Model import from src/core/model',
    },
  },
  create(context) {
    let hasModelImport = false;
    
    return {
      ImportDeclaration(node) {
        const source = node.source.value || '';
        if (source.includes('core/model')) {
          const hasModel = node.specifiers.some(
            spec => spec.imported?.name === 'Model' || spec.local?.name === 'Model'
          );
          if (hasModel) {
            hasModelImport = true;
          }
        }
      },
      'Program:exit'(node) {
        const filename = context.filename || context.getFilename();
        if (filename.endsWith('index.ts')) return;
        
        if (!hasModelImport) {
          context.report({
            node,
            messageId: 'missing',
          });
        }
      },
    };
  },
};

const noJsExtension = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow .js extension in imports',
    },
    messages: {
      found: 'Import paths should not have .js extension',
    },
    fixable: 'code',
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value || '';
        if (source.endsWith('.js')) {
          context.report({
            node: node.source,
            messageId: 'found',
            fix(fixer) {
              const newSource = source.slice(0, -3);
              return fixer.replaceText(node.source, `'${newSource}'`);
            },
          });
        }
      },
    };
  },
};

const specTypeImport = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require type import from _models',
    },
    messages: {
      missing: "Missing type import from _models: import type { XXX } from './_models/xxx'",
    },
  },
  create(context) {
    let hasTypeImport = false;
    let usesDslFunctions = false;
    let hasLocalTypeDefinition = false;
    
    return {
      ImportDeclaration(node) {
        const source = node.source.value || '';
        if (source.includes('_models') && node.importKind === 'type') {
          hasTypeImport = true;
        }
        // Legacy pattern: skip if using DSL functions
        if (source.includes('/dsl/')) {
          usesDslFunctions = true;
        }
      },
      // Allow local interface/type definitions (legacy file support)
      TSInterfaceDeclaration() {
        hasLocalTypeDefinition = true;
      },
      TSTypeAliasDeclaration() {
        hasLocalTypeDefinition = true;
      },
      'Program:exit'(node) {
        const filename = context.filename || context.getFilename();
        if (filename.endsWith('index.ts')) return;
        
        // Allow legacy pattern using DSL functions
        if (usesDslFunctions) return;
        
        // Allow local type definitions (legacy support)
        if (hasLocalTypeDefinition) return;
        
        if (!hasTypeImport) {
          context.report({
            node,
            messageId: 'missing',
          });
        }
      },
    };
  },
};

const specArrayExport = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require array export: export const xxxs: XXX[] = [...]',
    },
    messages: {
      missing: 'Missing array export: export const xxxs: XXX[] = [...]',
    },
  },
  create(context) {
    let hasArrayExport = false;
    let usesDslFunctions = false;
    
    return {
      ImportDeclaration(node) {
        const source = node.source.value || '';
        // Legacy pattern: skip if using DSL functions
        if (source.includes('/dsl/')) {
          usesDslFunctions = true;
        }
      },
      ExportNamedDeclaration(node) {
        if (node.declaration?.type === 'VariableDeclaration') {
          for (const decl of node.declaration.declarations) {
            const typeAnnotation = decl.id?.typeAnnotation?.typeAnnotation;
            if (typeAnnotation?.type === 'TSArrayType') {
              hasArrayExport = true;
            }
          }
        }
      },
      'Program:exit'(node) {
        const filename = context.filename || context.getFilename();
        if (filename.endsWith('index.ts')) return;
        
        // Allow legacy pattern using DSL functions
        if (usesDslFunctions) return;
        
        if (!hasArrayExport) {
          context.report({
            node,
            messageId: 'missing',
          });
        }
      },
    };
  },
};

export default {
  rules: {
    'model-type-export': modelTypeExport,
    'model-class-extends': modelClassExtends,
    'model-import': modelImport,
    'no-js-extension': noJsExtension,
    'spec-type-import': specTypeImport,
    'spec-array-export': specArrayExport,
  },
};
