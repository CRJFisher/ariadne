/**
 * Comprehensive Semantic Index Tests - Python
 */

// @ts-nocheck - Legacy test using deprecated APIs, needs migration to builder pattern

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { Language, FilePath } from "@ariadnejs/types";
import { build_semantic_index } from "./semantic_index";
import { query_tree_and_parse_captures } from "./parse_and_query_code/parse_and_query_code";
import {
  SemanticEntity,
  SemanticCategory,
} from "./parse_and_query_code/capture_types";
import { build_scope_tree } from "./scope_tree";

const FIXTURES_DIR = join(__dirname, "fixtures", "python");

describe("Semantic Index - Python Comprehensive", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  // ============================================================================
  // QUERY CAPTURE TESTS
  // ============================================================================

  describe("query_tree_and_parse_captures", () => {
    it("should capture all Python scopes correctly", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "scope_hierarchy.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "scope_hierarchy.py" as FilePath;
      const result = query_tree_and_parse_captures("python", tree, file_path);

      // Check different scope types
      const scope_entities = result.scopes.map((s) => s.entity);
      expect(scope_entities).toContain(SemanticEntity.MODULE);
      expect(scope_entities).toContain(SemanticEntity.FUNCTION);
      expect(scope_entities).toContain(SemanticEntity.CLASS);
      expect(scope_entities).toContain(SemanticEntity.BLOCK);

      // Verify scope count is reasonable
      expect(result.scopes.length).toBeGreaterThan(10);
    });

    it("should capture all Python definitions correctly", () => {
      const code = readFileSync(join(FIXTURES_DIR, "classes.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "classes.py" as FilePath;
      const result = query_tree_and_parse_captures("python", tree, file_path);

      // Check definition types
      const def_entities = result.definitions.map((d) => d.entity);
      expect(def_entities).toContain(SemanticEntity.FUNCTION);
      expect(def_entities).toContain(SemanticEntity.CLASS);
      expect(def_entities).toContain(SemanticEntity.METHOD);
      expect(def_entities).toContain(SemanticEntity.VARIABLE);
      expect(def_entities).toContain(SemanticEntity.PARAMETER);

      // Verify definition count
      expect(result.definitions.length).toBeGreaterThan(20);
    });

    it("should capture Python imports correctly", () => {
      const code = readFileSync(join(FIXTURES_DIR, "imports.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "imports.py" as FilePath;
      const result = query_tree_and_parse_captures("python", tree, file_path);

      // Check imports exist
      expect(result.imports.length).toBeGreaterThan(5);

      // Check for specific import patterns
      const import_texts = result.imports.map((i) => i.symbol_name);
      expect(import_texts).toContain("os");
      expect(import_texts).toContain("sys");
      expect(import_texts).toContain("json");
    });

    it("should capture Python references correctly", () => {
      const code = readFileSync(join(FIXTURES_DIR, "functions.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "functions.py" as FilePath;
      const result = query_tree_and_parse_captures("python", tree, file_path);

      // Check reference types
      const ref_entities = result.references.map((r) => r.entity);
      expect(ref_entities).toContain(SemanticEntity.CALL);

      // Verify reference count is reasonable
      expect(result.references.length).toBeGreaterThan(10);
    });
  });

  // ============================================================================
  // DECORATOR TESTS
  // ============================================================================

  describe("Decorators", () => {
    it("should parse function decorators", () => {
      const code = readFileSync(join(FIXTURES_DIR, "decorators.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "decorators.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      // Check for decorator references
      const decorator_refs = parsed.references.filter(
        (ref) =>
          ref.symbol_name === "simple_decorator" || ref.symbol_name === "repeat"
      );
      expect(decorator_refs.length).toBeGreaterThan(0);
    });

    it("should parse property decorators", () => {
      const code = readFileSync(join(FIXTURES_DIR, "decorators.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "decorators.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check property definitions
      const property_symbols = Array.from(result.symbols.values()).filter(
        (def) => def.kind === "method"
      );

      expect(property_symbols.length).toBeGreaterThan(0);
      const property_names = property_symbols.map((s) => s.name);
      expect(property_names).toContain("value");
      expect(property_names).toContain("read_only");
    });

    it("should parse method decorators (staticmethod, classmethod)", () => {
      const code = readFileSync(join(FIXTURES_DIR, "decorators.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "decorators.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check static methods
      const static_methods = Array.from(result.symbols.values()).filter(
        (def) => def.kind === "method" && def.is_static
      );
      expect(static_methods.length).toBeGreaterThan(0);

      const static_method_names = static_methods.map((s) => s.name);
      expect(static_method_names).toContain("static_method");
    });

    it("should parse dataclass decorators", () => {
      const code = readFileSync(join(FIXTURES_DIR, "decorators.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "decorators.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check dataclass definitions
      const dataclass_symbols = Array.from(result.symbols.values()).filter(
        (def) =>
          def.kind === "class" &&
          (def.name === "DataClassExample" || def.name === "FrozenDataClass")
      );
      expect(dataclass_symbols.length).toBeGreaterThanOrEqual(1);
    });

    it("should parse multiple decorators on same function", () => {
      const code = readFileSync(join(FIXTURES_DIR, "decorators.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "decorators.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      // Check for functions with multiple decorators
      const multi_decorated = parsed.definitions.filter(
        (def) => def.symbol_name === "multi_decorated_function"
      );
      expect(multi_decorated.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TYPE HINTS TESTS
  // ============================================================================

  describe("Type Hints", () => {
    it("should capture basic type annotations", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_type_hints.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "comprehensive_type_hints.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      // Check for type annotations
      const type_annotations = parsed.types;
      expect(type_annotations.length).toBeGreaterThan(10);
    });

    it("should parse function parameter type hints", () => {
      const code = `
def typed_function(x: int, y: str, z: list[int]) -> dict[str, any]:
    return {"x": x, "y": y, "z": z}
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      // Check parameter definitions with types
      const typed_params = parsed.definitions.filter(
        (def) => def.entity === SemanticEntity.PARAMETER
      );
      expect(typed_params.length).toBeGreaterThanOrEqual(3);

      const param_names = typed_params.map((p) => p.symbol_name);
      expect(param_names).toContain("x");
      expect(param_names).toContain("y");
      expect(param_names).toContain("z");
    });

    it("should parse variable type annotations", () => {
      const code = `
x: int = 42
y: str = "hello"
z: list[int] = [1, 2, 3]
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      // Check typed variable definitions
      const typed_vars = parsed.definitions.filter(
        (def) => def.entity === SemanticEntity.VARIABLE
      );
      expect(typed_vars.length).toBeGreaterThanOrEqual(3);
    });

    it("should parse generic type annotations", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_type_hints.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "comprehensive_type_hints.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check for generic classes
      const generic_classes = Array.from(result.symbols.values()).filter(
        (def) => def.kind === "class" && def.name.includes("Generic")
      );
      expect(generic_classes.length).toBeGreaterThan(0);
    });

    it("should parse Protocol definitions", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_type_hints.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "comprehensive_type_hints.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check for Protocol classes
      const protocol_classes = Array.from(result.symbols.values()).filter(
        (def) =>
          def.kind === "class" &&
          (def.name === "Drawable" || def.name === "Comparable")
      );
      expect(protocol_classes.length).toBeGreaterThan(0);
    });

    it("should parse TypedDict definitions", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_type_hints.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "comprehensive_type_hints.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check for TypedDict classes
      const typed_dict_classes = Array.from(result.symbols.values()).filter(
        (def) => def.kind === "class" && def.name.includes("Dict")
      );
      expect(typed_dict_classes.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // EXPORT TESTS (__all__ and implicit)
  // ============================================================================

  describe("Exports", () => {
    it("should handle implicit exports (all top-level definitions)", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "implicit_exports.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "implicit_exports.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check that all top-level symbols have exports
      const export_names = result.exports.map((e) => e.symbol_name).sort();

      // Should include both public and private symbols (Python's implicit model)
      expect(export_names).toContain("public_function");
      expect(export_names).toContain("_private_function");
      expect(export_names).toContain("PublicClass");
      expect(export_names).toContain("_PrivateClass");
      expect(export_names).toContain("PUBLIC_CONSTANT");
      expect(export_names).toContain("_private_variable");
      expect(export_names).toContain("__version__");
      expect(export_names).toContain("__all__");
    });

    it("should parse __all__ explicit exports and extract contents", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_exports.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "comprehensive_exports.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      // Check for __all__ definition
      const all_exports = parsed.exports.filter(
        (exp) => exp.symbol_name === "__all__"
      );
      expect(all_exports.length).toBeGreaterThan(0);

      // Check for __all__ list capture with contents
      const all_list_exports = parsed.exports.filter(
        (exp) =>
          exp.context?.all_contents && Array.isArray(exp.context.all_contents)
      );
      expect(all_list_exports.length).toBeGreaterThan(0);

      // Verify the extracted contents
      const all_contents = all_list_exports[0]?.context?.all_contents;
      expect(all_contents).toBeDefined();
      expect(all_contents).toContain("public_function");
      expect(all_contents).toContain("another_public_function");
      expect(all_contents).toContain("PublicClass");
      expect(all_contents).toContain("UtilityClass");
      expect(all_contents).toContain("PUBLIC_CONSTANT");
      expect(all_contents).toContain("public_variable");
      expect(all_contents).toContain("default_dict");
      expect(all_contents).toContain("ListType");

      // Verify that __all__ contents length matches expected
      expect(all_contents?.length).toBe(8);
    });

    it("should handle complex __all__ patterns", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_exports.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "comprehensive_exports.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check that exports include items from __all__
      const export_names = result.exports.map((e) => e.symbol_name);
      expect(export_names).toContain("public_function");
      expect(export_names).toContain("another_public_function");
      expect(export_names).toContain("PublicClass");
      expect(export_names).toContain("UtilityClass");
    });

    it("should identify private symbols by naming convention", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_exports.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "comprehensive_exports.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check for private symbols
      const all_symbols = Array.from(result.symbols.values());
      const private_symbols = all_symbols.filter(
        (s) => s.name.startsWith("_") && !s.name.startsWith("__")
      );
      const magic_symbols = all_symbols.filter(
        (s) => s.name.startsWith("__") && s.name.endsWith("__")
      );

      expect(private_symbols.length).toBeGreaterThan(0);
      expect(magic_symbols.length).toBeGreaterThan(0);
    });

    it("should handle re-exports from other modules", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_exports.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "comprehensive_exports.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check for re-exported items
      const imports = result.imports;
      const import_names = imports.map((i) =>
        i.kind === "named"
          ? i.imports[0]?.name
          : i.kind === "namespace"
          ? i.namespace_name
          : i.kind === "default"
          ? i.name
          : ""
      );
      expect(import_names).toContain("defaultdict");
      expect(import_names).toContain("Counter");
    });
  });

  // ============================================================================
  // CLASSES AND INHERITANCE TESTS
  // ============================================================================

  describe("Classes and Inheritance", () => {
    it("should parse class definitions with inheritance", () => {
      const code = readFileSync(join(FIXTURES_DIR, "classes.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "classes.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check class definitions
      const class_symbols = Array.from(result.symbols.values()).filter(
        (def) => def.kind === "class"
      );

      expect(class_symbols.map((s) => s.name)).toContain("SimpleClass");
      expect(class_symbols.map((s) => s.name)).toContain("BaseClass");
      expect(class_symbols.map((s) => s.name)).toContain("DerivedClass");
      expect(class_symbols.map((s) => s.name)).toContain("MultipleInheritance");
    });

    it("should parse method definitions", () => {
      const code = readFileSync(join(FIXTURES_DIR, "classes.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "classes.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check method definitions (including constructors which are methods in Python)
      const method_symbols = Array.from(result.symbols.values()).filter(
        (def) => def.kind === "method" || def.kind === "constructor"
      );

      const method_names = method_symbols.map((s) => s.name);
      expect(method_names).toContain("__init__");
      expect(method_names).toContain("get_value");
      expect(method_names).toContain("base_method");
    });

    it("should parse magic methods", () => {
      const code = readFileSync(join(FIXTURES_DIR, "classes.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "classes.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      const magic_methods = Array.from(result.symbols.values()).filter(
        (def) =>
          (def.kind === "method" || def.kind === "constructor") &&
          def.name.startsWith("__") &&
          def.name.endsWith("__")
      );

      const magic_names = magic_methods.map((m) => m.name);
      expect(magic_names).toContain("__init__");
      expect(magic_names).toContain("__str__");
      expect(magic_names).toContain("__repr__");
    });

    it("should handle nested classes", () => {
      const code = readFileSync(join(FIXTURES_DIR, "classes.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "classes.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check for nested class
      const nested_classes = Array.from(result.symbols.values()).filter(
        (def) => def.kind === "class" && def.name === "Inner"
      );
      expect(nested_classes.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // FUNCTION TESTS
  // ============================================================================

  describe("Functions", () => {
    it("should parse function definitions", () => {
      const code = readFileSync(join(FIXTURES_DIR, "functions.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "functions.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      const function_symbols = Array.from(result.symbols.values()).filter(
        (def) => def.kind === "function"
      );

      const function_names = function_symbols.map((s) => s.name);
      expect(function_names).toContain("simple_function");
      expect(function_names).toContain("function_with_params");
      expect(function_names).toContain("function_with_defaults");
    });

    it("should parse lambda functions", () => {
      const code = readFileSync(join(FIXTURES_DIR, "functions.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "functions.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      const lambda_symbols = Array.from(result.symbols.values()).filter(
        (def) => def.kind === "variable" && def.name.includes("lambda")
      );

      expect(lambda_symbols.length).toBeGreaterThan(0);
      const lambda_names = lambda_symbols.map((s) => s.name);
      expect(lambda_names).toContain("simple_lambda");
    });

    it("should parse async functions", () => {
      const code = readFileSync(join(FIXTURES_DIR, "functions.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "functions.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      // Check for async function definitions
      const async_functions = parsed.definitions.filter(
        (def) =>
          def.entity === SemanticEntity.FUNCTION &&
          def.symbol_name.includes("async")
      );
      expect(async_functions.length).toBeGreaterThan(0);
    });

    it("should parse generator functions", () => {
      const code = readFileSync(join(FIXTURES_DIR, "functions.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "functions.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check for generator functions
      const generator_functions = Array.from(result.symbols.values()).filter(
        (def) => def.kind === "function" && def.name.includes("generator")
      );
      expect(generator_functions.length).toBeGreaterThan(0);
    });

    it("should parse nested functions", () => {
      const code = readFileSync(join(FIXTURES_DIR, "functions.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "functions.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      const function_symbols = Array.from(result.symbols.values()).filter(
        (def) => def.kind === "function"
      );

      const function_names = function_symbols.map((s) => s.name);
      expect(function_names).toContain("outer_function");
      expect(function_names).toContain("inner_function");
    });
  });

  // ============================================================================
  // IMPORT TESTS
  // ============================================================================

  describe("Imports", () => {
    it("should parse basic import statements", () => {
      const code = readFileSync(join(FIXTURES_DIR, "imports.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "imports.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      expect(result.imports.length).toBeGreaterThan(0);

      const import_names = result.imports.map((imp) =>
        imp.kind === "named"
          ? imp.imports[0]?.name
          : imp.kind === "namespace"
          ? imp.namespace_name
          : imp.kind === "default"
          ? imp.name
          : ""
      );
      expect(import_names).toContain("os");
      expect(import_names).toContain("sys");
      expect(import_names).toContain("json");
    });

    it("should parse from imports", () => {
      const code = readFileSync(join(FIXTURES_DIR, "imports.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "imports.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      const from_imports = result.imports.filter(
        (imp) => imp.kind === "named" && imp.source
      );

      expect(from_imports.length).toBeGreaterThan(0);
      const from_import_names = from_imports.flatMap((imp) => {
        if (imp.kind === "named") {
          return imp.imports.map((importItem) => importItem.name);
        } else if (imp.kind === "default") {
          return [imp.name];
        } else {
          return [];
        }
      });
      expect(from_import_names).toContain("defaultdict");
      expect(from_import_names).toContain("Counter");
    });

    it("should parse aliased imports", () => {
      const code = readFileSync(join(FIXTURES_DIR, "imports.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "imports.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      const aliased_imports = result.imports.filter(
        (imp) =>
          imp.kind === "named" &&
          imp.imports.some((importItem) => importItem.alias)
      );

      expect(aliased_imports.length).toBeGreaterThan(0);
      const aliases = aliased_imports.flatMap((imp) => {
        if (imp.kind === "named") {
          return imp.imports
            .filter((importItem) => importItem.alias)
            .map((importItem) => importItem.alias!);
        } else {
          return [];
        }
      });
      expect(aliases).toContain("np");
      expect(aliases).toContain("pd");
      expect(aliases).toContain("dt");
    });

    it("should parse wildcard imports", () => {
      const code = `from math import *`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      // Check for wildcard import
      const wildcard_imports = parsed.imports.filter(
        (imp) =>
          imp.symbol_name === "*" || imp.entity === SemanticEntity.NAMESPACE
      );
      expect(wildcard_imports.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SCOPE HIERARCHY TESTS
  // ============================================================================

  describe("Scope Hierarchy", () => {
    it("should build correct scope tree", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "scope_hierarchy.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "scope_hierarchy.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      const { root_scope, scopes } = build_scope_tree(
        parsed.scopes,
        tree,
        file_path,
        "python"
      );

      // Check root scope
      expect(root_scope.type).toBe("module");

      // Check nested scopes exist
      expect(scopes.size).toBeGreaterThan(0);
    });

    it("should handle comprehension scopes", () => {
      const code = `[x for x in range(10)]`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      const { scopes } = build_scope_tree(
        parsed.scopes,
        tree,
        file_path,
        "python"
      );

      // Check comprehension scopes
      const comp_scopes = Array.from(scopes.values()).filter(
        (scope) => scope.type === "block"
      );
      expect(comp_scopes.length).toBeGreaterThan(0);
    });

    it("should handle exception scopes", () => {
      const code = `
try:
    pass
except Exception as e:
    pass
finally:
    pass
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      const { scopes } = build_scope_tree(
        parsed.scopes,
        tree,
        file_path,
        "python"
      );

      // Check exception scopes
      const try_scopes = Array.from(scopes.values()).filter(
        (scope) => scope.type === "block"
      );
      expect(try_scopes.length).toBeGreaterThan(0);
    });

    it("should handle with statement scopes", () => {
      const code = `
with open("file") as f:
    pass
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      const { scopes } = build_scope_tree(
        parsed.scopes,
        tree,
        file_path,
        "python"
      );

      // Check with scopes
      const with_scopes = Array.from(scopes.values()).filter(
        (scope) => scope.type === "block"
      );
      expect(with_scopes.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SPECIAL PYTHON FEATURES
  // ============================================================================

  describe("Special Python Features", () => {
    it("should handle super() calls", () => {
      const code = readFileSync(join(FIXTURES_DIR, "classes.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "classes.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      // Check for super calls
      const super_calls = parsed.references.filter(
        (ref) =>
          ref.entity === SemanticEntity.SUPER || ref.symbol_name === "super"
      );

      expect(super_calls.length).toBeGreaterThan(0);
    });

    it("should handle self and cls references", () => {
      const code = readFileSync(join(FIXTURES_DIR, "classes.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "classes.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      // Check for self references
      const self_refs = parsed.references.filter(
        (ref) => ref.symbol_name === "self"
      );
      expect(self_refs.length).toBeGreaterThan(0);

      // Check for cls references
      const cls_refs = parsed.references.filter(
        (ref) => ref.symbol_name === "cls"
      );
      expect(cls_refs.length).toBeGreaterThan(0);
    });

    it("should handle method calls with receivers", () => {
      const code = `
obj.method()
obj.prop.method()
obj.method().chain()
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check method calls
      const method_calls = result.references.calls.filter(
        (call) => call.call_type === "method"
      );

      expect(method_calls).toBeDefined();
      expect(method_calls.length).toBeGreaterThan(0);
    });

    it("should handle assignment and type flow", () => {
      const code = `
x = 42
y = x
z = y + 1
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check type flows
      const type_flows = result.references.type_flows;
      expect(type_flows).toBeDefined();
      if (type_flows) {
        expect(type_flows.assignments.length).toBeGreaterThan(0);
      }
    });

    it("should handle return statements", () => {
      const code = readFileSync(join(FIXTURES_DIR, "functions.py"), "utf8");
      const tree = parser.parse(code);
      const file_path = "functions.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Check return references
      const returns = result.references.returns;
      expect(returns).toBeDefined();
      expect(returns.length).toBeGreaterThan(0);
    });

    it("should handle yield expressions", () => {
      const code = `
def generator():
    yield 1
    yield 2
    yield 3
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed = query_tree_and_parse_captures("python", tree, file_path);

      // Check for yield expressions - look for ref.yield captures or yield in text
      const yields = parsed.references.filter(
        (ref) =>
          ref.symbol_name.includes("yield") ||
          ref.entity === SemanticEntity.VARIABLE
      );
      // Alternative: check if any references contain yield-related content
      const hasYieldContent = parsed.references.some(
        (ref) =>
          ref.symbol_name === "1" ||
          ref.symbol_name === "2" ||
          ref.symbol_name === "3"
      );
      expect(yields.length > 0 || hasYieldContent).toBe(true);
    });
  });

  // ============================================================================
  // COMPREHENSIVE CAPTURE COVERAGE TESTS
  // ============================================================================

  describe("Comprehensive Capture Coverage", () => {
    it("should capture augmented assignments", () => {
      const code = `
x = 10
x += 5  # augmented assignment
y *= 2
z //= 3
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures(
        "python",
        tree,
        "test.py" as FilePath
      );

      const augmented = parsed.assignments.filter(
        (a) => a.entity === SemanticEntity.VARIABLE
      );
      expect(augmented.length).toBeGreaterThan(0);
    });

    it("should capture multiple and tuple assignments", () => {
      const code = `
# Multiple assignment
x, y, z = 1, 2, 3

# Tuple unpacking
(a, b) = (4, 5)

# List unpacking
[c, d] = [6, 7]
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures(
        "python",
        tree,
        "test.py" as FilePath
      );

      const multipleAssigns = parsed.definitions.filter(
        (d) =>
          d.symbol_name === "x" ||
          d.symbol_name === "y" ||
          d.symbol_name === "z"
      );
      expect(multipleAssigns.length).toBe(3);

      const tupleAssigns = parsed.definitions.filter(
        (d) => d.symbol_name === "a" || d.symbol_name === "b"
      );
      expect(tupleAssigns.length).toBe(2);
    });

    it("should capture comprehension variables", () => {
      const code = `
# List comprehension
squares = [x**2 for x in range(10)]

# Dict comprehension
dict_comp = {k: v for k, v in zip(keys, values)}

# Set comprehension
unique = {item for item in items if item}

# Generator expression
gen = (n for n in numbers if n > 0)
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures(
        "python",
        tree,
        "test.py" as FilePath
      );

      const compVars = parsed.definitions.filter(
        (d) => d.entity === SemanticEntity.VARIABLE
      );
      const compVarNames = compVars.map((v) => v.symbol_name);
      expect(compVarNames).toContain("x");
      expect(compVarNames).toContain("k");
      expect(compVarNames).toContain("v");
    });

    it("should capture exception variables", () => {
      const code = `
try:
    risky_operation()
except ValueError as e:
    print(e)
except (TypeError, KeyError) as err:
    handle_error(err)
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures(
        "python",
        tree,
        "test.py" as FilePath
      );

      const exceptVars = parsed.definitions.filter(
        (d) => d.entity === SemanticEntity.VARIABLE
      );
      const exceptVarNames = exceptVars.map((v) => v.symbol_name);
      expect(exceptVarNames).toContain("e");
      expect(exceptVarNames).toContain("err");
    });

    it("should capture with statement variables", () => {
      const code = `
with open('file.txt') as f:
    content = f.read()

with contextlib.suppress(Exception) as suppressed:
    risky_operation()
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures(
        "python",
        tree,
        "test.py" as FilePath
      );

      const withVars = parsed.definitions.filter(
        (d) => d.entity === SemanticEntity.VARIABLE
      );
      const withVarNames = withVars.map((v) => v.symbol_name);
      expect(withVarNames).toContain("f");
      expect(withVarNames).toContain("suppressed");
    });

    it("should capture match-case patterns (Python 3.10+)", () => {
      const code = `
match value:
    case 0:
        print("zero")
    case [x, y]:
        print(f"list: {x}, {y}")
    case Point(x=px, y=py):
        print(f"point: {px}, {py}")
    case _:
        print("default")
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures(
        "python",
        tree,
        "test.py" as FilePath
      );

      const matchScopes = parsed.scopes.filter(
        (s) => s.entity === SemanticEntity.BLOCK
      );
      expect(matchScopes.length).toBeGreaterThan(0);
    });

    it("should capture yield expressions", () => {
      const code = `
def generator():
    yield 1
    yield 2
    value = yield 3
    yield from other_generator()
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures(
        "python",
        tree,
        "test.py" as FilePath
      );

      const yields = parsed.references.filter(
        (r) => r.symbol_name === "yield" || r.symbol_name === "yield from"
      );
      expect(yields.length).toBeGreaterThan(0);
    });

    it("should capture assert statements", () => {
      const code = `
assert x > 0, "x must be positive"
assert isinstance(obj, MyClass)
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures(
        "python",
        tree,
        "test.py" as FilePath
      );

      const asserts = parsed.references.filter(
        (r) => r.symbol_name === "assert"
      );
      expect(asserts.length).toBeGreaterThan(0);
    });

    it("should capture delete statements", () => {
      const code = `
del x
del obj.attr
del items[0]
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures(
        "python",
        tree,
        "test.py" as FilePath
      );

      const deletes = parsed.references.filter(
        (r) =>
          r.symbol_name === "x" ||
          r.symbol_name === "obj" ||
          r.symbol_name === "items"
      );
      expect(deletes.length).toBeGreaterThan(0);
    });

    it("should capture subscript access", () => {
      const code = `
value = items[0]
matrix[i][j] = 10
data['key'] = 'value'
slice_val = array[1:10:2]
`;
      const tree = parser.parse(code);
      const parsed = query_tree_and_parse_captures(
        "python",
        tree,
        "test.py" as FilePath
      );

      const subscripts = parsed.references.filter(
        (r) =>
          r.entity === SemanticEntity.MEMBER_ACCESS ||
          r.symbol_name === "items" ||
          r.symbol_name === "matrix"
      );
      expect(subscripts.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe("Integration", () => {
    it("should handle complex Python file with all features", () => {
      const code = readFileSync(
        join(FIXTURES_DIR, "comprehensive_type_hints.py"),
        "utf8"
      );
      const tree = parser.parse(code);
      const file_path = "comprehensive_type_hints.py" as FilePath;
      const result = build_semantic_index(file_path, tree, "python");

      // Verify we have symbols, imports, exports, and references
      expect(result.symbols.size).toBeGreaterThan(10);
      expect(result.imports.length).toBeGreaterThan(5);
      expect(result.exports.length).toBeGreaterThan(5);
      expect(result.references.calls.length).toBeGreaterThan(0);
    });

    it("should maintain consistency across all fixtures", () => {
      const fixtures = [
        "classes.py",
        "functions.py",
        "decorators.py",
        "comprehensive_type_hints.py",
        "comprehensive_exports.py",
        "imports.py",
        "scope_hierarchy.py",
      ];

      for (const fixture of fixtures) {
        const code = readFileSync(join(FIXTURES_DIR, fixture), "utf8");
        const tree = parser.parse(code);
        const file_path = fixture as FilePath;

        // Should not throw errors
        expect(() => {
          const result = query_tree_and_parse_captures(
            "python",
            tree,
            file_path
          );
          expect(result).toBeDefined();
          expect(result.scopes).toBeDefined();
          expect(result.definitions).toBeDefined();
          expect(result.references).toBeDefined();
        }).not.toThrow();
      }
    });
  });
});
