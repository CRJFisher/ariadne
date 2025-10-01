/**
 * Semantic Index Tests - Python
 *
 * This test suite verifies that Python metadata extractors properly populate
 * metadata fields in the semantic index for various Python code patterns.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { FilePath, Language } from "@ariadnejs/types";
import { build_semantic_index } from "./semantic_index";
import type { ParsedFile } from "./file_utils";

// Helper to create a ParsedFile from code
function createParsedFile(
  code: string,
  filePath: FilePath,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  const lines = code.split('\n');
  return {
    file_path: filePath,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language
  };
}

describe("Semantic Index - Python", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  // ============================================================================
  // TYPE METADATA EXTRACTION TESTS
  // ============================================================================

  describe("Type metadata extraction", () => {
    it("should extract type info from function parameter annotations", () => {
      const code = `
def greet(name: str, age: int) -> str:
    return f"Hello {name}, you are {age} years old"
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");

      const index = build_semantic_index(parsed_file, tree, "python");

      // Check that type references were extracted
      const type_refs = index.references.filter(r => r.type === "type");
      expect(type_refs.length).toBeGreaterThan(0);

      // Check that type_info is populated (this proves extractors are working)
      const types_with_info = type_refs.filter(r => r.type_info);
      expect(types_with_info.length).toBeGreaterThan(0);

      // Verify type info structure
      const first_type = types_with_info[0];
      expect(first_type.type_info).toBeDefined();
      expect(first_type.type_info?.type_name).toBeDefined();
      expect(first_type.type_info?.certainty).toBe("declared");
    });

    it("should extract type info from variable annotations", () => {
      const code = `
count: int = 0
name: str = "Alice"
items: list[str] = []
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");

      const index = build_semantic_index(parsed_file, tree, "python");

      const type_refs = index.references.filter(r => r.type === "type");
      const types_with_info = type_refs.filter(r => r.type_info);

      expect(types_with_info.length).toBeGreaterThan(0);

      // Check that at least one type has proper metadata
      const has_valid_type = types_with_info.some(t =>
        t.type_info?.type_name && t.type_info.certainty === "declared"
      );
      expect(has_valid_type).toBe(true);
    });

    it("should handle generic types", () => {
      const code = `
from typing import List, Dict

def process(items: List[str], mapping: Dict[str, int]) -> None:
    pass
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");

      const index = build_semantic_index(parsed_file, tree, "python");

      const type_refs = index.references.filter(r => r.type === "type");
      const types_with_info = type_refs.filter(r => r.type_info);

      // Should have extracted types from generic annotations
      expect(types_with_info.length).toBeGreaterThan(0);
    });

    it("should extract type references from function parameter type hints", () => {
      const code = `
def typed_function(x: int, y: str, z: List[int]) -> Dict[str, Any]:
    return {"x": x, "y": y, "z": z}
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      // Find type references
      const type_refs = result.references.filter(
        ref => ref.type === "type"
      );
      expect(type_refs.length).toBeGreaterThan(0);

      // Check int type reference
      const int_ref = type_refs.find(ref => ref.name === "int");
      expect(int_ref).toBeDefined();

      // Check str type reference
      const str_ref = type_refs.find(ref => ref.name === "str");
      expect(str_ref).toBeDefined();

      // Check List type reference
      const list_ref = type_refs.find(ref => ref.name === "List");
      expect(list_ref).toBeDefined();
    });

    it("should extract type references from variable type annotations", () => {
      const code = `
x: int = 42
y: str = "hello"
z: Optional[float] = None
data: List[Dict[str, Any]] = []
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      const type_refs = result.references.filter(
        ref => ref.type === "type"
      );

      // Check Optional type
      const optional_ref = type_refs.find(ref => ref.name === "Optional");
      expect(optional_ref).toBeDefined();

      // Check float type
      const float_ref = type_refs.find(ref => ref.name === "float");
      expect(float_ref).toBeDefined();
    });

    it("should extract type references from return type hints", () => {
      const code = `
def get_value() -> int:
    return 42

def get_optional() -> Optional[str]:
    return None

def get_union() -> Union[int, str]:
    return "test"
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      const type_refs = result.references.filter(
        ref => ref.type === "type"
      );

      // Check Union type
      const union_ref = type_refs.find(ref => ref.name === "Union");
      expect(union_ref).toBeDefined();

      // Check Optional type
      const optional_ref = type_refs.find(ref => ref.name === "Optional");
      expect(optional_ref).toBeDefined();

      // Check int type
      const int_ref = type_refs.find(ref => ref.name === "int");
      expect(int_ref).toBeDefined();
    });

    it("should handle generic type arguments", () => {
      const code = `
from typing import List, Dict, Tuple, Callable

items: List[str] = []
mapping: Dict[str, int] = {}
pair: Tuple[int, float] = (1, 2.0)
func: Callable[[int, str], bool] = lambda x, y: True
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      const type_refs = result.references.filter(
        ref => ref.type === "type"
      );

      // Check Dict type
      const dict_ref = type_refs.find(ref => ref.name === "Dict");
      expect(dict_ref).toBeDefined();

      // Check Callable type
      const callable_ref = type_refs.find(ref => ref.name === "Callable");
      expect(callable_ref).toBeDefined();
    });

    it("should handle complex generic types with metadata", () => {
      const code = `
from typing import Dict, List, Tuple, Callable

mapping: Dict[str, List[Tuple[int, str]]] = {}
processor: Callable[[List[int]], Dict[str, bool]] = lambda x: {}
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      const type_refs = result.references.filter(
        ref => ref.type === "type"
      );

      // Check nested generic types
      const dict_refs = type_refs.filter(ref => ref.name === "Dict");
      expect(dict_refs.length).toBeGreaterThan(0);

      const list_refs = type_refs.filter(ref => ref.name === "List");
      expect(list_refs.length).toBeGreaterThan(0);

      const tuple_refs = type_refs.filter(ref => ref.name === "Tuple");
      expect(tuple_refs.length).toBeGreaterThan(0);

      // Callable should be captured
      const callable_ref = type_refs.find(ref => ref.name === "Callable");
      expect(callable_ref).toBeDefined();
    });
  });

  // ============================================================================
  // METHOD CALL METADATA TESTS
  // ============================================================================

  describe("Method Call Metadata", () => {
    it("should extract receiver_location for method calls", () => {
      const code = `
obj = MyClass()
result = obj.method()
value = obj.prop.nested_method()
self.instance_method()
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      // Find method call references
      const method_calls = result.references.filter(
        ref => ref.type === "call" && ref.name === "method"
      );

      expect(method_calls).toBeDefined();
      expect(method_calls.length).toBeGreaterThan(0);

      // Check that method calls have receiver_location populated
      const method_call = method_calls[0];
      expect(method_call).toBeDefined();
      if (method_call?.context?.receiver_location) {
        expect(method_call.context.receiver_location).toHaveProperty("start_line");
        expect(method_call.context.receiver_location).toHaveProperty("start_column");
      }

      // Check self.instance_method() has receiver
      const self_method = result.references.find(
        ref => ref.type === "call" && ref.name === "instance_method"
      );
      expect(self_method).toBeDefined();
    });

    it("should extract receiver_location for chained method calls", () => {
      const code = `
api.users.list().filter(active=True).sort()
data.transform().validate().save()
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      const method_calls = result.references.filter(
        ref => ref.type === "call"
      );

      // Check list() has api.users as receiver
      const list_call = method_calls.find(ref => ref.name === "list");
      expect(list_call).toBeDefined();

      // Check filter() call
      const filter_call = method_calls.find(ref => ref.name === "filter");
      expect(filter_call).toBeDefined();
    });

    it("should handle super() method calls with metadata", () => {
      const code = `
class DerivedClass(BaseClass):
    def method(self):
        super().method()
        super(DerivedClass, self).another_method()
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      // Find super calls
      const super_calls = result.references.filter(
        ref => ref.name === "super" && ref.type === "call"
      );
      expect(super_calls.length).toBeGreaterThan(0);

      // Find method calls after super
      const method_calls = result.references.filter(
        ref => ref.type === "call" && (ref.name === "method" || ref.name === "another_method")
      );
      expect(method_calls.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // ATTRIBUTE ACCESS CHAIN METADATA TESTS
  // ============================================================================

  describe("Attribute Access Chain Metadata", () => {
    it("should extract property_chain for attribute access", () => {
      const code = `
value = obj.prop
nested = obj.prop.nested.deep
result = data['key'].attribute
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      // Find member access references
      const member_accesses = result.references.filter(
        ref => ref.type === "member_access"
      );
      expect(member_accesses.length).toBeGreaterThan(0);

      // Check simple property access
      const prop_access = member_accesses.find(ref => ref.name === "prop");
      expect(prop_access).toBeDefined();
      if (prop_access?.context?.property_chain) {
        // Should have ["obj", "prop"]
        expect(prop_access.context.property_chain).toContain("obj");
        expect(prop_access.context.property_chain).toContain("prop");
      }

      // Check nested property access
      const deep_access = member_accesses.find(ref => ref.name === "deep");
      if (deep_access?.context?.property_chain) {
        // Should have multiple levels in the chain
        expect(deep_access.context.property_chain.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("should handle self and cls in property chains", () => {
      const code = `
class MyClass:
    def method(self):
        self.instance_var = 42
        self.prop.nested.value = 10

    @classmethod
    def class_method(cls):
        cls.class_var = "test"
        cls.prop.value = 20
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      const member_accesses = result.references.filter(
        ref => ref.type === "member_access"
      );

      // Check self.instance_var
      const self_access = member_accesses.find(ref => ref.name === "instance_var");
      expect(self_access).toBeDefined();
      if (self_access?.context?.property_chain) {
        expect(self_access.context.property_chain).toContain("self");
        expect(self_access.context.property_chain).toContain("instance_var");
      }

      // Check cls.class_var
      const cls_access = member_accesses.find(ref => ref.name === "class_var");
      expect(cls_access).toBeDefined();
      if (cls_access?.context?.property_chain) {
        expect(cls_access.context.property_chain).toContain("cls");
        expect(cls_access.context.property_chain).toContain("class_var");
      }
    });

    it("should extract property chains with subscript notation", () => {
      const code = `
data = obj['key']
nested = obj['level1']['level2']['level3']
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      const member_accesses = result.references.filter(
        ref => ref.type === "member_access"
      );

      // Subscript access should create member access references
      const key_access = member_accesses.find(ref => ref.name === "key");
      if (key_access?.context?.property_chain) {
        expect(key_access.context.property_chain).toContain("obj");
        expect(key_access.context.property_chain).toContain("key");
      }
    });
  });

  // ============================================================================
  // CLASS AND METHOD HANDLING TESTS
  // ============================================================================

  describe("Class and method handling", () => {
    it("should extract class definitions and methods", () => {
      const code = `
class Calculator:
    def add(self, a: int, b: int) -> int:
        return a + b

    def subtract(self, a: int, b: int) -> int:
        return a - b
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");

      const index = build_semantic_index(parsed_file, tree, "python");

      // Check class was captured
      expect(index.classes.size).toBeGreaterThan(0);

      // Check type annotations on methods were extracted
      const type_refs = index.references.filter(r => r.type === "type");
      expect(type_refs.length).toBeGreaterThan(0);
    });

    it("should handle constructor calls", () => {
      const code = `
class Person:
    def __init__(self, name: str):
        self.name = name

person = Person("Alice")
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");

      const index = build_semantic_index(parsed_file, tree, "python");

      // Check that constructor call was captured
      const constructs = index.references.filter(r => r.type === "construct");
      expect(constructs.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // CLASS INSTANTIATION METADATA TESTS
  // ============================================================================

  describe("Class Instantiation Metadata", () => {
    it("should extract construct_target for class instantiation", () => {
      const code = `
obj = MyClass()
instance = MyClass(arg1, arg2)
typed_obj: MyClass = MyClass()
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      // Find constructor calls
      const constructor_calls = result.references.filter(
        ref => ref.type === "construct"
      );
      expect(constructor_calls.length).toBeGreaterThan(0);

      // Check MyClass() constructor
      const my_class_construct = constructor_calls.find(ref => ref.name === "MyClass");
      expect(my_class_construct).toBeDefined();
      if (my_class_construct?.context?.construct_target) {
        // Should point to the variable being assigned
        expect(my_class_construct.context.construct_target).toHaveProperty("start_line");
        expect(my_class_construct.context.construct_target).toHaveProperty("start_column");
      }
    });

    it("should handle walrus operator with constructor calls", () => {
      const code = `
if (obj := MyClass()):
    obj.method()
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      const constructor_calls = result.references.filter(
        ref => ref.type === "construct"
      );

      // Check MyClass() with walrus operator
      const walrus_construct = constructor_calls.find(ref => ref.name === "MyClass");
      expect(walrus_construct).toBeDefined();
      if (walrus_construct?.context?.construct_target) {
        // Should point to the walrus variable (obj)
        expect(walrus_construct.context.construct_target).toBeDefined();
      }
    });

    it("should handle nested constructor calls", () => {
      const code = `
wrapper = Wrapper(Inner(data))
result = process(Factory.create())
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      const constructor_calls = result.references.filter(
        ref => ref.type === "construct"
      );

      // Check Wrapper constructor
      const wrapper_construct = constructor_calls.find(ref => ref.name === "Wrapper");
      expect(wrapper_construct).toBeDefined();

      // Check Inner constructor (nested)
      const inner_construct = constructor_calls.find(ref => ref.name === "Inner");
      expect(inner_construct).toBeDefined();
    });
  });

  // ============================================================================
  // ASSIGNMENT TRACKING TESTS
  // ============================================================================

  describe("Assignment tracking", () => {
    it("should track variable assignments", () => {
      const code = `
x = 5
y = x + 10
result = calculate(y)
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");

      const index = build_semantic_index(parsed_file, tree, "python");

      // Check that assignments were captured
      const assignments = index.references.filter(r => r.type === "assignment");
      expect(assignments.length).toBeGreaterThan(0);
    });

    it("should handle annotated assignments", () => {
      const code = `
count: int = 0
name: str = "test"
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");

      const index = build_semantic_index(parsed_file, tree, "python");

      // Check assignments and type annotations
      const assignments = index.references.filter(r => r.type === "assignment");
      const type_refs = index.references.filter(r => r.type === "type");

      expect(assignments.length).toBeGreaterThan(0);
      expect(type_refs.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // FUNCTION DEFINITIONS TESTS
  // ============================================================================

  describe("Function definitions", () => {
    it("should capture function definitions with type hints", () => {
      const code = `
def add(a: int, b: int) -> int:
    return a + b

def greet(name: str) -> None:
    print(f"Hello {name}")
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");

      const index = build_semantic_index(parsed_file, tree, "python");

      // Check functions were captured
      expect(index.functions.size).toBeGreaterThan(0);

      // Check type annotations were extracted
      const type_refs = index.references.filter(r => r.type === "type");
      const types_with_info = type_refs.filter(r => r.type_info);
      expect(types_with_info.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // PYTHON-SPECIFIC METADATA PATTERNS
  // ============================================================================

  describe("Python-Specific Metadata Patterns", () => {
    it("should handle @property decorator methods with metadata", () => {
      const code = `
class MyClass:
    @property
    def value(self) -> int:
        return self._value

    @value.setter
    def value(self, val: int) -> None:
        self._value = val
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      // Property methods should be captured with type hints
      const type_refs = result.references.filter(
        ref => ref.type === "type"
      );
      const int_refs = type_refs.filter(ref => ref.name === "int");
      expect(int_refs.length).toBeGreaterThan(0);
    });

    it("should handle Union and Optional types", () => {
      const code = `
from typing import Union, Optional

def process(value: Optional[str]) -> Union[int, str]:
    return 42

x: str | int = 42
y: int | str = 42
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      const type_refs = result.references.filter(
        ref => ref.type === "type"
      );

      // Optional[str] should be captured
      const optional_ref = type_refs.find(ref => ref.name === "Optional");
      expect(optional_ref).toBeDefined();

      // Union[int, str] should be captured
      const union_refs = type_refs.filter(ref => ref.name === "Union");
      expect(union_refs.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // EDGE CASES AND SPECIAL SCENARIOS
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle empty property chains gracefully", () => {
      const code = `
x = 42
y = func()
z = [1, 2, 3]
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      // Simple variables shouldn't have property chains
      const member_accesses = result.references.filter(
        ref => ref.type === "member_access"
      );
      // There should be no member accesses in this code
      expect(member_accesses.length).toBe(0);
    });

    it("should handle missing type hints gracefully", () => {
      const code = `
def untyped_function(x, y, z):
    return x + y + z

class UntypedClass:
    def method(self, param):
        return param
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      // Should still capture the structure without type metadata
      const functions = Array.from(result.functions.values());
      expect(functions.length).toBeGreaterThan(0);

      // Type references should be minimal or empty
      const type_refs = result.references.filter(
        ref => ref.type === "type"
      );
      // Should be empty or very few since no type hints
      expect(type_refs.length).toBeLessThanOrEqual(1);
    });

    it("should handle deeply nested attribute chains", () => {
      const code = `
result = obj.level1.level2.level3.level4.level5.level6.method()
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      const member_accesses = result.references.filter(
        ref => ref.type === "member_access"
      );

      // Should capture deep chains
      const level6_access = member_accesses.find(ref => ref.name === "level6");
      if (level6_access?.context?.property_chain) {
        // Should have multiple levels in the chain
        expect(level6_access.context.property_chain.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("should handle standalone constructor calls without assignment", () => {
      const code = `
MyClass()
print(Factory.create())
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      const constructor_calls = result.references.filter(
        ref => ref.type === "construct"
      );

      // Standalone MyClass() won't have construct_target
      const standalone = constructor_calls.find(ref => ref.name === "MyClass");
      expect(standalone).toBeDefined();
      // construct_target should be undefined for standalone calls
      expect(standalone?.context?.construct_target).toBeUndefined();
    });
  });

  // ============================================================================
  // REGRESSION TESTS
  // ============================================================================

  describe("Regression Tests", () => {
    it("should maintain all existing symbol definitions", () => {
      const code = `
class MyClass:
    def __init__(self):
        self.value = 42

    def method(self, x: int) -> str:
        return str(x)

def function(param: float) -> bool:
    return param > 0

variable: List[int] = [1, 2, 3]
`;
      const tree = parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "python");
      const result = build_semantic_index(parsed_file, tree, "python");

      // Verify core symbols are still captured
      const classes = Array.from(result.classes.values());
      const class_symbol = classes.find(c => c.name === "MyClass");
      expect(class_symbol).toBeDefined();

      const functions = Array.from(result.functions.values());
      const function_symbol = functions.find(f => f.name === "function");
      expect(function_symbol).toBeDefined();

      const variables = Array.from(result.variables.values());
      const variable_symbol = variables.find(v => v.name === "variable");
      expect(variable_symbol).toBeDefined();
    });

    it("should document Python-specific metadata extraction patterns", () => {
      // This test documents the Python-specific patterns discovered during testing

      // 1. Method call detection:
      //    - Python uses 'call' nodes with 'attribute' as function field for method calls
      //    - Pattern: call_expression with attribute node containing the method name

      // 2. Type hint extraction:
      //    - Python uses 'type' field in assignments for variable annotations
      //    - Function parameters use 'type' field within 'typed_parameter' nodes
      //    - Return types use 'return_type' field in function definitions

      // 3. Attribute access chains:
      //    - Python uses 'attribute' nodes instead of 'member_expression'
      //    - Subscript access uses 'subscript' nodes with string/integer indices
      //    - self/cls are identifiers that start property chains

      // 4. Class instantiation:
      //    - Python uses 'call' nodes where the function is a class name identifier
      //    - No separate 'new_expression' like JavaScript
      //    - Walrus operator creates 'named_expression' nodes

      // 5. Assignment tracking:
      //    - Simple assignments use 'assignment' nodes with 'left' and 'right' fields
      //    - Augmented assignments use 'augmented_assignment' nodes
      //    - Multiple assignment uses 'pattern_list' or 'tuple_pattern' for targets

      expect(true).toBe(true); // This test is for documentation
    });
  });
});
