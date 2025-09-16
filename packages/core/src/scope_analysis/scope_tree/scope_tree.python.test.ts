/**
 * Comprehensive Python scope tree tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import { build_scope_tree } from "./scope_tree";
import { FilePath } from "@ariadnejs/types";

describe("Python Scope Tree Building", () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(Python as any);
  });

  describe("Basic scope creation", () => {
    it("should create module scope for Python files", () => {
      const code = `x = 1`;
      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      expect(scope_tree.root_id).toMatch(/^module:/);
      const root_node = scope_tree.nodes.get(scope_tree.root_id);
      expect(root_node).toBeDefined();
      expect(root_node?.type).toBe("module");
    });
  });

  describe("Function scopes", () => {
    it("should create scopes for function definitions", () => {
      const code = `
def process_data(input):
    print(input)

def calculate_total(items):
    return len(items)
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(2);

      const names = function_scopes
        .map(scope => scope.name)
        .filter(name => name !== null)
        .sort();

      expect(names).toEqual(["calculate_total", "process_data"]);
    });

    it("should create scopes for nested functions", () => {
      const code = `
def outer():
    def inner():
        def deeply_nested():
            pass
        return deeply_nested
    return inner
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(3);

      const names = function_scopes.map(s => s.name).filter(n => n !== null);
      expect(names).toContain("outer");
      expect(names).toContain("inner");
      expect(names).toContain("deeply_nested");
    });

    it("should create scopes for lambda functions", () => {
      const code = `
square = lambda x: x * 2

numbers = list(map(lambda x: x * 2, range(10)))

funcs = [
    lambda x: x + 1,
    lambda x: x * 2,
    lambda x: x ** 2
]
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      // Should have lambda function scopes
      expect(function_scopes.length).toBeGreaterThan(0);
    });

    it("should handle async functions", () => {
      const code = `
async def fetch_data():
    result = await api_call()
    return result

async def process_async():
    data = await fetch_data()
    return data
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(2);

      const names = function_scopes.map(s => s.name).filter(n => n !== null);
      expect(names).toContain("fetch_data");
      expect(names).toContain("process_async");
    });

    it("should handle generator functions", () => {
      const code = `
def generate_sequence():
    i = 0
    while True:
        yield i
        i += 1

def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(2);
      expect(function_scopes.find(s => s.name === "generate_sequence")).toBeDefined();
      expect(function_scopes.find(s => s.name === "fibonacci")).toBeDefined();
    });

    it("should handle decorators", () => {
      const code = `
@decorator
def decorated_function():
    pass

@property
def getter(self):
    return self._value

@getter.setter
def setter(self, value):
    self._value = value

@staticmethod
def static_method():
    pass

@classmethod
def class_method(cls):
    pass
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Class scopes", () => {
    it("should create scopes for class definitions", () => {
      const code = `
class UserManager:
    def __init__(self):
        self.users = []

    def add_user(self, user):
        self.users.append(user)

class AdminManager(UserManager):
    def __init__(self):
        super().__init__()
        self.permissions = []
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );

      expect(class_scopes).toHaveLength(2);

      const names = class_scopes
        .map(scope => scope.name)
        .filter(name => name !== null)
        .sort();

      expect(names).toEqual(["AdminManager", "UserManager"]);
    });

    it("should create method scopes within classes", () => {
      const code = `
class Calculator:
    def add(self, a, b):
        return a + b

    def multiply(self, a, b):
        return a * b

    def _private_method(self):
        return "private"

    def __dunder_method__(self):
        return "dunder"
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const method_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function" || node.type === "method"
      );

      expect(method_scopes.length).toBeGreaterThanOrEqual(4);

      const names = method_scopes.map(s => s.name).filter(n => n !== null);
      expect(names).toContain("add");
      expect(names).toContain("multiply");
      expect(names).toContain("_private_method");
      expect(names).toContain("__dunder_method__");
    });

    it("should handle nested classes", () => {
      const code = `
class Outer:
    class Inner:
        class DeepNested:
            def method(self):
                pass

        def inner_method(self):
            pass

    def outer_method(self):
        pass
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );

      expect(class_scopes).toHaveLength(3);

      const names = class_scopes.map(s => s.name).filter(n => n !== null);
      expect(names).toContain("Outer");
      expect(names).toContain("Inner");
      expect(names).toContain("DeepNested");
    });

    it("should handle class with properties", () => {
      const code = `
class Person:
    def __init__(self, name):
        self._name = name

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        self._name = value

    @name.deleter
    def name(self):
        del self._name
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const method_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function" || node.type === "method"
      );

      // __init__ and three property methods
      expect(method_scopes.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Comprehensions and generator expressions", () => {
    it("should handle list comprehensions", () => {
      const code = `
result = [x * 2 for x in range(10)]
filtered = [x for x in items if x > 0]
nested = [[i * j for j in range(3)] for i in range(3)]
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      // Comprehensions might create implicit scopes depending on query implementation
      const all_scopes = Array.from(scope_tree.nodes.values());
      expect(all_scopes.length).toBeGreaterThanOrEqual(1); // At least module scope
    });

    it("should handle dict and set comprehensions", () => {
      const code = `
dict_comp = {k: v * 2 for k, v in items.items()}
set_comp = {x * 2 for x in range(10)}
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const all_scopes = Array.from(scope_tree.nodes.values());
      expect(all_scopes.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle generator expressions", () => {
      const code = `
gen = (x * 2 for x in range(10))
filtered_gen = (x for x in items if x > 0)
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const all_scopes = Array.from(scope_tree.nodes.values());
      expect(all_scopes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("With statements", () => {
    it("should handle with statements", () => {
      const code = `
with open('file.txt') as f:
    content = f.read()

with context1() as c1, context2() as c2:
    process(c1, c2)

async def async_context():
    async with aiofiles.open('file.txt') as f:
        content = await f.read()
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      // With statements might create block scopes
      const all_scopes = Array.from(scope_tree.nodes.values());
      expect(all_scopes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Control flow blocks", () => {
    it("should handle if-elif-else blocks", () => {
      const code = `
if condition:
    result = "if"
elif other_condition:
    result = "elif"
else:
    result = "else"
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      // Python doesn't create new scopes for if blocks (unlike JS/TS)
      const all_scopes = Array.from(scope_tree.nodes.values());
      expect(all_scopes.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle for and while loops", () => {
      const code = `
for i in range(10):
    process(i)

while condition:
    update()

for key, value in dictionary.items():
    print(key, value)
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      // Python doesn't create new scopes for loops (unlike JS/TS)
      const all_scopes = Array.from(scope_tree.nodes.values());
      expect(all_scopes.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle try-except blocks", () => {
      const code = `
try:
    risky_operation()
except ValueError as e:
    handle_value_error(e)
except (TypeError, AttributeError) as e:
    handle_other_errors(e)
except:
    handle_generic()
else:
    success()
finally:
    cleanup()
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const all_scopes = Array.from(scope_tree.nodes.values());
      expect(all_scopes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Nested scopes", () => {
    it("should handle deeply nested scopes", () => {
      const code = `
class Outer:
    def method(self):
        def inner():
            lambda_func = lambda x: x * 2
            return lambda_func
        return inner
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const all_scopes = Array.from(scope_tree.nodes.values());
      expect(all_scopes.length).toBeGreaterThanOrEqual(4); // module, class, method, inner
    });

    it("should correctly establish parent-child relationships", () => {
      const code = `
def parent():
    def child1():
        pass
    def child2():
        pass
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const parent_scope = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "parent"
      );
      const child1_scope = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "child1"
      );
      const child2_scope = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "child2"
      );

      expect(parent_scope).toBeDefined();
      expect(child1_scope).toBeDefined();
      expect(child2_scope).toBeDefined();

      expect(parent_scope?.child_ids).toContain(child1_scope?.id);
      expect(parent_scope?.child_ids).toContain(child2_scope?.id);

      expect(child1_scope?.parent_id).toBe(parent_scope?.id);
      expect(child2_scope?.parent_id).toBe(parent_scope?.id);
    });

    it("should handle closures", () => {
      const code = `
def create_counter():
    count = 0

    def increment():
        nonlocal count
        count += 1
        return count

    return increment
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const create_counter = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "create_counter"
      );
      const increment = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "increment"
      );

      expect(create_counter).toBeDefined();
      expect(increment).toBeDefined();

      expect(create_counter?.child_ids).toContain(increment?.id);
      expect(increment?.parent_id).toBe(create_counter?.id);
    });
  });

  describe("Python-specific features", () => {
    it("should handle global and nonlocal declarations", () => {
      const code = `
global_var = 10

def outer():
    outer_var = 20

    def inner():
        global global_var
        nonlocal outer_var
        global_var = 30
        outer_var = 40

    inner()
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(2);
    });

    it("should handle multiple inheritance", () => {
      const code = `
class Base1:
    def method1(self):
        pass

class Base2:
    def method2(self):
        pass

class Derived(Base1, Base2):
    def method3(self):
        pass
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );

      expect(class_scopes).toHaveLength(3);
    });

    it("should handle metaclasses", () => {
      const code = `
class MetaClass(type):
    def __new__(cls, name, bases, dct):
        return super().__new__(cls, name, bases, dct)

class MyClass(metaclass=MetaClass):
    def method(self):
        pass
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );

      expect(class_scopes).toHaveLength(2);
    });

    it("should handle dataclasses", () => {
      const code = `
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

    def distance(self, other):
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );

      expect(class_scopes).toHaveLength(1);
      expect(class_scopes[0].name).toBe("Point");
    });

    it("should handle match statements (Python 3.10+)", () => {
      const code = `
def process(value):
    match value:
        case 0:
            return "zero"
        case [x, y]:
            return f"list: {x}, {y}"
        case {"key": value}:
            return f"dict: {value}"
        case _:
            return "other"
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      // Match statements might create scopes for pattern variables
      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(1);
      expect(function_scopes[0].name).toBe("process");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty file", () => {
      const code = ``;
      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      expect(scope_tree.root_id).toBeDefined();
      expect(scope_tree.nodes.size).toBe(1);
    });

    it("should handle file with only comments", () => {
      const code = `
# This is a comment
"""
Multi-line
docstring
"""
`;
      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      expect(scope_tree.nodes.size).toBe(1);
    });

    it("should handle syntax errors gracefully", () => {
      const code = `
def broken(
    # Missing closing parenthesis
class AlsoBroken
`;
      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;

      expect(() => {
        build_scope_tree(tree.rootNode, file_path, "python");
      }).not.toThrow();
    });

    it("should handle very large files", () => {
      // Generate a large file with many functions
      const functions = [];
      for (let i = 0; i < 100; i++) {
        functions.push(`def func${i}():\n    return ${i}`);
      }
      const code = functions.join('\n\n');

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(100);
    });

    it("should handle unicode identifiers", () => {
      const code = `
def 你好():
    return "Hello in Chinese"

class Κλάση:
    def μέθοδος(self):
        return "Greek class and method"
`;

      const tree = parser.parse(code);
      const file_path = "/test.py" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "python");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );
      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );

      expect(function_scopes.length).toBeGreaterThan(0);
      expect(class_scopes.length).toBeGreaterThan(0);
    });
  });
});