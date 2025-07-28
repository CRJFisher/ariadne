import { SyntaxNode } from "tree-sitter";
import { FunctionMetadata } from "./graph";
import { LanguageConfig } from "./types";

/**
 * Extract function metadata from a tree-sitter node.
 * This is language-agnostic and delegates to language-specific extractors.
 */
export function extract_function_metadata(
  node: SyntaxNode,
  parent_node: SyntaxNode | null,
  config: LanguageConfig,
  source_code: string
): FunctionMetadata | undefined {
  const language_name = config.name.toLowerCase();
  
  switch (language_name) {
    case "typescript":
    case "tsx":
      return extract_typescript_function_metadata(node, parent_node, source_code);
    case "javascript":
    case "jsx":
      return extract_javascript_function_metadata(node, parent_node, source_code);
    case "python":
      return extract_python_function_metadata(node, parent_node, source_code);
    case "rust":
      return extract_rust_function_metadata(node, parent_node, source_code);
    default:
      return undefined;
  }
}

/**
 * Extract metadata for TypeScript functions
 */
function extract_typescript_function_metadata(
  node: SyntaxNode,
  parent_node: SyntaxNode | null,
  source_code: string
): FunctionMetadata {
  // If node is an identifier and parent is a function, use parent as the function node
  let function_node = node;
  let actual_parent = parent_node;
  
  if ((node.type === "identifier" || node.type === "property_identifier" || node.type === "private_property_identifier") && parent_node) {
    if (parent_node.type === "function_declaration" || 
        parent_node.type === "function_expression" ||
        parent_node.type === "arrow_function" ||
        parent_node.type === "method_definition" ||
        parent_node.type === "generator_function_declaration") {
      function_node = parent_node;
      actual_parent = parent_node.parent;
    }
  }

  const metadata: FunctionMetadata = {
    line_count: function_node.endPosition.row - function_node.startPosition.row + 1,
  };

  // Check if async
  const first_child = function_node.child(0);
  if (first_child && first_child.type === "async") {
    metadata.is_async = true;
  }

  // Extract parameter names
  const params_node = function_node.childForFieldName("parameters");
  if (params_node) {
    metadata.parameter_names = extract_parameter_names(params_node);
  }

  // Check if it's a test function
  metadata.is_test = is_typescript_test_function(function_node, source_code);
  
  // For arrow functions, also check if they're inside test blocks
  if (!metadata.is_test && function_node.type === "arrow_function") {
    metadata.is_test = is_arrow_function_in_test_block(function_node);
  }

  // Check if it's a method within a class
  if (actual_parent && (actual_parent.type === "class_body" || actual_parent.type === "class_declaration")) {
    // Find the class name
    let class_node = actual_parent;
    if (actual_parent.type === "class_body") {
      class_node = actual_parent.parent!;
    }
    const class_name_node = class_node.childForFieldName("name");
    if (class_name_node) {
      metadata.class_name = class_name_node.text;
    }
  }

  // Check if private (TypeScript uses private keyword or # prefix)
  if (function_node.type === "method_definition") {
    // Check for private keyword
    for (let i = 0; i < function_node.childCount; i++) {
      const child = function_node.child(i);
      if (child && child.type === "accessibility_modifier" && child.text === "private") {
        metadata.is_private = true;
        break;
      }
    }
    // Check for # prefix
    const property_name = function_node.childForFieldName("name");
    if (property_name && property_name.text.startsWith("#")) {
      metadata.is_private = true;
    }
  }
  
  // Also check if the original node was a private_property_identifier
  if (node.type === "private_property_identifier") {
    metadata.is_private = true;
    
    // For private methods, we need to check the grandparent for the class
    if (!metadata.class_name && function_node.parent && function_node.parent.type === "class_body") {
      const class_body = function_node.parent;
      if (class_body.parent && class_body.parent.type === "class_declaration") {
        const class_name_node = class_body.parent.childForFieldName("name");
        if (class_name_node) {
          metadata.class_name = class_name_node.text;
        }
      }
    }
  }

  return metadata;
}

/**
 * Extract metadata for JavaScript functions
 */
