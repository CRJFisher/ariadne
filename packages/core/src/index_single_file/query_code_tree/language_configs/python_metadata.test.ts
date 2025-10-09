/**
 * Tests for Python metadata extractors
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
// @ts-ignore - tree-sitter-python is not typed
import Python from "tree-sitter-python";
import { PYTHON_METADATA_EXTRACTORS } from "./python_metadata";
import type { FilePath } from "@ariadnejs/types";

describe("Python Metadata Extractors", () => {
  let parser: Parser;
  const TEST_FILE: FilePath = "/test/file.py" as FilePath;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  describe("extract_type_from_annotation", () => {
    it("should extract type from function parameter annotation", () => {
      const code = `def f(x: int): pass`;
      const tree = parser.parse(code);
      const typedParam = tree.rootNode.descendantsOfType("typed_parameter")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(typedParam, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("int");
      expect(result?.certainty).toBe("declared");
      expect(result?.is_nullable).toBe(false);
    });

    it("should extract type from function return annotation", () => {
      const code = `def f() -> str: pass`;
      const tree = parser.parse(code);
      const funcDef = tree.rootNode.descendantsOfType("function_definition")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(funcDef, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("str");
      expect(result?.certainty).toBe("declared");
    });

    it("should extract type from variable annotation", () => {
      const code = `x: int = 5`;
      const tree = parser.parse(code);
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(assignment, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("int");
    });

    it("should extract complex generic type", () => {
      const code = `x: List[str] = []`;
      const tree = parser.parse(code);
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(assignment, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("List[str]");
    });

    it("should detect nullable Optional types", () => {
      const code = `x: Optional[int] = None`;
      const tree = parser.parse(code);
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(assignment, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.is_nullable).toBe(true);
    });

    it("should detect nullable Union types with None", () => {
      const code = `x: Union[str, None] = None`;
      const tree = parser.parse(code);
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(assignment, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.is_nullable).toBe(true);
    });

    it("should handle Python 3.10+ union syntax", () => {
      const code = `def f(x: str | int): pass`;
      const tree = parser.parse(code);
      const typedParam = tree.rootNode.descendantsOfType("typed_parameter")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(typedParam, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toContain("|");
    });

    it("should handle parameters with default values", () => {
      const code = `def f(x: int = 5): pass`;
      const tree = parser.parse(code);
      const typedDefaultParam = tree.rootNode.descendantsOfType("typed_default_parameter")[0];

      if (typedDefaultParam) {
        const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(typedDefaultParam, TEST_FILE);

        expect(result).toBeDefined();
        expect(result?.type_name).toBe("int");
        expect(result?.certainty).toBe("declared");
      } else {
        // Some versions of tree-sitter-python might use typed_parameter even with defaults
        const typedParam = tree.rootNode.descendantsOfType("typed_parameter")[0];
        const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(typedParam, TEST_FILE);

        expect(result).toBeDefined();
        expect(result?.type_name).toBe("int");
      }
    });

    it("should detect nullable with pipe None syntax", () => {
      const code = `def f(x: str | None): pass`;
      const tree = parser.parse(code);
      const typedParam = tree.rootNode.descendantsOfType("typed_parameter")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(typedParam, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toContain("None");
      expect(result?.is_nullable).toBe(true);
    });

    it("should return undefined for nodes without type annotation", () => {
      const code = `x = 5`;  // Assignment without type annotation
      const tree = parser.parse(code);
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      // Pass an assignment node that has no type field
      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(assignment, TEST_FILE);

      // Since this assignment has no type annotation, it should return undefined
      expect(result).toBeUndefined();
    });

    it("should handle identifier node as type", () => {
      const code = `def f(x): pass`;
      const tree = parser.parse(code);
      // When we pass a raw identifier, it treats it as a type name
      const param = tree.rootNode.descendantsOfType("identifier").find(n => n.text === "x");

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(param!, TEST_FILE);

      // An identifier node will be treated as a type name itself
      expect(result).toBeDefined();
      expect(result?.type_name).toBe("x");
    });

    it("should handle custom type identifiers", () => {
      const code = `def f(x: MyCustomType): pass`;
      const tree = parser.parse(code);
      const typedParam = tree.rootNode.descendantsOfType("typed_parameter")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(typedParam, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.type_name).toBe("MyCustomType");
    });

    it("should extract type from type node directly", () => {
      const code = `x: int = 5`;
      const tree = parser.parse(code);
      const typeNode = tree.rootNode.descendantsOfType("type")[0];

      if (typeNode) {
        const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(typeNode, TEST_FILE);

        expect(result).toBeDefined();
        expect(result?.type_name).toBe("int");
      }
    });
  });

  describe("extract_call_receiver", () => {
    it("should extract receiver from method call", () => {
      const code = `obj.method()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_line).toBe(1);
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(3);
    });

    it("should extract receiver from chained method call", () => {
      const code = `user.profile.get_name()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toBeDefined();
      // Should get location of "user.profile"
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(12);
    });

    it("should extract 'self' as receiver", () => {
      const code = `self.process()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(4);
    });

    it("should extract 'cls' as receiver", () => {
      const code = `cls.create()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(3);
    });

    it("should extract receiver from super() call", () => {
      const code = `super().method()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0]; // First call is the outer method call

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toBeDefined();
      // Should get location of "super()"
      expect(result?.start_column).toBe(1);
    });

    it("should return undefined for standalone function call", () => {
      const code = `print("hello")`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("should handle attribute node directly (not in call)", () => {
      const code = `obj.prop`;
      const tree = parser.parse(code);
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(attribute, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(3); // end of "obj"
    });

    it("should handle nested attribute node directly", () => {
      const code = `user.profile.name`;
      const tree = parser.parse(code);
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(attribute, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1);
      expect(result?.end_column).toBe(12); // end of "user.profile"
    });
  });

  describe("extract_property_chain", () => {
    it("should extract simple property chain", () => {
      const code = `a.b.c`;
      const tree = parser.parse(code);
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toEqual(["a", "b", "c"]);
    });

    it("should extract chain with method call", () => {
      const code = `obj.prop.method()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(call);

      expect(result).toEqual(["obj", "prop", "method"]);
    });

    it("should handle 'self' in property chain", () => {
      const code = `self.data.items`;
      const tree = parser.parse(code);
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toEqual(["self", "data", "items"]);
    });

    it("should handle subscript notation", () => {
      const code = `obj['key'].prop`;
      const tree = parser.parse(code);
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toBeDefined();
      expect(result).toContain("obj");
      expect(result).toContain("key");
      expect(result).toContain("prop");
    });

    it("should handle super() in chain", () => {
      const code = `super().method`;
      const tree = parser.parse(code);
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toBeDefined();
      expect(result).toContain("super");
      expect(result).toContain("method");
    });

    it("should handle nested subscripts", () => {
      const code = `obj["key1"]["key2"]`;
      const tree = parser.parse(code);
      const subscript = tree.rootNode.descendantsOfType("subscript")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(subscript);

      expect(result).toEqual(["obj", "key1", "key2"]);
    });

    it("should handle integer subscript", () => {
      const code = `obj[0].prop`;
      const tree = parser.parse(code);
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toBeDefined();
      expect(result).toContain("obj");
      expect(result).toContain("prop");
      // Note: numeric subscripts are not included in the chain
    });

    it("should handle variable subscript", () => {
      const code = `obj[index].prop`;
      const tree = parser.parse(code);
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toBeDefined();
      expect(result).toContain("obj");
      expect(result).toContain("prop");
      // Note: variable subscripts are not included in the chain
    });

    it("should return undefined for simple identifier", () => {
      const code = `x`;
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(identifier);

      expect(result).toBeUndefined();
    });

    it("should handle mixed subscript and attribute access", () => {
      const code = `data["users"][0].profile.name`;
      const tree = parser.parse(code);
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toBeDefined();
      expect(result).toContain("data");
      expect(result).toContain("users");
      expect(result).toContain("profile");
      expect(result).toContain("name");
    });
  });

  describe("extract_assignment_parts", () => {
    it("should extract parts from simple assignment", () => {
      const code = `x = y`;
      const tree = parser.parse(code);
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(assignment, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(1);
      expect(result.source?.start_column).toBe(5);
    });

    it("should extract parts from annotated assignment", () => {
      const code = `x: int = 5`;
      const tree = parser.parse(code);
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(assignment, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(1); // position of 'x'
      expect(result.source?.start_column).toBe(10); // position of '5'
    });

    it("should extract parts from augmented assignment", () => {
      const code = `x += 5`;
      const tree = parser.parse(code);
      const augmentedAssign = tree.rootNode.descendantsOfType("augmented_assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(augmentedAssign, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.start_column).toBe(1);
      expect(result.source?.start_column).toBe(6);
    });

    it("should extract parts from multiple assignment", () => {
      const code = `a, b = c, d`;
      const tree = parser.parse(code);
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(assignment, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
    });

    it("should extract parts from attribute assignment", () => {
      const code = `obj.prop = value`;
      const tree = parser.parse(code);
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(assignment, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
      expect(result.target?.end_column).toBe(8); // end of 'obj.prop'
    });

    it("should handle walrus operator", () => {
      const code = `if (n := len(data)) > 0: pass`;
      const tree = parser.parse(code);
      const namedExpr = tree.rootNode.descendantsOfType("named_expression")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(namedExpr, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
    });
  });

  describe("extract_construct_target", () => {
    it("should extract target from constructor in assignment", () => {
      const code = `obj = MyClass()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(call, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1); // position of 'obj'
      expect(result?.end_column).toBe(3);
    });

    it("should extract target from constructor in attribute assignment", () => {
      const code = `self.prop = Thing()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(call, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1); // position of 'self.prop'
      expect(result?.end_column).toBe(9);
    });

    it("should extract target from annotated assignment with constructor", () => {
      const code = `items: List[Item] = ItemList()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(call, TEST_FILE);

      expect(result).toBeDefined();
      expect(result?.start_column).toBe(1); // position of 'items'
      expect(result?.end_column).toBe(5);
    });

    it("should handle walrus operator with constructor", () => {
      const code = `if (obj := MyClass()) is not None: pass`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(call, TEST_FILE);

      expect(result).toBeDefined();
    });

    it("should return undefined for standalone constructor call", () => {
      const code = `MyClass()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(call, TEST_FILE);

      expect(result).toBeUndefined();
    });
  });

  describe("extract_type_arguments", () => {
    it("should extract type arguments from simple generic", () => {
      const code = `x: List[int] = []`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toEqual(["int"]);
    });

    it("should extract multiple type arguments", () => {
      const code = `d: Dict[str, int] = {}`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toEqual(["str", "int"]);
    });

    it("should extract nested generic type arguments", () => {
      const code = `x: List[Dict[str, int]] = []`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toEqual(["Dict[str, int]"]);
    });

    it("should extract Union type arguments", () => {
      const code = `x: Union[str, int, None] = None`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toEqual(["str", "int", "None"]);
    });

    it("should extract Callable type arguments", () => {
      const code = `f: Callable[[int, str], bool] = lambda x, y: True`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toBeDefined();
      expect(result?.length).toBeGreaterThan(0);
    });

    it("should return undefined for non-generic types", () => {
      const code = `x: int = 5`;
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(identifier);

      expect(result).toBeUndefined();
    });

    it("should extract exact Callable arguments", () => {
      const code = `f: Callable[[int, str], bool] = lambda x, y: True`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toBeDefined();
      // Callable has special format where arguments are in a list
      expect(result).toBeDefined();
      const resultStr = result?.join(", ");
      expect(resultStr).toContain("bool");
    });

    it("should handle deeply nested generics", () => {
      const code = `x: Dict[str, List[Tuple[int, str]]] = {}`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toBeDefined();
      expect(result?.[0]).toBe("str");
      expect(result?.[1]).toContain("List");
      expect(result?.[1]).toContain("Tuple");
    });

    it("should handle Optional as special case of Union", () => {
      const code = `x: Optional[str] = None`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toBeDefined();
      expect(result).toEqual(["str"]);
    });

    it("should handle complex nested Union types", () => {
      const code = `x: Union[int, List[str], Dict[str, Any]] = []`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toBeDefined();
      expect(result?.length).toBe(3);
      expect(result?.[0]).toBe("int");
      expect(result?.[1]).toContain("List");
      expect(result?.[2]).toContain("Dict");
    });

    it("should handle Literal type arguments", () => {
      const code = `x: Literal["foo", "bar"] = "foo"`;
      const tree = parser.parse(code);
      const genericType = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(genericType);

      expect(result).toBeDefined();
      // Literal contains string values as type arguments
      expect(result?.length).toBeGreaterThan(0);
    });
  });

  describe("null/undefined handling", () => {
    it("extract_type_from_annotation should handle null input", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(
        // @ts-ignore - testing null input
        null,
        TEST_FILE
      );
      expect(result).toBeUndefined();
    });

    it("extract_call_receiver should handle null input", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(null as any, TEST_FILE);
      expect(result).toBeUndefined();
    });

    it("extract_call_receiver should handle undefined input", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(undefined as any, TEST_FILE);
      expect(result).toBeUndefined();
    });

    it("extract_property_chain should handle null input", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(null as any);
      expect(result).toBeUndefined();
    });

    it("extract_property_chain should handle undefined input", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(undefined as any);
      expect(result).toBeUndefined();
    });

    it("extract_assignment_parts should handle null input", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(null as any, TEST_FILE);
      expect(result).toEqual({ source: undefined, target: undefined });
    });

    it("extract_assignment_parts should handle undefined input", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(undefined as any, TEST_FILE);
      expect(result).toEqual({ source: undefined, target: undefined });
    });

    it("extract_construct_target should handle null input", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(null as any, TEST_FILE);
      expect(result).toBeUndefined();
    });

    it("extract_construct_target should handle undefined input", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(undefined as any, TEST_FILE);
      expect(result).toBeUndefined();
    });

    it("extract_type_arguments should handle null input", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(null as any);
      expect(result).toBeUndefined();
    });

    it("extract_type_arguments should handle undefined input", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(undefined as any);
      expect(result).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should handle deeply nested property chains", () => {
      const code = `a.b.c.d.e.f`;
      const tree = parser.parse(code);
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toBeDefined();
      expect(result?.length).toBe(6);
      expect(result).toEqual(["a", "b", "c", "d", "e", "f"]);
    });

    it("should handle super() with arguments in older Python", () => {
      const code = `super(MyClass, self).method()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0]; // First call is the method call

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toBeDefined();
    });

    it("should handle assignment with unpacking", () => {
      const code = `a, *rest = values`;
      const tree = parser.parse(code);
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(assignment, TEST_FILE);

      expect(result.target).toBeDefined();
      expect(result.source).toBeDefined();
    });

    it("should handle method chaining with multiple calls", () => {
      const code = `obj.method1().method2().method3()`;
      const tree = parser.parse(code);
      const calls = tree.rootNode.descendantsOfType("call");

      // Test the outermost call
      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(calls[0], TEST_FILE);

      expect(result).toBeDefined();
    });

    it("should handle property decorator pattern", () => {
      const code = `
@property
def value(self):
    return self._value
`;
      const tree = parser.parse(code);
      const funcDef = tree.rootNode.descendantsOfType("function_definition")[0];

      // Property decorators are handled at definition level, not in metadata extraction
      expect(funcDef).toBeDefined();
    });
  });

  describe("is_method_call", () => {
    it("should return true for method calls", () => {
      const code = `obj.method()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.is_method_call(call);

      expect(result).toBe(true);
    });

    it("should return false for function calls", () => {
      const code = `func()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.is_method_call(call);

      expect(result).toBe(false);
    });

    it("should return true for chained method calls", () => {
      const code = `obj.nested.method()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.is_method_call(call);

      expect(result).toBe(true);
    });

    it("should return true for method calls on 'self'", () => {
      const code = `self.method()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.is_method_call(call);

      expect(result).toBe(true);
    });

    it("should return false for non-call nodes", () => {
      const code = `x = 42`;
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = PYTHON_METADATA_EXTRACTORS.is_method_call(identifier);

      expect(result).toBe(false);
    });
  });

  describe("extract_call_name", () => {
    it("should extract method name from method call", () => {
      const code = `obj.method()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_name(call);

      expect(result).toBe("method");
    });

    it("should extract function name from function call", () => {
      const code = `func()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_name(call);

      expect(result).toBe("func");
    });

    it("should extract method name from chained call", () => {
      const code = `obj.nested.method()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_name(call);

      expect(result).toBe("method");
    });

    it("should extract method name from 'self' call", () => {
      const code = `self.method()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_name(call);

      expect(result).toBe("method");
    });

    it("should return undefined for non-call nodes", () => {
      const code = `x = 42`;
      const tree = parser.parse(code);
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_name(identifier);

      expect(result).toBeUndefined();
    });

    it("should extract constructor name", () => {
      const code = `MyClass()`;
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_name(call);

      expect(result).toBe("MyClass");
    });
  });
});
