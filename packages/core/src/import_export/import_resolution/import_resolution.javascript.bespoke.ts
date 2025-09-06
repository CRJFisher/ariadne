/**
 * JavaScript/TypeScript bespoke import resolution
 * 
 * Handles truly JavaScript/TypeScript-specific features that cannot be
 * expressed through configuration:
 * - CommonJS require() patterns
 * - Dynamic import() expressions
 * - Complex re-export patterns
 * - Type-only imports (TypeScript)
 */

import { ImportedSymbol, ExportedSymbol, ModuleNode } from '@ariadnejs/types';
import { ImportResolutionContext } from './import_resolution';
import { SyntaxNode } from 'tree-sitter';

/**
 * Resolve CommonJS require() calls
 * 
 * Handles patterns like:
 * - const foo = require('module')
 * - const { bar } = require('module')
 * - require('module').method()
 */
export function resolve_commonjs_require(
  node: SyntaxNode,
  source_code: string,
  context: ImportResolutionContext
): ExportedSymbol | undefined {
  // Check if this is a require call
  if (node.type !== 'call_expression') return undefined;
  
  const callee = node.childForFieldName('function');
  if (!callee || callee.text !== 'require') return undefined;
  
  const args = node.childForFieldName('arguments');
  if (!args) return undefined;
  
  // Extract the module path from require('module')
  const module_arg = args.children.find(child => 
    child.type === 'string' || child.type === 'template_string'
  );
  
  if (!module_arg) return undefined;
  
  const module_path = module_arg.text.slice(1, -1); // Remove quotes
  
  // Check if this is a destructuring pattern
  const parent = node.parent;
  if (parent?.type === 'variable_declarator') {
    const id = parent.childForFieldName('name');
    if (id?.type === 'object_pattern') {
      // const { bar } = require('module')
      return handle_commonjs_destructuring(id, module_path, context);
    }
  }
  
  // Simple require: const foo = require('module')
  // Return a synthetic default export
  return {
    name: 'module.exports',
    kind: 'variable',
    location: {
      line: node.startPosition.row + 1,
      column: node.startPosition.column + 1,
      file_path: context.file_path
    },
    is_default: true
  };
}

/**
 * Handle CommonJS destructuring imports
 */
function handle_commonjs_destructuring(
  pattern: SyntaxNode,
  module_path: string,
  context: ImportResolutionContext
): ExportedSymbol | undefined {
  // Extract the destructured names
  const properties = pattern.children.filter(child => 
    child.type === 'shorthand_property_identifier' || 
    child.type === 'pair'
  );
  
  // For now, return undefined - would need full implementation
  // to handle each destructured property
  return undefined;
}

/**
 * Resolve dynamic import() expressions
 * 
 * Handles:
 * - await import('module')
 * - import('module').then(...)
 */
export function resolve_dynamic_import(
  imp: ImportedSymbol,
  context: ImportResolutionContext
): ExportedSymbol | undefined {
  // Dynamic imports are resolved at runtime
  // We can only provide limited static analysis
  
  // Check if the import path is statically analyzable
  if (imp.name.includes('${') || imp.name.includes('`')) {
    // Template literal - can't resolve statically
    return undefined;
  }
  
  // Return a synthetic module export
  return {
    name: '*',
    kind: 'module',
    location: {
      line: 1,
      column: 1,
      file_path: context.file_path
    },
    is_default: false
  };
}

/**
 * Resolve TypeScript type-only imports
 * 
 * Handles:
 * - import type { Foo } from 'module'
 * - import { type Bar } from 'module'
 */
export function resolve_type_only_import(
  imp: ImportedSymbol,
  target_module: ModuleNode
): ExportedSymbol | undefined {
  // Type-only imports should reference type exports
  // Look for the type in the target module's exports
  
  const type_export = target_module.exports.get(imp.name);
  if (type_export && (type_export.kind === 'type' || type_export.kind === 'interface')) {
    return type_export;
  }
  
  // Type might be exported as a regular export but used as type (for typeof usage)
  // Return the export with is_type_only flag
  const regular_export = target_module.exports.get(imp.name);
  if (regular_export) {
    return {
      ...regular_export,
      is_type_only: true
    };
  }
  
  return undefined;
}

/**
 * Resolve complex re-export patterns
 * 
 * Handles:
 * - export * from 'module'
 * - export * as namespace from 'module'
 * - export { foo as bar } from 'module'
 */
export function resolve_reexport_pattern(
  module_node: ModuleNode,
  source_module: string
): Map<string, ExportedSymbol> {
  const reexports = new Map<string, ExportedSymbol>();
  
  // Look for re-export patterns in the module's AST
  // This would need AST traversal to properly implement
  
  // For now, mark all exports from source module as re-exported
  // This is a simplified implementation
  for (const [name, symbol] of module_node.exports) {
    if (symbol.is_reexport) {
      reexports.set(name, symbol);
    }
  }
  
  return reexports;
}

/**
 * Check if a file is using CommonJS
 */
export function is_commonjs_file(file_path: string): boolean {
  // Check file extension
  if (file_path.endsWith('.cjs')) return true;
  if (file_path.endsWith('.mjs')) return false;
  
  // Would need to check file content for module.exports or require
  // For now, use heuristic
  return false;
}

/**
 * Resolve module.exports pattern
 */
export function resolve_module_exports(
  module_node: ModuleNode
): ExportedSymbol | undefined {
  // Look for module.exports or exports.foo patterns
  const module_exports = module_node.exports.get('module.exports');
  if (module_exports) {
    return module_exports;
  }
  
  // Check for exports object
  const exports_obj = module_node.exports.get('exports');
  if (exports_obj) {
    return exports_obj;
  }
  
  return undefined;
}