/**
 * Method call detection and resolution
 *
 * Combines generic configuration-driven detection with bespoke language features
 */

import { SyntaxNode } from "tree-sitter";
import { MethodCallInfo } from "@ariadnejs/types";
import { TypeInfo } from "../../type_analysis/type_tracking";
import { 
  MethodCallContext, 
  find_method_calls_generic,
  METHOD_CALLS_CONTEXT
} from "./method_calls";

// Import bespoke handlers
import { 
  find_javascript_bespoke_method_calls 
} from "./method_calls.javascript";
import { 
  find_typescript_bespoke_method_calls,
  enhance_typescript_method_call
} from "./method_calls.typescript";
import { 
  find_python_bespoke_method_calls,
  enhance_python_method_call
} from "./method_calls.python";
import { 
  find_rust_bespoke_method_calls,
  enhance_rust_method_call
} from "./method_calls.rust";

// Re-export types and constants
export { MethodCallInfo } from "@ariadnejs/types";
export { MethodCallContext, METHOD_CALLS_CONTEXT } from "./method_calls";

// Export hierarchy enrichment functions for Global Assembly phase
export {
  enrich_method_calls_with_hierarchy,
  resolve_method_in_hierarchy,
  analyze_virtual_call,
  get_available_methods,
  is_inherited_method,
  MethodCallWithHierarchy
} from "./method_hierarchy_resolver";

/**
 * Find all method calls in code (Per-File Phase - Layer 4)
 *
 * Combines configuration-driven generic detection (85% of patterns) with
 * bespoke language-specific handlers (15% unique features).
 * 
 * NOTE: This is a per-file analysis function. It can only use local type information.
 * Full method resolution requiring class hierarchy happens in the global phase.
 *
 * @param context The context containing source code, AST, and metadata
 * @param type_map Optional map of variable types for resolving receiver types (from Layer 3)
 * @returns Array of method call information with partial resolution
 */
export function find_method_calls(
  context: MethodCallContext,
  type_map?: Map<string, TypeInfo[]>
): MethodCallInfo[] {
  // Start with generic processor (handles 85% of patterns)
  const generic_calls = find_method_calls_generic(context, type_map);
  
  // Find bespoke patterns and enhance generic calls
  const all_calls: MethodCallInfo[] = [];
  const processed_nodes = new Set<SyntaxNode>();
  
  // Walk AST to find bespoke patterns
  walk_tree(context.ast_root, (node) => {
    // Try bespoke detection based on language
    let bespoke_call: MethodCallInfo | null = null;
    
    switch (context.language) {
      case "javascript":
        bespoke_call = find_javascript_bespoke_method_calls(node, context.source_code);
        break;
        
      case "typescript":
        bespoke_call = find_typescript_bespoke_method_calls(node, context.source_code);
        break;
        
      case "python":
        bespoke_call = find_python_bespoke_method_calls(node, context.source_code);
        break;
        
      case "rust":
        bespoke_call = find_rust_bespoke_method_calls(node, context.source_code);
        break;
    }
    
    if (bespoke_call) {
      all_calls.push(bespoke_call);
      processed_nodes.add(node);
    }
  });
  
  // Add generic calls that weren't already processed as bespoke
  for (const call of generic_calls) {
    // Check if this call's node was already processed
    const is_duplicate = Array.from(processed_nodes).some(node => 
      node.startPosition.row === call.location.line &&
      node.startPosition.column === call.location.column
    );
    
    if (!is_duplicate) {
      // Enhance with language-specific metadata
      let enhanced_call = call;
      
      // Find the original node for enhancement
      const node = find_node_at_location(
        context.ast_root,
        call.location.line,
        call.location.column
      );
      
      if (node) {
        switch (context.language) {
          case "typescript":
            enhanced_call = enhance_typescript_method_call(call, node, context.source_code);
            break;
            
          case "python":
            enhanced_call = enhance_python_method_call(call, node, context.source_code);
            break;
            
          case "rust":
            enhanced_call = enhance_rust_method_call(call, node, context.source_code);
            break;
        }
      }
      
      all_calls.push(enhanced_call);
    }
  }
  
  return all_calls;
}

/**
 * Walk the AST tree
 */
function walk_tree(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      walk_tree(child, callback);
    }
  }
}

/**
 * Find a node at a specific location
 */
function find_node_at_location(
  root: SyntaxNode,
  line: number,
  column: number
): SyntaxNode | null {
  let result: SyntaxNode | null = null;
  
  walk_tree(root, (node) => {
    if (node.startPosition.row === line && 
        node.startPosition.column === column &&
        node.type.includes('call')) {
      result = node;
    }
  });
  
  return result;
}
