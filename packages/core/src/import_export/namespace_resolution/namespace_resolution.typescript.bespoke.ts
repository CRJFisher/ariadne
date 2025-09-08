/**
 * TypeScript-specific bespoke namespace resolution
 * 
 * Handles truly unique TypeScript patterns that cannot be
 * expressed through configuration (~15% of logic)
 */

import { SyntaxNode } from 'tree-sitter';
import { NamespaceImportInfo, NamespaceExport } from './namespace_resolution';

/**
 * Handle namespace declarations with merging
 * 
 * Bespoke because TypeScript allows multiple namespace declarations
 * to be merged together, creating a complex resolution pattern.
 */
export function handle_namespace_declarations(
  root_node: SyntaxNode,
  source_code: string
): NamespaceImportInfo[] {
  const imports: NamespaceImportInfo[] = [];
  
  // Pattern: namespace NS { ... } or module NS { ... }
  // These create local namespaces that can be imported
  const namespace_pattern = /(namespace|module)\s+([\p{L}\p{N}_$]+)\s*\{/gu;
  let match;
  
  while ((match = namespace_pattern.exec(source_code)) !== null) {
    const [, , namespace_name] = match;
    
    // Check if this namespace is exported
    const export_pattern = new RegExp(`export\\s+(namespace|module)\\s+${namespace_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`);
    if (export_pattern.test(source_code)) {
      imports.push({
        namespace_name,
        source_module: '__local__', // Internal namespace
        is_namespace: true,
        members: undefined
      });
    }
  }
  
  return imports;
}

/**
 * Handle export = syntax
 * 
 * Bespoke because export = creates a special default export
 * that becomes the entire module namespace when imported.
 */
export function handle_export_equals(
  exports: Map<string, NamespaceExport>,
  source_code: string
): void {
  // Pattern: export = expression
  const export_equals_pattern = /export\s*=\s*([^;]+);?/;
  const match = export_equals_pattern.exec(source_code);
  
  if (match) {
    const [, exported_value] = match;
    
    // This replaces all other exports
    exports.clear();
    
    // The exported value becomes the entire namespace
    exports.set('__export_equals__', {
      name: exported_value.trim(),
      is_namespace_export_equals: true
    } as any);
  }
}

/**
 * Handle triple-slash directives for type references
 * 
 * Bespoke because triple-slash directives create implicit
 * type dependencies that affect namespace resolution.
 */
export function handle_triple_slash_directives(
  source_code: string
): string[] {
  const referenced_types: string[] = [];
  
  // Pattern: /// <reference types="..." />
  const reference_pattern = /\/\/\/\s*<reference\s+types="([^"]+)"\s*\/>/g;
  let match;
  
  while ((match = reference_pattern.exec(source_code)) !== null) {
    referenced_types.push(match[1]);
  }
  
  // Pattern: /// <reference path="..." />
  const path_pattern = /\/\/\/\s*<reference\s+path="([^"]+)"\s*\/>/g;
  
  while ((match = path_pattern.exec(source_code)) !== null) {
    referenced_types.push(match[1]);
  }
  
  return referenced_types;
}

/**
 * Handle ambient module declarations
 * 
 * Bespoke because ambient modules create virtual module
 * namespaces that don't correspond to actual files.
 */
export function handle_ambient_modules(
  root_node: SyntaxNode,
  source_code: string
): Map<string, NamespaceExport[]> {
  const ambient_modules = new Map<string, NamespaceExport[]>();
  
  // Pattern: declare module "module-name" { ... }
  // Use a simpler approach to handle nested braces
  const module_pattern = /declare\s+module\s+["']([^"']+)["']\s*\{/g;
  let match;
  
  while ((match = module_pattern.exec(source_code)) !== null) {
    const module_name = match[1];
    const start_index = match.index + match[0].length;
    
    // Find the matching closing brace
    let brace_count = 1;
    let end_index = start_index;
    
    while (brace_count > 0 && end_index < source_code.length) {
      if (source_code[end_index] === '{') {
        brace_count++;
      } else if (source_code[end_index] === '}') {
        brace_count--;
      }
      end_index++;
    }
    
    const module_content = source_code.substring(start_index, end_index - 1);
    const module_exports: NamespaceExport[] = [];
    
    // Extract exports from the module content
    const export_pattern = /export\s+(const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
    let export_match;
    
    while ((export_match = export_pattern.exec(module_content)) !== null) {
      const [, kind, name] = export_match;
      module_exports.push({
        name,
        symbol_kind: kind as any
      } as any);
    }
    
    ambient_modules.set(module_name, module_exports);
  }
  
  return ambient_modules;
}

/**
 * Handle merged namespace and value declarations
 * 
 * Bespoke because TypeScript allows a namespace to merge with
 * a class, function, or enum of the same name.
 */
export function handle_namespace_value_merging(
  namespace_name: string,
  source_code: string
): { is_merged: boolean; value_type?: string } {
  // Check if there's a value declaration with the same name
  const value_patterns = [
    { pattern: new RegExp(`class\\s+${namespace_name}\\s*[{<]`), type: 'class' },
    { pattern: new RegExp(`function\\s+${namespace_name}\\s*\\(`), type: 'function' },
    { pattern: new RegExp(`enum\\s+${namespace_name}\\s*\\{`), type: 'enum' },
    { pattern: new RegExp(`const\\s+${namespace_name}\\s*=`), type: 'const' }
  ];
  
  for (const { pattern, type } of value_patterns) {
    if (pattern.test(source_code)) {
      return { is_merged: true, value_type: type };
    }
  }
  
  return { is_merged: false };
}

/**
 * Handle import type { } from 'module' syntax
 * 
 * Bespoke because type-only imports have special resolution
 * rules and don't create runtime namespaces.
 */
export function handle_type_only_imports(
  import_text: string
): { is_type_only: boolean; imported_types?: string[] } {
  // Pattern: import type { Type1, Type2 } from 'module'
  const type_import_pattern = /import\s+type\s*\{([^}]+)\}\s*from/;
  const match = type_import_pattern.exec(import_text);
  
  if (match) {
    const types = match[1].split(',').map(t => t.trim());
    return { is_type_only: true, imported_types: types };
  }
  
  // Pattern: import type * as ns from 'module'
  if (/import\s+type\s+\*\s+as/.test(import_text)) {
    return { is_type_only: true };
  }
  
  return { is_type_only: false };
}