function extract_javascript_function_metadata(
  node: SyntaxNode,
  parent_node: SyntaxNode | null,
  source_code: string
): FunctionMetadata {
  // If node is an identifier and parent is a function, use parent as the function node
  let function_node = node;
  let actual_parent = parent_node;
  
  if ((node.type === "identifier" || node.type === "property_identifier" || node.type === "private_property_identifier") && parent_node) {
    if (parent_node.type === "function_declaration" || 
        parent_node.type === "function_expression" ||
        parent_node.type === "arrow_function" ||
        parent_node.type === "method_definition" ||
        parent_node.type === "generator_function_declaration") {
      function_node = parent_node;
      actual_parent = parent_node.parent;
    }
  }

  // JavaScript metadata extraction is similar to TypeScript but without type information
  const metadata: FunctionMetadata = {
    line_count: function_node.endPosition.row - function_node.startPosition.row + 1,
  };

  // Check if async
  const first_child = function_node.child(0);
  if (first_child && first_child.type === "async") {
    metadata.is_async = true;
  }

  // Extract parameter names
  const params_node = function_node.childForFieldName("parameters");
  if (params_node) {
    metadata.parameter_names = extract_parameter_names(params_node);
  }

  // Check if it's a test function
  metadata.is_test = is_javascript_test_function(function_node, source_code);
  
  // For arrow functions, also check if they're inside test blocks
  if (!metadata.is_test && function_node.type === "arrow_function") {
    metadata.is_test = is_arrow_function_in_test_block(function_node);
  }

  // Check if it's a method within a class
  if (actual_parent && (actual_parent.type === "class_body" || actual_parent.type === "class_declaration")) {
    // Find the class name
    let class_node = actual_parent;
    if (actual_parent.type === "class_body") {
      class_node = actual_parent.parent!;
    }
    const class_name_node = class_node.childForFieldName("name");
    if (class_name_node) {
      metadata.class_name = class_name_node.text;
    }
  } else if (!metadata.class_name && function_node.type === "method_definition") {
    // Alternative path: when actual_parent wasn't set correctly, check function_node's parent
    if (function_node.parent && function_node.parent.type === "class_body") {
      const class_body = function_node.parent;
      if (class_body.parent && class_body.parent.type === "class_declaration") {
        const class_name_node = class_body.parent.childForFieldName("name");
        if (class_name_node) {
          metadata.class_name = class_name_node.text;
        }
      }
    }
  }

  // Check if private (# prefix for private fields/methods)
  if (function_node.type === "method_definition") {
    const property_name = function_node.childForFieldName("name");
    if (property_name && property_name.text.startsWith("#")) {
      metadata.is_private = true;
    }
  }
  
  // Also check if the original node was a private_property_identifier
  if (node.type === "private_property_identifier") {
    metadata.is_private = true;
    
    // For private methods, we need to check if we're in a class
    if (!metadata.class_name && function_node.type === "method_definition") {
      // Method definition's parent is class_body
      if (function_node.parent && function_node.parent.type === "class_body") {
        const class_body = function_node.parent;
        if (class_body.parent && class_body.parent.type === "class_declaration") {
          const class_name_node = class_body.parent.childForFieldName("name");
          if (class_name_node) {
            metadata.class_name = class_name_node.text;
          }
        }
      }
    }
  }

  return metadata;
}

/**
 * Extract metadata for Python functions
 */
function extract_python_function_metadata(
  node: SyntaxNode,
  parent_node: SyntaxNode | null,
  _source_code: string
): FunctionMetadata {
  // If node is an identifier and parent is a function, use parent as the function node
  let function_node = node;
  let actual_parent = parent_node;
  
  if (node.type === "identifier" && parent_node && parent_node.type === "function_definition") {
    function_node = parent_node;
    actual_parent = parent_node.parent;
  }

  const metadata: FunctionMetadata = {
    line_count: function_node.endPosition.row - function_node.startPosition.row + 1,
  };

  // Check if async
  const async_keyword = function_node.child(0);
  if (async_keyword && async_keyword.type === "async") {
    metadata.is_async = true;
  }

  // Extract parameter names
  const params_node = function_node.childForFieldName("parameters");
  if (params_node) {
    metadata.parameter_names = extract_python_parameter_names(params_node);
  }

  // Get function name to check if private
  const name_node = function_node.childForFieldName("name");
  if (name_node && name_node.text.startsWith("_")) {
    metadata.is_private = true;
  }

  // Check if it's a test function
  if (name_node) {
    const func_name = name_node.text;
    if (func_name.startsWith("test_") || func_name === "setUp" || func_name === "tearDown") {
      metadata.is_test = true;
    }
  }

  // Check for decorators
  if (actual_parent && actual_parent.type === "decorated_definition") {
    metadata.has_decorator = true;
    // Check for test decorators
    const decorator_list = actual_parent.child(0);
    if (decorator_list && decorator_list.type === "decorator") {
      const decorator_text = decorator_list.text;
      if (decorator_text.includes("@pytest") || decorator_text.includes("@unittest")) {
        metadata.is_test = true;
      }
    }
  }

  // Check if it's a method within a class
  let current = actual_parent;
  while (current) {
    if (current.type === "class_definition") {
      const class_name_node = current.childForFieldName("name");
      if (class_name_node) {
        metadata.class_name = class_name_node.text;
      }
      break;
    }
    current = current.parent;
  }

  return metadata;
}

