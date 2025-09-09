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
 * or
 * :param type param_name: Description
 */
function extract_sphinx_style_type(
  param_name: string,
  docstring: string
): string | undefined {
  // Try :type param_name: format first
  let regex = new RegExp(`:type\\s+${param_name}:\\s*([^\\n]+)`, "m");
  let match = docstring.match(regex);
  if (match) return match[1].trim();
  
  // Try :param type param_name: format
  regex = new RegExp(`:param\\s+(\\w+)\\s+${param_name}:`, "m");
  match = docstring.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Normalize Python type annotations
 */
export function normalize_python_type(type_str: string): string {
  // Remove typing module prefix
  let normalized = type_str.replace(/^typing\./, '');
  
  // Handle optional types
  if (normalized.startsWith("Optional[") && normalized.endsWith("]")) {
    const inner = normalized.slice(9, -1);
    return `${normalize_python_type(inner)} | None`;
  }

  // Handle union types - need to handle nested brackets properly
  if (normalized.includes("Union[")) {
    // Find the matching closing bracket for Union
    const start = normalized.indexOf("Union[");
    let depth = 0;
    let end = start + 6; // Start after "Union["
    for (let i = end; i < normalized.length; i++) {
      if (normalized[i] === '[') depth++;
      if (normalized[i] === ']') {
        if (depth === 0) {
          end = i;
          break;
        }
        depth--;
      }
    }
    
    const unionContent = normalized.substring(start + 6, end);
    const types = [];
    let current = '';
    let bracketDepth = 0;
    
    for (let i = 0; i < unionContent.length; i++) {
      const char = unionContent[i];
      if (char === '[') bracketDepth++;
      if (char === ']') bracketDepth--;
      if (char === ',' && bracketDepth === 0) {
        types.push(normalize_python_type(current.trim()));
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      types.push(normalize_python_type(current.trim()));
    }
    
    const before = normalized.substring(0, start);
    const after = normalized.substring(end + 1);
    return before + types.join(' | ') + after;
  }

  // Handle generic types - but preserve Callable with capital C
  const generic_mappings: { [key: string]: string } = {
    List: "list",
    Dict: "dict",
    Set: "set",
    Tuple: "tuple",
    Iterable: "iterable",
    Iterator: "iterator",
    Generator: "generator",
  };

  // Apply generic mappings recursively for nested types
  for (const [old_name, new_name] of Object.entries(generic_mappings)) {
    // Use a regex that handles nested generics
    const regex = new RegExp(`\\b${old_name}\\b`, 'g');
    normalized = normalized.replace(regex, new_name);
  }

  return normalized;
}
