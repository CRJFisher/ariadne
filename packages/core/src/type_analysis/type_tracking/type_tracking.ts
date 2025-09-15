/**
 * Type tracking stub
 *
 * TODO: Implement using tree-sitter queries from type_tracking_queries/*.scm
 */

import {
  FileAnalysis,
  VariableType,
  FunctionSignature,
  TypeDefinition,
  TypeGraph,
  ScopeType,
  TypeString,
  TypeIndex,
} from "@ariadnejs/types";

export function build_type_index(analyses: FileAnalysis[]): TypeIndex {
  const variables = new Map<string, VariableType>();
  const functions = new Map<string, FunctionSignature>();
  const definitions = new Map<string, TypeDefinition>();
  const type_graph: TypeGraph = {
    nodes: new Map(),
    edges: [],
  };

  // Build variable types
  for (const analysis of analyses) {
    if (analysis.type_info) {
      for (const [var_name, type_info] of analysis.type_info.entries()) {
        // Skip entries that are not variables (e.g., Python instance attributes like self.count)
        // These are tracked in type_info for type analysis but aren't standalone variables
        if (var_name.includes(".")) {
          continue;
        }

        const key = `${analysis.file_path}#${var_name}`;

        // Find the scope containing this variable
        let var_scope = null;
        let scope_type = "local" as ScopeType;

        for (const [scope_id, scope] of analysis.scopes.nodes) {
          if (scope.symbols.has(var_name)) {
            var_scope = scope;
            scope_type = scope.type;
            break;
          }
        }

        if (!var_scope) {
          // Some type_info entries might not be in the scope tree (e.g., builtin types)
          // Skip them instead of throwing an error
          console.warn(
            `Variable ${var_name} has type info but not found in scope tree`
          );
          continue;
        }

        variables.set(key, {
          name: var_name,
          type: type_info.type_name,
          scope_kind: scope_type,
          location: type_info.location,
        });
      }
    }
  }

  // TODO: Build function signatures, type definitions, and type graph

  return {
    variables,
    functions,
    definitions,
    type_graph,
  };
}