/**
 * Extract metadata for Rust functions
 */
function extract_rust_function_metadata(
  node: SyntaxNode,
  parent_node: SyntaxNode | null,
  _source_code: string
): FunctionMetadata {
  // If node is an identifier and parent is a function, use parent as the function node
  let function_node = node;
  let actual_parent = parent_node;
  
  if (node.type === "identifier" && parent_node && parent_node.type === "function_item") {
    function_node = parent_node;
    actual_parent = parent_node.parent;
  }

  const metadata: FunctionMetadata = {
    line_count: function_node.endPosition.row - function_node.startPosition.row + 1,
  };

  // Check if async
  // Look for function_modifiers node which contains async keyword
  for (let i = 0; i < function_node.childCount; i++) {
    const child = function_node.child(i);
    if (child && child.type === "function_modifiers") {
      for (let j = 0; j < child.childCount; j++) {
        const modifier = child.child(j);
        if (modifier && modifier.type === "async") {
          metadata.is_async = true;
          break;
        }
      }
      break;
    }
  }

  // Extract parameter names
  const params_node = function_node.childForFieldName("parameters");
  if (params_node) {
    metadata.parameter_names = extract_rust_parameter_names(params_node);
  }

  // Check for #[test] attribute
  // In Rust, attributes are siblings that appear before the function
  if (actual_parent) {
    const func_index = actual_parent.children.indexOf(function_node);
    if (func_index > 0) {
      const prev_sibling = actual_parent.child(func_index - 1);
      if (prev_sibling && prev_sibling.type === "attribute_item") {
        const attr_text = prev_sibling.text;
        if (attr_text.includes("#[test]") || attr_text.includes("#[cfg(test)]")) {
          metadata.is_test = true;
        }
      }
    }
  }

  // Check if it's a method within an impl block
  let current = actual_parent;
  while (current) {
    if (current.type === "impl_item") {
      // Try to find the type being implemented
      const type_node = current.childForFieldName("type");
      if (type_node) {
        metadata.class_name = type_node.text;
      }
      break;
    }
    current = current.parent;
  }

  // Check visibility for private functions (no pub keyword)
  // Look for visibility_modifier node which contains pub keyword
  let is_public = false;
  for (let i = 0; i < function_node.childCount; i++) {
    const child = function_node.child(i);
    if (child && child.type === "visibility_modifier") {
      if (child.text === "pub") {
        is_public = true;
      }
      break;
    }
  }
  metadata.is_private = !is_public;

  return metadata;
}

/**
 * Extract parameter names from a formal parameters node (TypeScript/JavaScript)
 */
function extract_parameter_names(params_node: SyntaxNode): string[] {
  const names: string[] = [];
  
  for (let i = 0; i < params_node.childCount; i++) {
    const child = params_node.child(i);
    if (!child) continue;
    
    if (child.type === "required_parameter" || child.type === "optional_parameter") {
      const pattern = child.childForFieldName("pattern");
      if (pattern && pattern.type === "identifier") {
        names.push(pattern.text);
      } else if (child.child(0) && child.child(0)!.type === "identifier") {
        names.push(child.child(0)!.text);
      }
    } else if (child.type === "rest_pattern") {
      const identifier = child.child(child.childCount - 1);
      if (identifier && identifier.type === "identifier") {
        names.push("..." + identifier.text);
      }
    } else if (child.type === "identifier") {
      // Simple parameter
      names.push(child.text);
    }
  }
  
  return names;
}

