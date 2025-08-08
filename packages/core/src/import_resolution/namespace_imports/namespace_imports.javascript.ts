/**
 * JavaScript/TypeScript Namespace Import Resolution
 * 
 * Implements namespace import resolution for JavaScript and TypeScript.
 * Handles the `import * as name from 'module'` syntax.
 */

import type { Ref, ScopeGraph } from '../../scope_resolution';
import { BaseNamespaceResolver } from './namespace_imports';

/**
 * JavaScript/TypeScript specific namespace resolver
 */
export class JavaScriptNamespaceResolver extends BaseNamespaceResolver {
  /**
   * Check if a reference is in an export context
   * For JS/TS, this checks for export { name } patterns
   */
  protected isInExportContext(ref: Ref, graph: ScopeGraph): boolean {
    // In JavaScript/TypeScript, check if the reference appears in:
    // 1. export { name }
    // 2. export { name as alias }
    // 3. export default name
    
    // This is a simplified check - a more thorough implementation
    // would examine the AST node context
    // For now, we use a heuristic that's good enough for most cases
    
    // Check if the reference appears near export statements
    const source = this.getSourceContext(ref, graph);
    if (!source) {
      return true; // Conservative: assume it might be exported
    }
    
    // Look for export patterns around the reference
    const beforeContext = source.slice(Math.max(0, ref.range.start.column - 20), ref.range.start.column);
    const afterContext = source.slice(ref.range.end.column, ref.range.end.column + 20);
    
    return (
      beforeContext.includes('export') ||
      beforeContext.includes('{') ||
      afterContext.includes('}') ||
      afterContext.includes('as')
    );
  }
  
  /**
   * Get source code context around a reference
   * This is a helper method for checking export context
   */
  private getSourceContext(ref: Ref, graph: ScopeGraph): string | undefined {
    // In a real implementation, this would get the actual source
    // For now, we return undefined to use the conservative approach
    return undefined;
  }
  
  /**
   * Extract namespace path from a member expression AST node
   * This is used for resolving nested namespace access like math.operations.multiply()
   */
  extractNamespacePath(objectNode: any): string[] {
    const path: string[] = [];
    let currentNode = objectNode;
    
    // Walk up the member expression chain
    while (this.isMemberExpression(currentNode)) {
      const propertyNode = this.getPropertyNode(currentNode);
      
      if (propertyNode) {
        path.unshift(propertyNode.text);
      }
      
      currentNode = this.getObjectNode(currentNode);
      if (!currentNode) break;
    }
    
    // Add the base identifier
    if (currentNode && currentNode.type === 'identifier') {
      path.unshift(currentNode.text);
    }
    
    return path;
  }
  
  /**
   * Check if a node is a member expression
   * In JS/TS: object.property or object['property']
   */
  private isMemberExpression(node: any): boolean {
    if (!node) return false;
    
    return (
      node.type === 'member_expression' ||
      node.type === 'subscript_expression' ||
      node.type === 'property_access_expression' || // TypeScript
      node.type === 'element_access_expression'     // TypeScript
    );
  }
  
  /**
   * Get the property part of a member expression
   */
  private getPropertyNode(node: any): any {
    if (!node) return null;
    
    // Try different field names used by tree-sitter
    return (
      node.childForFieldName('property') ||
      node.childForFieldName('index') ||
      node.childForFieldName('name') ||
      // Fallback to last child for some node types
      (node.childCount > 0 ? node.child(node.childCount - 1) : null)
    );
  }
  
  /**
   * Get the object part of a member expression
   */
  private getObjectNode(node: any): any {
    if (!node) return null;
    
    // Try different field names used by tree-sitter
    return (
      node.childForFieldName('object') ||
      node.childForFieldName('expression') ||
      // Fallback to first child for some node types
      (node.childCount > 0 ? node.child(0) : null)
    );
  }
}

/**
 * TypeScript-specific namespace resolver
 * Extends JavaScript resolver with TypeScript-specific features
 */
export class TypeScriptNamespaceResolver extends JavaScriptNamespaceResolver {
  // TypeScript namespace imports work the same as JavaScript
  // but might need special handling for:
  // - Type-only imports: import type * as types from './types'
  // - Namespace declarations: namespace MyNamespace { }
  
  /**
   * Check if an import is a type-only namespace import
   */
  isTypeOnlyNamespaceImport(imp: any): boolean {
    // Check for 'import type * as name' pattern
    // This would need access to the actual import node
    // For now, this is a placeholder
    return false;
  }
}

/**
 * Register JavaScript and TypeScript resolvers
 */
export function registerJavaScriptResolvers(): void {
  const jsResolver = new JavaScriptNamespaceResolver();
  const tsResolver = new TypeScriptNamespaceResolver();
  
  // Import the registry
  import('./namespace_imports').then(({ NamespaceResolverRegistry }) => {
    NamespaceResolverRegistry.register('javascript', jsResolver);
    NamespaceResolverRegistry.register('typescript', tsResolver);
    NamespaceResolverRegistry.register('jsx', jsResolver);
    NamespaceResolverRegistry.register('tsx', tsResolver);
  });
}

// Auto-register on module load
registerJavaScriptResolvers();