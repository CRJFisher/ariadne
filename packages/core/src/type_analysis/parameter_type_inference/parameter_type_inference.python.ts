/**
 * Python-specific bespoke parameter type inference
 *
 * Handles unique Python features that cannot be expressed through configuration:
 * - Docstring type extraction (Google/NumPy/Sphinx styles)
 * - Type normalization for Python-specific types
 * - Comprehension type analysis
 */

import { SyntaxNode } from "tree-sitter";
import {
  ParameterInfo,
  ParameterTypeInfo,
  ParameterInferenceContext,
} from "./parameter_type_inference";

/**
 * Extract type hints from Python docstrings
 */
export function extract_docstring_type(
  param_name: string,
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): string | undefined {
  const body = func_node.childForFieldName("body");
  if (!body) {
    return undefined;
  }

  // Look for docstring as first expression
  const first_stmt = body.child(0);
  if (!first_stmt || first_stmt.type !== "expression_statement") {
    return undefined;
  }

  const expr = first_stmt.child(0);
  if (!expr || expr.type !== "string") {
    return undefined;
  }

  const docstring = context.source_code.substring(
    expr.startIndex,
    expr.endIndex
  );

  // Try different docstring formats
  const google_type = extract_google_style_type(param_name, docstring);
  if (google_type) return google_type;

  const numpy_type = extract_numpy_style_type(param_name, docstring);
  if (numpy_type) return numpy_type;

  const sphinx_type = extract_sphinx_style_type(param_name, docstring);
  if (sphinx_type) return sphinx_type;

  return undefined;
}

/**
 * Extract type from Google-style docstring
 * Example:
 * Args:
 *     param_name (type): Description
 */
function extract_google_style_type(
  param_name: string,
  docstring: string
): string | undefined {
  const regex = new RegExp(`^\\s*${param_name}\\s*\\(([^)]+)\\)`, "m");
  const match = docstring.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract type from NumPy-style docstring
 * Example:
 * Parameters
 * ----------
 * param_name : type
 *     Description
 */
function extract_numpy_style_type(
  param_name: string,
  docstring: string
): string | undefined {
  const regex = new RegExp(`^\\s*${param_name}\\s*:\\s*([^\\n]+)`, "m");
  const match = docstring.match(regex);
  if (match) {
    // Remove trailing description if any
    const type_part = match[1].split(",")[0].trim();
    return type_part;
  }
  return undefined;
}

/**
 * Extract type from Sphinx-style docstring
 * Example:
 * :param param_name: Description
 * :type param_name: type
 */
function extract_sphinx_style_type(
  param_name: string,
  docstring: string
): string | undefined {
  const regex = new RegExp(`:type\\s+${param_name}:\\s*([^\\n]+)`, "m");
  const match = docstring.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Normalize Python type annotations
 */
export function normalize_python_type(type_str: string): string {
  // Handle optional types
  if (type_str.startsWith("Optional[") && type_str.endsWith("]")) {
    const inner = type_str.slice(9, -1);
    return `${normalize_python_type(inner)} | None`;
  }

  // Handle union types
  if (type_str.includes("Union[")) {
    return type_str.replace(/Union\[([^\]]+)\]/, (_, types) => {
      return types
        .split(",")
        .map((t: string) => normalize_python_type(t.trim()))
        .join(" | ");
    });
  }

  // Handle generic types
  const generic_mappings: { [key: string]: string } = {
    List: "list",
    Dict: "dict",
    Set: "set",
    Tuple: "tuple",
    Callable: "callable",
    Iterable: "iterable",
    Iterator: "iterator",
    Generator: "generator",
  };

  for (const [old_name, new_name] of Object.entries(generic_mappings)) {
    if (type_str.startsWith(old_name)) {
      return type_str.replace(old_name, new_name);
    }
  }

  return type_str;
}