/**
 * Extract parameter names from Python parameters
 */
function extract_python_parameter_names(params_node: SyntaxNode): string[] {
  const names: string[] = [];
  
  for (let i = 0; i < params_node.childCount; i++) {
    const child = params_node.child(i);
    if (!child) continue;
    
    if (child.type === "identifier") {
      names.push(child.text);
    } else if (child.type === "default_parameter") {
      const name = child.childForFieldName("name");
      if (name) {
        names.push(name.text);
      }
    } else if (child.type === "typed_parameter") {
      const identifier = child.child(0);
      if (identifier && identifier.type === "identifier") {
        names.push(identifier.text);
      }
    } else if (child.type === "list_splat_pattern") {
      const identifier = child.child(1);
      if (identifier && identifier.type === "identifier") {
        names.push("*" + identifier.text);
      }
    } else if (child.type === "dictionary_splat_pattern") {
      const identifier = child.child(1);
      if (identifier && identifier.type === "identifier") {
        names.push("**" + identifier.text);
      }
    }
  }
  
  return names;
}

/**
 * Extract parameter names from Rust parameters
 */
function extract_rust_parameter_names(params_node: SyntaxNode): string[] {
  const names: string[] = [];
  
  for (let i = 0; i < params_node.childCount; i++) {
    const child = params_node.child(i);
    if (!child) continue;
    
    if (child.type === "parameter") {
      // Check if there's a mutable_specifier before the pattern
      let has_mut = false;
      for (let j = 0; j < child.childCount; j++) {
        const param_child = child.child(j);
        if (param_child && param_child.type === "mutable_specifier") {
          has_mut = true;
          break;
        }
      }
      
      const pattern = child.childForFieldName("pattern");
      if (pattern) {
        if (pattern.type === "identifier") {
          names.push(has_mut ? "mut " + pattern.text : pattern.text);
        } else if (pattern.type === "ref_pattern") {
          const identifier = pattern.child(1);
          if (identifier && identifier.type === "identifier") {
            names.push("ref " + identifier.text);
          }
        } else if (pattern.type === "mut_pattern") {
          // This case might not occur based on our tests, but keep it for completeness
          const identifier = pattern.child(1);
          if (identifier && identifier.type === "identifier") {
            names.push("mut " + identifier.text);
          }
        }
      }
    } else if (child.type === "self_parameter") {
      names.push(child.text);
    }
  }
  
  return names;
}

/**
 * Check if a TypeScript function is a test function
 */
function is_typescript_test_function(node: SyntaxNode, _source_code: string): boolean {
  const name_node = node.childForFieldName("name");
  if (!name_node) return false;
  
  const func_name = name_node.text;
  
  // Check common test patterns
  if (func_name.startsWith("test") || func_name.endsWith("Test") || func_name.endsWith("_test")) {
    return true;
  }
  
  // Check if it's inside a test block (describe, it, test)
  let parent = node.parent;
  while (parent) {
    if (parent.type === "call_expression") {
      const func = parent.childForFieldName("function");
      if (func && (func.text === "describe" || func.text === "it" || func.text === "test" || func.text === "beforeEach" || func.text === "afterEach")) {
        return true;
      }
    }
    parent = parent.parent;
  }
  
  return false;
}

/**
 * Check if a JavaScript function is a test function
 */
function is_javascript_test_function(node: SyntaxNode, source_code: string): boolean {
  // Same logic as TypeScript
  return is_typescript_test_function(node, source_code);
}

/**
 * Check if an arrow function is inside a test block (it, describe, test)
 */
function is_arrow_function_in_test_block(node: SyntaxNode): boolean {
  let parent = node.parent;
  
  // Look up the tree for a call expression with test-related function names
  while (parent) {
    if (parent.type === "call_expression") {
      const func = parent.childForFieldName("function");
      if (func) {
        const funcText = func.text;
        if (funcText === "it" || funcText === "test" || funcText === "describe" || 
            funcText === "beforeEach" || funcText === "afterEach" || 
            funcText === "beforeAll" || funcText === "afterAll") {
          return true;
        }
      }
    }
    parent = parent.parent;
  }
  
  return false;
}