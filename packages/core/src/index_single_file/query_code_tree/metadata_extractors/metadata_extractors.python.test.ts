import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
// @ts-ignore - tree-sitter-python is not typed
import Python from "tree-sitter-python";
import { PYTHON_METADATA_EXTRACTORS } from "./metadata_extractors.python";
import type { FilePath, Location } from "@ariadnejs/types";

describe("Python Metadata Extractors", () => {
  let parser: Parser;
  const TEST_FILE: FilePath = "/test/file.py" as FilePath;

  const at = (
    start_column: number,
    end_column: number,
    line = 1
  ): Location => ({
    file_path: TEST_FILE,
    start_line: line,
    start_column,
    end_line: line,
    end_column,
  });

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  describe("extract_type_from_annotation", () => {
    it("extracts type from function parameter annotation", () => {
      const tree = parser.parse("def f(x: int): pass");
      const typed_param = tree.rootNode.descendantsOfType("typed_parameter")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(typed_param, TEST_FILE);

      expect(result?.type_name).toBe("int");
      expect(result?.certainty).toBe("declared");
      expect(result?.is_nullable).toBe(false);
    });

    it("extracts type from function return annotation", () => {
      const tree = parser.parse("def f() -> str: pass");
      const func_def = tree.rootNode.descendantsOfType("function_definition")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(func_def, TEST_FILE);

      expect(result?.type_name).toBe("str");
      expect(result?.certainty).toBe("declared");
      expect(result?.is_nullable).toBe(false);
    });

    it("extracts type from variable annotation", () => {
      const tree = parser.parse("x: int = 5");
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(assignment, TEST_FILE);

      expect(result?.type_name).toBe("int");
      expect(result?.is_nullable).toBe(false);
    });

    it("extracts complex generic type verbatim", () => {
      const tree = parser.parse("x: List[str] = []");
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(assignment, TEST_FILE);

      expect(result?.type_name).toBe("List[str]");
    });

    it("marks Optional types nullable", () => {
      const tree = parser.parse("x: Optional[int] = None");
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(assignment, TEST_FILE);

      expect(result?.type_name).toBe("Optional[int]");
      expect(result?.is_nullable).toBe(true);
    });

    it("marks Union types containing None nullable", () => {
      const tree = parser.parse("x: Union[str, None] = None");
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(assignment, TEST_FILE);

      expect(result?.type_name).toBe("Union[str, None]");
      expect(result?.is_nullable).toBe(true);
    });

    it("extracts Python 3.10+ union syntax", () => {
      const tree = parser.parse("def f(x: str | int): pass");
      const typed_param = tree.rootNode.descendantsOfType("typed_parameter")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(typed_param, TEST_FILE);

      expect(result?.type_name).toBe("str | int");
      expect(result?.is_nullable).toBe(false);
    });

    it("extracts type from parameters with default values", () => {
      const tree = parser.parse("def f(x: int = 5): pass");
      const typed_default_param = tree.rootNode.descendantsOfType("typed_default_parameter")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(typed_default_param!, TEST_FILE);

      expect(result?.type_name).toBe("int");
      expect(result?.certainty).toBe("declared");
    });

    it("marks pipe-None union syntax nullable", () => {
      const tree = parser.parse("def f(x: str | None): pass");
      const typed_param = tree.rootNode.descendantsOfType("typed_parameter")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(typed_param, TEST_FILE);

      expect(result?.type_name).toBe("str | None");
      expect(result?.is_nullable).toBe(true);
    });

    it("returns undefined for an assignment without a type annotation", () => {
      const tree = parser.parse("x = 5");
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(assignment, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("treats a bare identifier node as a type name", () => {
      const tree = parser.parse("def f(x): pass");
      const param = tree.rootNode.descendantsOfType("identifier").find(n => n.text === "x");

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(param!, TEST_FILE);

      expect(result?.type_name).toBe("x");
    });

    it("extracts custom type identifiers", () => {
      const tree = parser.parse("def f(x: MyCustomType): pass");
      const typed_param = tree.rootNode.descendantsOfType("typed_parameter")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(typed_param, TEST_FILE);

      expect(result?.type_name).toBe("MyCustomType");
    });

    it("extracts type from a type node directly", () => {
      const tree = parser.parse("x: int = 5");
      const type_node = tree.rootNode.descendantsOfType("type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(type_node!, TEST_FILE);

      expect(result?.type_name).toBe("int");
    });
  });

  describe("extract_call_receiver", () => {
    it("extracts receiver from method call", () => {
      const tree = parser.parse("obj.method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toEqual(at(1, 3));
    });

    it("extracts full chain as receiver from chained method call", () => {
      const tree = parser.parse("user.profile.get_name()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toEqual(at(1, 12));
    });

    it("extracts 'self' as receiver", () => {
      const tree = parser.parse("self.process()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toEqual(at(1, 4));
    });

    it("extracts 'cls' as receiver", () => {
      const tree = parser.parse("cls.create()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toEqual(at(1, 3));
    });

    it("extracts the super() node as receiver", () => {
      const tree = parser.parse("super().method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toEqual(at(1, 7));
    });

    it("returns undefined for a standalone function call", () => {
      const tree = parser.parse("print(\"hello\")");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("extracts receiver from an attribute node outside a call", () => {
      const tree = parser.parse("obj.prop");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(attribute, TEST_FILE);

      expect(result).toEqual(at(1, 3));
    });

    it("extracts full chain from a nested attribute node", () => {
      const tree = parser.parse("user.profile.name");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(attribute, TEST_FILE);

      expect(result).toEqual(at(1, 12));
    });

    it("extracts the class name as receiver from a static/class method call", () => {
      const tree = parser.parse("MyClass.create()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toEqual(at(1, 7));
    });

    it("extracts receiver when given the attribute (function field) node directly", () => {
      const tree = parser.parse("UserManager.new()");
      const call = tree.rootNode.descendantsOfType("call")[0];
      const func = call.childForFieldName("function");
      expect(func?.type).toBe("attribute");

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(func!, TEST_FILE);

      expect(result).toEqual(at(1, 11));
    });
  });

  describe("extract_property_chain", () => {
    it("extracts a simple property chain", () => {
      const tree = parser.parse("a.b.c");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toEqual(["a", "b", "c"]);
    });

    it("extracts a chain that ends in a method call", () => {
      const tree = parser.parse("obj.prop.method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(call);

      expect(result).toEqual(["obj", "prop", "method"]);
    });

    it("includes 'self' as the chain root", () => {
      const tree = parser.parse("self.data.items");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toEqual(["self", "data", "items"]);
    });

    it("includes string subscript keys in the chain", () => {
      const tree = parser.parse("obj['key'].prop");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toEqual(["obj", "key", "prop"]);
    });

    it("collapses super() to 'super' in the chain", () => {
      const tree = parser.parse("super().method");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toEqual(["super", "method"]);
    });

    it("flattens nested string subscripts", () => {
      const tree = parser.parse("obj[\"key1\"][\"key2\"]");
      const subscript = tree.rootNode.descendantsOfType("subscript")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(subscript);

      expect(result).toEqual(["obj", "key1", "key2"]);
    });

    it("skips integer subscripts", () => {
      const tree = parser.parse("obj[0].prop");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toEqual(["obj", "prop"]);
    });

    it("skips variable subscripts", () => {
      const tree = parser.parse("obj[index].prop");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toEqual(["obj", "prop"]);
    });

    it("returns undefined for a bare identifier", () => {
      const tree = parser.parse("x");
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(identifier);

      expect(result).toBeUndefined();
    });

    it("keeps string subscripts and drops numeric ones in a mixed chain", () => {
      const tree = parser.parse("data[\"users\"][0].profile.name");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toEqual(["data", "users", "profile", "name"]);
    });

    it("extracts a deeply nested chain in order", () => {
      const tree = parser.parse("a.b.c.d.e.f");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(attribute);

      expect(result).toEqual(["a", "b", "c", "d", "e", "f"]);
    });
  });

  describe("extract_assignment_parts", () => {
    it("extracts target and source from a simple assignment", () => {
      const tree = parser.parse("x = y");
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(assignment, TEST_FILE);

      expect(result).toEqual({ target: at(1, 1), source: at(5, 5) });
    });

    it("extracts target and source from an annotated assignment", () => {
      const tree = parser.parse("x: int = 5");
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(assignment, TEST_FILE);

      expect(result).toEqual({ target: at(1, 1), source: at(10, 10) });
    });

    it("extracts target and source from an augmented assignment", () => {
      const tree = parser.parse("x += 5");
      const augmented_assign = tree.rootNode.descendantsOfType("augmented_assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(augmented_assign, TEST_FILE);

      expect(result).toEqual({ target: at(1, 1), source: at(6, 6) });
    });

    it("spans the whole tuple for multiple assignment", () => {
      const tree = parser.parse("a, b = c, d");
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(assignment, TEST_FILE);

      expect(result).toEqual({ target: at(1, 4), source: at(8, 11) });
    });

    it("spans the whole attribute path as the target", () => {
      const tree = parser.parse("obj.prop = value");
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(assignment, TEST_FILE);

      expect(result).toEqual({ target: at(1, 8), source: at(12, 16) });
    });

    it("spans the whole unpacking pattern as the target", () => {
      const tree = parser.parse("a, *rest = values");
      const assignment = tree.rootNode.descendantsOfType("assignment")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(assignment, TEST_FILE);

      expect(result).toEqual({ target: at(1, 8), source: at(12, 17) });
    });

    it("extracts name and value from a walrus expression", () => {
      const tree = parser.parse("if (n := len(data)) > 0: pass");
      const named_expr = tree.rootNode.descendantsOfType("named_expression")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(named_expr, TEST_FILE);

      expect(result).toEqual({ target: at(5, 5), source: at(10, 18) });
    });
  });

  describe("extract_construct_target", () => {
    it("extracts the target of a constructor in a simple assignment", () => {
      const tree = parser.parse("obj = MyClass()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(call, TEST_FILE);

      expect(result).toEqual(at(1, 3));
    });

    it("extracts the attribute target of a constructor in an attribute assignment", () => {
      const tree = parser.parse("self.prop = Thing()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(call, TEST_FILE);

      expect(result).toEqual(at(1, 9));
    });

    it("extracts the target of a constructor in an annotated assignment", () => {
      const tree = parser.parse("items: List[Item] = ItemList()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(call, TEST_FILE);

      expect(result).toEqual(at(1, 5));
    });

    it("extracts the walrus name as the constructor target", () => {
      const tree = parser.parse("if (obj := MyClass()) is not None: pass");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(call, TEST_FILE);

      expect(result).toEqual(at(5, 7));
    });

    it("returns undefined for a standalone constructor call", () => {
      const tree = parser.parse("MyClass()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(call, TEST_FILE);

      expect(result).toBeUndefined();
    });
  });

  describe("extract_type_arguments", () => {
    it("extracts a single type argument from a generic", () => {
      const tree = parser.parse("x: List[int] = []");
      const generic_type = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(generic_type);

      expect(result).toEqual(["int"]);
    });

    it("extracts multiple type arguments", () => {
      const tree = parser.parse("d: Dict[str, int] = {}");
      const generic_type = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(generic_type);

      expect(result).toEqual(["str", "int"]);
    });

    it("keeps a nested generic as a single argument", () => {
      const tree = parser.parse("x: List[Dict[str, int]] = []");
      const generic_type = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(generic_type);

      expect(result).toEqual(["Dict[str, int]"]);
    });

    it("extracts each member of a Union", () => {
      const tree = parser.parse("x: Union[str, int, None] = None");
      const generic_type = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(generic_type);

      expect(result).toEqual(["str", "int", "None"]);
    });

    it("keeps the bracketed parameter list of a Callable intact", () => {
      const tree = parser.parse("f: Callable[[int, str], bool] = lambda x, y: True");
      const generic_type = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(generic_type);

      expect(result).toEqual(["[int, str]", "bool"]);
    });

    it("returns undefined for a non-generic type", () => {
      const tree = parser.parse("x: int = 5");
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(identifier);

      expect(result).toBeUndefined();
    });

    it("splits deeply nested generics at the top level only", () => {
      const tree = parser.parse("x: Dict[str, List[Tuple[int, str]]] = {}");
      const generic_type = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(generic_type);

      expect(result).toEqual(["str", "List[Tuple[int, str]]"]);
    });

    it("extracts the argument of Optional", () => {
      const tree = parser.parse("x: Optional[str] = None");
      const generic_type = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(generic_type);

      expect(result).toEqual(["str"]);
    });

    it("splits a Union of nested generics at the top level", () => {
      const tree = parser.parse("x: Union[int, List[str], Dict[str, Any]] = []");
      const generic_type = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(generic_type);

      expect(result).toEqual(["int", "List[str]", "Dict[str, Any]"]);
    });

    it("keeps quoted Literal arguments verbatim", () => {
      const tree = parser.parse("x: Literal[\"foo\", \"bar\"] = \"foo\"");
      const generic_type = tree.rootNode.descendantsOfType("generic_type")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(generic_type);

      expect(result).toEqual(["\"foo\"", "\"bar\""]);
    });

    it("extracts a single type argument from a subscript node", () => {
      const tree = parser.parse("x = items[str]");
      const subscript = tree.rootNode.descendantsOfType("subscript")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(subscript);

      expect(result).toEqual(["str"]);
    });

    it("splits a tuple subscript into separate type arguments", () => {
      const tree = parser.parse("x = mapping[(str, int)]");
      const subscript = tree.rootNode.descendantsOfType("subscript")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(subscript);

      expect(result).toEqual(["str", "int"]);
    });
  });

  describe("null/undefined handling", () => {
    it("extract_type_from_annotation returns undefined for null", () => {
      // @ts-ignore - testing null input
      const result = PYTHON_METADATA_EXTRACTORS.extract_type_from_annotation(null, TEST_FILE);
      expect(result).toBeUndefined();
    });

    it("extract_call_receiver returns undefined for null", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(null as any, TEST_FILE);
      expect(result).toBeUndefined();
    });

    it("extract_call_receiver returns undefined for undefined", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(undefined as any, TEST_FILE);
      expect(result).toBeUndefined();
    });

    it("extract_property_chain returns undefined for null", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(null as any);
      expect(result).toBeUndefined();
    });

    it("extract_property_chain returns undefined for undefined", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_property_chain(undefined as any);
      expect(result).toBeUndefined();
    });

    it("extract_assignment_parts returns empty parts for null", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(null as any, TEST_FILE);
      expect(result).toEqual({ source: undefined, target: undefined });
    });

    it("extract_assignment_parts returns empty parts for undefined", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_assignment_parts(undefined as any, TEST_FILE);
      expect(result).toEqual({ source: undefined, target: undefined });
    });

    it("extract_construct_target returns undefined for null", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(null as any, TEST_FILE);
      expect(result).toBeUndefined();
    });

    it("extract_construct_target returns undefined for undefined", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_construct_target(undefined as any, TEST_FILE);
      expect(result).toBeUndefined();
    });

    it("extract_type_arguments returns undefined for null", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(null as any);
      expect(result).toBeUndefined();
    });

    it("extract_type_arguments returns undefined for undefined", () => {
      const result = PYTHON_METADATA_EXTRACTORS.extract_type_arguments(undefined as any);
      expect(result).toBeUndefined();
    });
  });

  describe("extract_call_receiver edge cases", () => {
    it("extracts the full super(...) node as receiver when super has arguments", () => {
      const tree = parser.parse("super(MyClass, self).method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toEqual(at(1, 20));
    });

    it("extracts the inner call chain as receiver of the outermost call", () => {
      const code = "obj.method1().method2().method3()";
      const tree = parser.parse(code);
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_call_receiver(call, TEST_FILE);

      expect(result).toEqual(at(1, 23));
    });
  });

  describe("is_method_call", () => {
    it("returns true for a method call", () => {
      const tree = parser.parse("obj.method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      expect(PYTHON_METADATA_EXTRACTORS.is_method_call(call)).toBe(true);
    });

    it("returns false for a plain function call", () => {
      const tree = parser.parse("func()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      expect(PYTHON_METADATA_EXTRACTORS.is_method_call(call)).toBe(false);
    });

    it("returns true for a chained method call", () => {
      const tree = parser.parse("obj.nested.method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      expect(PYTHON_METADATA_EXTRACTORS.is_method_call(call)).toBe(true);
    });

    it("returns true for a method call on 'self'", () => {
      const tree = parser.parse("self.method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      expect(PYTHON_METADATA_EXTRACTORS.is_method_call(call)).toBe(true);
    });

    it("returns false for a non-call node", () => {
      const tree = parser.parse("x = 42");
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      expect(PYTHON_METADATA_EXTRACTORS.is_method_call(identifier)).toBe(false);
    });
  });

  describe("extract_call_name", () => {
    it("extracts the method name from a method call", () => {
      const tree = parser.parse("obj.method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      expect(PYTHON_METADATA_EXTRACTORS.extract_call_name(call)).toBe("method");
    });

    it("extracts the function name from a plain function call", () => {
      const tree = parser.parse("func()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      expect(PYTHON_METADATA_EXTRACTORS.extract_call_name(call)).toBe("func");
    });

    it("extracts the trailing method name from a chained call", () => {
      const tree = parser.parse("obj.nested.method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      expect(PYTHON_METADATA_EXTRACTORS.extract_call_name(call)).toBe("method");
    });

    it("extracts the method name from a 'self' call", () => {
      const tree = parser.parse("self.method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      expect(PYTHON_METADATA_EXTRACTORS.extract_call_name(call)).toBe("method");
    });

    it("returns undefined for a non-call node", () => {
      const tree = parser.parse("x = 42");
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      expect(PYTHON_METADATA_EXTRACTORS.extract_call_name(identifier)).toBeUndefined();
    });

    it("extracts the class name from a constructor call", () => {
      const tree = parser.parse("MyClass()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      expect(PYTHON_METADATA_EXTRACTORS.extract_call_name(call)).toBe("MyClass");
    });
  });

  describe("extract_receiver_info", () => {
    it("flags self.method() as a self-reference", () => {
      const tree = parser.parse("self.method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_receiver_info(call, TEST_FILE);

      expect(result).toEqual({
        receiver_location: at(1, 4),
        property_chain: ["self", "method"],
        is_self_reference: true,
        self_keyword: "self",
      });
    });

    it("parses the full chain of a nested self.db.query()", () => {
      const tree = parser.parse("self.db.query()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_receiver_info(call, TEST_FILE);

      expect(result?.property_chain).toEqual(["self", "db", "query"]);
      expect(result?.is_self_reference).toBe(true);
      expect(result?.self_keyword).toBe("self");
    });

    it("parses the full chain of a deeply nested self.a.b.c()", () => {
      const tree = parser.parse("self.a.b.c()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_receiver_info(call, TEST_FILE);

      expect(result?.property_chain).toEqual(["self", "a", "b", "c"]);
      expect(result?.is_self_reference).toBe(true);
      expect(result?.self_keyword).toBe("self");
    });

    it("flags cls.factory.create() as a cls self-reference", () => {
      const tree = parser.parse("cls.factory.create()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_receiver_info(call, TEST_FILE);

      expect(result?.property_chain).toEqual(["cls", "factory", "create"]);
      expect(result?.is_self_reference).toBe(true);
      expect(result?.self_keyword).toBe("cls");
    });

    it("does not flag obj.attr.method() as a self-reference", () => {
      const tree = parser.parse("obj.attr.method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_receiver_info(call, TEST_FILE);

      expect(result?.property_chain).toEqual(["obj", "attr", "method"]);
      expect(result?.is_self_reference).toBe(false);
      expect(result?.self_keyword).toBeUndefined();
    });

    it("flags super().method() as a super self-reference", () => {
      const tree = parser.parse("super().method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_receiver_info(call, TEST_FILE);

      expect(result?.property_chain).toEqual(["super", "method"]);
      expect(result?.is_self_reference).toBe(true);
      expect(result?.self_keyword).toBe("super");
    });

    it("does not flag a simple obj.method() as a self-reference", () => {
      const tree = parser.parse("obj.method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_receiver_info(call, TEST_FILE);

      expect(result).toEqual({
        receiver_location: at(1, 3),
        property_chain: ["obj", "method"],
        is_self_reference: false,
      });
    });

    it("returns undefined for a plain function call", () => {
      const tree = parser.parse("print('hello')");
      const call = tree.rootNode.descendantsOfType("call")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_receiver_info(call, TEST_FILE);

      expect(result).toBeUndefined();
    });

    it("handles a direct attribute node outside a call", () => {
      const tree = parser.parse("obj.prop");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_receiver_info(attribute, TEST_FILE);

      expect(result).toEqual({
        receiver_location: at(1, 3),
        property_chain: ["obj", "prop"],
        is_self_reference: false,
      });
    });

    it("flags a direct self attribute node as a self-reference", () => {
      const tree = parser.parse("self.value");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      const result = PYTHON_METADATA_EXTRACTORS.extract_receiver_info(attribute, TEST_FILE);

      expect(result).toEqual({
        receiver_location: at(1, 4),
        property_chain: ["self", "value"],
        is_self_reference: true,
        self_keyword: "self",
      });
    });
  });

  describe("extract_is_optional_chain", () => {
    it("returns false for a method call", () => {
      const tree = parser.parse("obj.method()");
      const call = tree.rootNode.descendantsOfType("call")[0];

      expect(PYTHON_METADATA_EXTRACTORS.extract_is_optional_chain(call)).toBe(false);
    });

    it("returns false for an attribute access", () => {
      const tree = parser.parse("obj.prop");
      const attribute = tree.rootNode.descendantsOfType("attribute")[0];

      expect(PYTHON_METADATA_EXTRACTORS.extract_is_optional_chain(attribute)).toBe(false);
    });

    it("returns false for a bare identifier", () => {
      const tree = parser.parse("x");
      const identifier = tree.rootNode.descendantsOfType("identifier")[0];

      expect(PYTHON_METADATA_EXTRACTORS.extract_is_optional_chain(identifier)).toBe(false);
    });
  });
});
