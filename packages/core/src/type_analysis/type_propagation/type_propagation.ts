/**
 * Core type propagation functionality
 *
 * Propagates type information through:
 * - Variable assignments
 * - Function calls and returns
 * - Property access chains
 * - Control flow narrowing
 *
 * This module uses configuration-driven processing for ~85% of type propagation logic,
 * with language-specific bespoke handlers for unique features.
 */

import { SyntaxNode } from "tree-sitter";
import {
  Language,
  TypeFlow,
  PropagationPath,
  ScopeTree,
  FilePath,
  FileAnalysis,
  ResolvedGeneric,
  get_map_value,
} from "@ariadnejs/types";
import {
  get_type_propagation_config,
  is_assignment_node,
  is_declaration_node,
  is_call_node,
  is_member_access_node,
  get_constructor_type,
} from "./language_configs";
import { ModuleGraphWithEdges } from "../../import_export/module_graph";
import { TypeRegistry } from "../type_registry";

/**
 * Context for type propagation (internal use only)
 */
export interface TypePropagationContext {
  language: Language;
  source_code: string;
  file_path?: FilePath;
  scope_tree?: ScopeTree;
  known_types?: Map<string, string>;
  debug?: boolean;
}

/**
 * Result of type propagation analysis (internal use only)
 */
export interface PropagationAnalysis {
  flows: TypeFlow[];
  paths: PropagationPath[];
  type_map: Map<string, string>;
}

/**
 * Propagate types through variable assignments (configuration-driven)
 */
export function propagate_assignment_types(
  assignment_node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const { language } = context;

  // Use configuration to determine if this is an assignment
  if (
    !is_assignment_node(assignment_node.type, language) &&
    !is_declaration_node(assignment_node.type, language)
  ) {
    return flows;
  }

  // Extract left-hand side (target) and right-hand side (source)
  const lhs = get_assignment_target(assignment_node, context);
  const rhs = get_assignment_source(assignment_node, context);

  if (lhs && rhs) {
    const source_type = infer_expression_type(rhs.node, context);

    if (source_type) {
      flows.push({
        source_type,
        target_identifier: lhs.identifier,
        flow_kind: "assignment",
        confidence: rhs.is_literal ? "explicit" : "inferred",
        position: {
          row: assignment_node.startPosition.row,
          column: assignment_node.startPosition.column,
        },
      });
    }
  }

  return flows;
}

/**
 * Extract assignment target (LHS) using configuration
 */
function get_assignment_target(
  node: SyntaxNode,
  context: TypePropagationContext
): { identifier: string; is_property: boolean } | undefined {
  const { language, source_code } = context;
  const config = get_type_propagation_config(language);

  // Get the left field based on configuration
  const left =
    node.childForFieldName(config.fields.left) ||
    node.childForFieldName(config.fields.name) ||
    node.childForFieldName("pattern"); // Rust uses pattern

  if (left) {
    if (left.type === "identifier") {
      return {
        identifier: source_code.substring(left.startIndex, left.endIndex),
        is_property: false,
      };
    } else if (is_member_access_node(left.type, language)) {
      // Handle property assignment
      const property = left.childForFieldName(config.fields.property);
      if (property) {
        return {
          identifier: source_code.substring(
            property.startIndex,
            property.endIndex
          ),
          is_property: true,
        };
      }
    }
  }

  return undefined;
}

/**
 * Extract assignment source (RHS) using configuration
 */
function get_assignment_source(
  node: SyntaxNode,
  context: TypePropagationContext
): { node: SyntaxNode; is_literal: boolean } | undefined {
  const { language } = context;
  const config = get_type_propagation_config(language);

  // Try different field names based on configuration
  const right =
    node.childForFieldName(config.fields.right) ||
    node.childForFieldName(config.fields.value) ||
    node.childForFieldName(config.fields.init);

  if (right) {
    return {
      node: right,
      is_literal: is_literal_node(right, language),
    };
  }

  return undefined;
}

/**
 * Check if a node is a literal value using configuration
 */
function is_literal_node(node: SyntaxNode, language: Language): boolean {
  const config = get_type_propagation_config(language);
  return config.literal_nodes.includes(node.type);
}

/**
 * Infer type from an expression node
 */
