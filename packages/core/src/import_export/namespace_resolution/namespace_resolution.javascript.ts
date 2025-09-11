/**
 * JavaScript-specific bespoke namespace resolution
 * 
 * Handles truly unique JavaScript patterns that cannot be
 * expressed through configuration (~15% of logic)
 */

import { SyntaxNode } from 'tree-sitter';
import { NamespaceImportInfo, NamespaceExport } from './namespace_resolution';

/**
 * Handle CommonJS require() patterns with complex destructuring
 * 
 * Bespoke because CommonJS has complex assignment patterns that
 * are difficult to express through configuration.
 */
export function handle_commonjs_require(
  root_node: SyntaxNode,
  source_code: string
): NamespaceImportInfo[] {
  const imports: NamespaceImportInfo[] = [];
  
  // Pattern: const { a, b: c } = require('module')
  // This creates multiple imports, not a namespace
  // But const ns = require('module') creates a namespace
  
  const require_pattern = /const\s+(\{[^}]+\}|\w+)\s*=\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let match;
  
  while ((match = require_pattern.exec(source_code)) !== null) {
    const [, assignment, module_path] = match;
    
    // Check if it's a destructuring assignment
    if (!assignment.startsWith('{')) {
      // Simple namespace assignment
      imports.push({
        namespace_name: assignment,
        source_module: module_path,
        is_namespace: true,
        members: undefined
      });
    }
    // Destructuring is handled by normal import processing, not namespace
  }
  
  return imports;
}

/**
 * Handle dynamic import() with await
 * 
 * Bespoke because async patterns require special handling
 * for promise resolution and error cases.
 */
export function handle_dynamic_imports(
  root_node: SyntaxNode,
  source_code: string
): NamespaceImportInfo[] {
  const imports: NamespaceImportInfo[] = [];
  
  // Pattern: const ns = await import('module')
  const dynamic_pattern = /const\s+(\w+)\s*=\s*await\s+import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let match;
  
  while ((match = dynamic_pattern.exec(source_code)) !== null) {
    const [, namespace_name, module_path] = match;
    
    imports.push({
      namespace_name,
      source_module: module_path,
      is_namespace: true,
      members: undefined
    });
  }
  
  return imports;
}

/**
 * Handle module.exports object spreading
 * 
 * Bespoke because module.exports can be assigned in complex ways
 * that create implicit namespaces.
 */
export function handle_module_exports_spreading(
  exports: Map<string, NamespaceExport>,
  source_code: string
): void {
  // Pattern: module.exports = { ...require('./other'), additionalExport }
  const spread_pattern = /module\.exports\s*=\s*\{[^}]*\.\.\.require\s*\([^)]+\)[^}]*\}/;
  
  if (spread_pattern.test(source_code)) {
    // Mark that this module re-exports another module's namespace
    // This affects how imports from this module are resolved
    // Implementation would require AST analysis to extract the spread sources
  }
}

/**
 * Handle prototype chain namespace extensions
 * 
 * Bespoke because JavaScript allows extending objects through
 * prototype chains which creates implicit namespace members.
 */
export function handle_prototype_extensions(
  namespace_name: string,
  source_code: string
): string[] {
  const members: string[] = [];
  
  // Escape special regex characters in namespace name
  const escaped_name = namespace_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Pattern: MyNamespace.prototype.method = function() {}
  const proto_pattern = new RegExp(
    `${escaped_name}\\.prototype\\.(\\w+)\\s*=`,
    'g'
  );
  
  let match;
  while ((match = proto_pattern.exec(source_code)) !== null) {
    members.push(match[1]);
  }
  
  return members;
}