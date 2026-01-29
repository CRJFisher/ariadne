/**
 * Tests for Python symbol factories
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
// @ts-expect-error - tree-sitter-python types
import Python from "tree-sitter-python";
import type { SyntaxNode } from "tree-sitter";
import {
  create_class_id,
  create_method_id,
  create_function_id,
  create_variable_id,
  create_parameter_id,
  create_property_id,
  create_enum_id,
  create_enum_member_id,
  create_protocol_id,
  create_type_alias_id,
  find_containing_class,
  find_containing_enum,
  find_containing_protocol,
  find_containing_callable,
  find_decorator_target,
  extract_return_type,
  extract_parameter_type,
  extract_property_type,
  extract_type_annotation,
  extract_default_value,
  extract_initial_value,
  extract_extends,
  extract_import_path,
  extract_export_info,
  is_async_function,
  determine_method_type,
  detect_callback_context,
  detect_function_collection,
} from "./symbol_factories.python";
import { anonymous_function_symbol } from "@ariadnejs/types";
import type { FilePath } from "@ariadnejs/types";
import { node_to_location } from "../../node_utils";

// Helper to parse Python code
function parse_python(code: string): SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(Python);
  const tree = parser.parse(code);
  return tree.rootNode;
}

// Helper to find function name node
function find_function_name_node(root: SyntaxNode, fn_name: string): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "function_definition") {
      const name_node = node.childForFieldName?.("name");
      if (name_node && name_node.text === fn_name) {
        return name_node;
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const result = visit(child);
        if (result) return result;
      }
    }
    return null;
  }
  return visit(root);
}

describe("Python Symbol Factory Exports", () => {
  it("should export create_class_id", () => {
    expect(typeof create_class_id).toBe("function");
  });

  it("should export create_method_id", () => {
    expect(typeof create_method_id).toBe("function");
  });

  it("should export create_function_id", () => {
    expect(typeof create_function_id).toBe("function");
  });

  it("should export create_variable_id", () => {
    expect(typeof create_variable_id).toBe("function");
  });

  it("should export create_parameter_id", () => {
    expect(typeof create_parameter_id).toBe("function");
  });

  it("should export create_property_id", () => {
    expect(typeof create_property_id).toBe("function");
  });

  it("should export create_enum_id", () => {
    expect(typeof create_enum_id).toBe("function");
  });

  it("should export create_enum_member_id", () => {
    expect(typeof create_enum_member_id).toBe("function");
  });

  it("should export create_protocol_id", () => {
    expect(typeof create_protocol_id).toBe("function");
  });

  it("should export create_type_alias_id", () => {
    expect(typeof create_type_alias_id).toBe("function");
  });
});

describe("Python Container Finding Functions", () => {
  it("should export find_containing_class", () => {
    expect(typeof find_containing_class).toBe("function");
  });

  it("should export find_containing_enum", () => {
    expect(typeof find_containing_enum).toBe("function");
  });

  it("should export find_containing_protocol", () => {
    expect(typeof find_containing_protocol).toBe("function");
  });

  it("should export find_containing_callable", () => {
    expect(typeof find_containing_callable).toBe("function");
  });

  it("should export find_decorator_target", () => {
    expect(typeof find_decorator_target).toBe("function");
  });
});

describe("Python Type Extraction Functions", () => {
  it("should export extract_return_type", () => {
    expect(typeof extract_return_type).toBe("function");
  });

  it("should export extract_parameter_type", () => {
    expect(typeof extract_parameter_type).toBe("function");
  });

  it("should export extract_property_type", () => {
    expect(typeof extract_property_type).toBe("function");
  });

  it("should export extract_type_annotation", () => {
    expect(typeof extract_type_annotation).toBe("function");
  });
});

describe("Python Analysis Functions", () => {
  it("should export is_async_function", () => {
    expect(typeof is_async_function).toBe("function");
  });

  it("should export determine_method_type", () => {
    expect(typeof determine_method_type).toBe("function");
  });

  it("should export detect_callback_context", () => {
    expect(typeof detect_callback_context).toBe("function");
  });

  it("should export detect_function_collection", () => {
    expect(typeof detect_function_collection).toBe("function");
  });
});

describe("Python Import/Export Functions", () => {
  it("should export extract_import_path", () => {
    expect(typeof extract_import_path).toBe("function");
  });

  it("should export extract_export_info", () => {
    expect(typeof extract_export_info).toBe("function");
  });
});

describe("extract_export_info (Python visibility via naming conventions)", () => {
  // Python's extract_export_info takes (name, defining_scope_id, module_scope_id)
  // For module-level definitions: defining_scope_id === module_scope_id
  const MODULE_SCOPE_ID = "scope:module" as import("@ariadnejs/types").ScopeId;

  it("should mark public functions as exported at module level", () => {
    const result = extract_export_info("public_function", MODULE_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(true);
  });

  it("should mark single underscore private functions as not exported", () => {
    const result = extract_export_info("_private_function", MODULE_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(false);
  });

  it("should mark double underscore private functions as not exported", () => {
    const result = extract_export_info("__private_function", MODULE_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(false);
  });

  it("should mark dunder methods (__init__) as exported at module level", () => {
    const result = extract_export_info("__init__", MODULE_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(true);
  });

  it("should mark other dunder methods (__str__) as exported at module level", () => {
    const result = extract_export_info("__str__", MODULE_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(true);
  });

  it("should mark __eq__ dunder method as exported at module level", () => {
    const result = extract_export_info("__eq__", MODULE_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(true);
  });

  it("should mark nested functions as not exported", () => {
    // A function defined inside another function (not at module scope)
    const NESTED_SCOPE_ID = "scope:nested" as import("@ariadnejs/types").ScopeId;
    const result = extract_export_info("helper", NESTED_SCOPE_ID, MODULE_SCOPE_ID);
    expect(result.is_exported).toBe(false);
  });
});

// Helper to find the lambda node
function find_lambda(root: SyntaxNode): SyntaxNode | null {
  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "lambda") {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const result = visit(child);
        if (result) return result;
      }
    }
    return null;
  }
  return visit(root);
}

// Helper to find a parameter inside a lambda
function find_lambda_param(root: SyntaxNode, param_name: string): SyntaxNode | null {
  const lambda = find_lambda(root);
  if (!lambda) return null;

  function visit(node: SyntaxNode): SyntaxNode | null {
    if (node.type === "identifier" && node.text === param_name) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const result = visit(child);
        if (result) return result;
      }
    }
    return null;
  }

  // Look for parameters in the lambda's parameters field
  const params = lambda.childForFieldName?.("parameters");
  if (params) {
    return visit(params);
  }
  return null;
}

describe("find_containing_callable with lambda functions", () => {
  const file_path = "/test.py" as FilePath;

  it("should return matching SymbolId for lambda parameters", () => {
    const code = "fn = lambda x: x * 2";
    const root = parse_python(code);

    // Find the parameter 'x' node
    const param_node = find_lambda_param(root, "x");
    expect(param_node).not.toBeNull();

    // Find the lambda node
    const lambda_node = find_lambda(root);
    expect(lambda_node).not.toBeNull();

    // Create capture node for parameter
    const capture = {
      node: param_node!,
      text: "x",
      name: "definition.parameter",
      location: {
        file_path,
        start_line: param_node!.startPosition.row + 1,
        start_column: param_node!.startPosition.column + 1,
        end_line: param_node!.endPosition.row + 1,
        end_column: param_node!.endPosition.column + 1,
      },
    };

    // Get the callable ID
    const callable_id = find_containing_callable(capture);

    // Expected: anonymous_function_symbol with lambda's location
    const expected_id = anonymous_function_symbol(node_to_location(lambda_node!, file_path));

    expect(callable_id).toBe(expected_id);
  });

  it("should return matching SymbolId for callback lambda parameters", () => {
    const code = "result = reduce(lambda acc, item: acc + item, items, 0)";
    const root = parse_python(code);

    // Find the parameter 'acc' node
    const param_node = find_lambda_param(root, "acc");
    expect(param_node).not.toBeNull();

    // Find the lambda node
    const lambda_node = find_lambda(root);
    expect(lambda_node).not.toBeNull();

    // Create capture node for parameter
    const capture = {
      node: param_node!,
      text: "acc",
      name: "definition.parameter",
      location: {
        file_path,
        start_line: param_node!.startPosition.row + 1,
        start_column: param_node!.startPosition.column + 1,
        end_line: param_node!.endPosition.row + 1,
        end_column: param_node!.endPosition.column + 1,
      },
    };

    // Get the callable ID
    const callable_id = find_containing_callable(capture);

    // Expected: anonymous_function_symbol with lambda's location
    const expected_id = anonymous_function_symbol(node_to_location(lambda_node!, file_path));

    expect(callable_id).toBe(expected_id);
  });
});

describe("detect_callback_context", () => {
  const file_path = "/test.py" as FilePath;

  describe("direct function call patterns", () => {
    it("should detect callback in map(lambda x: ...)", () => {
      const code = "result = list(map(lambda x: x * 2, items))";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
      expect(result.receiver_location?.start_line).toBe(1);
    });

    it("should detect callback in filter(lambda x: ...)", () => {
      const code = "result = list(filter(lambda x: x > 0, items))";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });

    it("should detect callback in sorted(key=lambda x: ...)", () => {
      const code = "result = sorted(items, key=lambda x: x.value)";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });

    it("should detect callback in reduce(lambda acc, x: ..., items, init)", () => {
      const code = "result = reduce(lambda acc, x: acc + x, items, 0)";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });
  });

  describe("method chaining patterns", () => {
    it("should detect callback in df.apply(lambda x: ...)", () => {
      const code = "result = df.apply(lambda x: x * 2)";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });

    it("should detect callback in df.groupby().apply(lambda...)", () => {
      const code = "result = df.groupby('col').apply(lambda rows: list(rows))";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });
  });

  describe("dictionary unpacking pattern (key false positive pattern)", () => {
    it("should detect callback in df.assign(**{key: lambda...})", () => {
      const code = "result = df.assign(**{_COL: lambda df: df[_COL].apply(str)})";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
      // receiver_location should point to df.assign(...) call
      expect(result.receiver_location?.start_column).toBe(10); // 'df.assign' starts at column 10
    });

    it("should detect callback in func(**{key: lambda...}) with variable key", () => {
      const code = "_END_DATE_COL = 'end_date'\nresult = df.assign(**{_END_DATE_COL: lambda df: df.apply(str)})";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });
  });

  describe("factory function pattern", () => {
    it("should detect callback in defaultdict(lambda: ...)", () => {
      const code = "dd = defaultdict(lambda: defaultdict(int))";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(true);
      expect(result.receiver_location).not.toBeNull();
    });

    it("should detect callback in Counter with lambda factory", () => {
      const code = "result = defaultdict(lambda: [])";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(true);
    });
  });

  describe("negative cases", () => {
    it("should NOT detect callback for standalone lambda assignment", () => {
      const code = "fn = lambda x: x * 2";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(false);
      expect(result.receiver_location).toBeNull();
    });

    it("should NOT detect callback for lambda in list literal (not in call)", () => {
      const code = "handlers = [lambda x: x, lambda y: y * 2]";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(false);
    });

    it("should NOT detect callback for lambda in dict literal (not in call)", () => {
      const code = "config = {'handler': lambda x: x}";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(false);
    });

    it("should NOT detect callback for lambda in tuple literal", () => {
      const code = "pair = (lambda x: x, lambda y: y)";
      const root = parse_python(code);
      const lambda_node = find_lambda(root);
      expect(lambda_node).not.toBeNull();

      const result = detect_callback_context(lambda_node!, file_path);

      expect(result.is_callback).toBe(false);
    });
  });
});