function infer_expression_type(
  expr_node: SyntaxNode,
  context: TypePropagationContext
): string | undefined {
  const { language, source_code } = context;

  // Check for literals
  if (is_literal_node(expr_node, language)) {
    return get_literal_type(expr_node, language);
  }

  // Check for constructor calls
  if (is_constructor_call(expr_node, language)) {
    return extract_constructor_type(expr_node, source_code, language);
  }

  // Check for function calls
  if (is_function_call(expr_node, language)) {
    // Would need integration with return type inference
    return undefined;
  }

  // Check for identifiers (look up from known types)
  if (expr_node.type === "identifier") {
    const identifier_name = source_code.substring(
      expr_node.startIndex,
      expr_node.endIndex
    );
    if (context.known_types?.has(identifier_name)) {
      return get_map_value(context.known_types, identifier_name,
        `Expected type information for identifier '${identifier_name}'`);
    }
    return undefined;
  }

  return undefined;
}

/**
 * Get type of a literal node (configuration-driven with language-specific mappings)
 */
function get_literal_type(node: SyntaxNode, language: Language): string {
  // Define literal type mappings per language
  const literalTypeMappings: Record<string, Record<string, string>> = {
    javascript: {
      string: "string",
      template_string: "string",
      number: "number",
      true: "boolean",
      false: "boolean",
      null: "null",
      undefined: "undefined",
    },
    jsx: {
      string: "string",
      template_string: "string",
      number: "number",
      true: "boolean",
      false: "boolean",
      null: "null",
      undefined: "undefined",
    },
    typescript: {
      string: "string",
      template_string: "string",
      number: "number",
      true: "boolean",
      false: "boolean",
      null: "null",
      undefined: "undefined",
    },
    tsx: {
      string: "string",
      template_string: "string",
      number: "number",
      true: "boolean",
      false: "boolean",
      null: "null",
      undefined: "undefined",
    },
    python: {
      string: "str",
      integer: "int",
      float: "float",
      true: "bool",
      false: "bool",
      none: "None",
    },
    rust: {
      string_literal: "&str",
      integer_literal: "i32",
      float_literal: "f64",
      boolean_literal: "bool",
      char_literal: "char",
    },
  };

  const mapping = literalTypeMappings[language];
  if (mapping && mapping[node.type]) {
    return mapping[node.type];
  }

  // Default fallback
  return language === "python" ? "Any" : language === "rust" ? "_" : "unknown";
}

/**
 * Check if node is a constructor call using configuration
 */
function is_constructor_call(node: SyntaxNode, language: Language): boolean {
  if (node.type === "new_expression") return true; // JS/TS new expressions
  if (node.type === "struct_expression") return true; // Rust struct literals

  // Check if it's a call to a constructor function
  const config = get_type_propagation_config(language);
  if (config.call_nodes.includes(node.type)) {
    // Language-specific checks for constructor patterns
    if (language === "python") {
      // Python constructors are capitalized function calls
      return is_capitalized_identifier(node, language);
    }
    if (language === "rust") {
      // Rust constructors often use :: (associated functions)
      return has_double_colon(node);
    }
  }

  return false;
}

/**
 * Check if node is a function call using configuration
 */
function is_function_call(node: SyntaxNode, language: Language): boolean {
  return is_call_node(node.type, language);
}

/**
 * Check if identifier is capitalized (for Python constructor detection)
 */
function is_capitalized_identifier(
  node: SyntaxNode,
  language: Language
): boolean {
  if (language !== "python" || node.type !== "call") return false;

  const func = node.childForFieldName("function");
  if (func && func.type === "identifier") {
    const name = func.text;
    return name ? name[0] === name[0].toUpperCase() : false;
  }

  return false;
}

/**
 * Check if call has double colon (for Rust associated functions)
 */
function has_double_colon(node: SyntaxNode): boolean {
  const text = node.text;
  return text ? text.includes("::") : false;
}

/**
 * Extract constructor type from call using configuration
 */
function extract_constructor_type(
  node: SyntaxNode,
  source_code: string,
  language: Language
): string | undefined {
  const config = get_type_propagation_config(language);

  // Handle new expressions (JS/TS)
  if (node.type === "new_expression") {
    const constructor = node.childForFieldName("constructor");
    if (constructor) {
      return source_code.substring(
        constructor.startIndex,
        constructor.endIndex
      );
    }
  }

  // Handle struct expressions (Rust)
  if (node.type === "struct_expression") {
    const name =
      node.childForFieldName("name") || node.childForFieldName("type");
    if (name) {
      return source_code.substring(name.startIndex, name.endIndex);
    }
  }

  // Handle regular calls that might be constructors
  if (is_call_node(node.type, language)) {
    const func =
      node.childForFieldName(config.fields.function) ||
      node.childForFieldName(config.fields.callee);
    if (func) {
      const name = source_code.substring(func.startIndex, func.endIndex);

      // Check if it's a known constructor
      const constructorType = get_constructor_type(name, language);
      if (constructorType) {
        return constructorType;
      }

      // Python: Check if it's a capitalized name (likely a class)
      if (language === "python" && name[0] === name[0].toUpperCase()) {
        return name;
      }
    }
  }

  return undefined;
}

/**
 * Extract arguments from a function call
 */
function extract_call_arguments(
  call_node: SyntaxNode,
  context: TypePropagationContext
): SyntaxNode[] {
  const args: SyntaxNode[] = [];
  const { language } = context;

  let args_node: SyntaxNode | null = null;
  switch (language) {
    case "javascript":
    case "typescript":
      args_node = call_node.childForFieldName("arguments");
      break;
    case "python":
      args_node = call_node.childForFieldName("arguments");
      break;
    case "rust":
      args_node = call_node.childForFieldName("arguments");
      break;
  }

  if (args_node) {
    for (let i = 0; i < args_node.childCount; i++) {
      const arg = args_node.child(i);
      if (arg && arg.type !== "," && arg.type !== "(" && arg.type !== ")") {
        args.push(arg);
      }
    }
  }

  return args;
}

/**
 * Propagate types through property access
 */
export function propagate_property_types(
  _member_node: SyntaxNode,
  _context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];

  // For now, return empty flows - property type inference would need
  // integration with the type registry and class definitions
  return flows;
}

/**
 * Merge multiple type flows
 */
export function merge_type_flows(...flow_arrays: TypeFlow[][]): TypeFlow[] {
  const merged: TypeFlow[] = [];
  const seen = new Set<string>();

  for (const flows of flow_arrays) {
    for (const flow of flows) {
      const key = `${flow.target_identifier}-${flow.source_type}-${flow.position.row}-${flow.position.column}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(flow);
      }
    }
  }

  return merged;
}
/**
 * Propagate types across all files in the codebase
 * This is the ONLY function used by code_graph.ts - the main entry point
 */

export async function propagate_types_across_files(
  analyses: FileAnalysis[],
  _type_registry: TypeRegistry, // Reserved for future use
  resolved_generics: Map<string, ResolvedGeneric[]>,
  _modules: ModuleGraphWithEdges // Reserved for future use
): Promise<Map<FilePath, TypeFlow[]>> {
  const all_type_flows = new Map<FilePath, TypeFlow[]>();

  // Process each file's analysis
  for (const analysis of analyses) {
    const file_flows: TypeFlow[] = [];

    // Build context with known types from type registry and resolved generics
    const known_types = new Map<string, string>();

    // Add function return types from registry
    for (const func of analysis.functions) {
      if (func.signature.return_type) {
        known_types.set(func.name, func.signature.return_type);
      }
    }

    // Add class types from registry
    for (const cls of analysis.classes) {
      known_types.set(cls.name, cls.name);
    }

    // Add resolved generic types
    const file_generics = resolved_generics.get(analysis.file_path);
    if (file_generics) {
      for (const generic of file_generics) {
        // Store the resolved generic type - use original_type as key
        known_types.set(generic.original_type, generic.resolved_type || "T");
      }
    }

    // Context would be used here for more sophisticated type propagation
    // Currently we directly process the analysis data
    // Analyze assignments for type flow
    for (const variable of analysis.variables) {
      // VariableDeclaration doesn't have initial_value, only type
      if (variable.type) {
        // Create a type flow from the type annotation
        file_flows.push({
          source_type: variable.type,
          target_identifier: variable.name,
          flow_kind: "assignment",
          confidence: "explicit",
          position: {
            row: variable.location.line,
            column: variable.location.column,
          },
        });
      }
    }

    // Analyze function calls for type propagation
    for (const call of analysis.function_calls) {
      // If we know the return type of the called function, propagate it
      const func_type = known_types.get(call.callee_name);
      if (func_type && func_type.includes("=>")) {
        const return_type = func_type.split("=>")[1].trim();
        // This would need more context to know where the return value flows to
        // For now, just track that this call site has a known return type
        file_flows.push({
          source_type: return_type,
          target_identifier: `_call_${call.callee_name}_${call.location.line}`,
          flow_kind: "return",
          confidence: "inferred",
          position: {
            row: call.location.line,
            column: call.location.column,
          },
        });
      }
    }

    // Store flows for this file if any were found
    if (file_flows.length > 0) {
      all_type_flows.set(analysis.file_path, file_flows);
    }
  }

  return all_type_flows;
}
