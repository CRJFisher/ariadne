import { describe, test, expect, beforeEach } from "vitest";
import { Project } from "../index";

describe("Source Code Extraction", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  describe("get_source_code", () => {
    test("extracts exact function source", () => {
      const code = `
function greet(name: string) {
  return \`Hello, \${name}!\`;
}

const result = greet('World');
`;

      project.add_or_update_file("test.ts", code);

      const functions = project.get_functions_in_file("test.ts");
      const greetFunc = functions.find((f) => f.name === "greet");
      expect(greetFunc).toBeDefined();

      const source = project.get_source_code(greetFunc!, "test.ts");
      expect(source).toBe(`function greet(name: string) {
  return \`Hello, \${name}!\`;
}`);
    });

    test("extracts single-line function", () => {
      const code = `const add = (a: number, b: number) => a + b;`;

      project.add_or_update_file("test.ts", code);

      const graph = project.get_scope_graph("test.ts");
      const defs = graph!.getNodes("definition");
      const addFunc = defs.find((d) => d.name === "add");

      const source = project.get_source_code(addFunc!, "test.ts");
      expect(source).toBe("add"); // Just the identifier for const definitions
    });

    test("extracts class method source", () => {
      const code = `
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }
}
`;

      project.add_or_update_file("test.ts", code);

      const functions = project.get_functions_in_file("test.ts");
      const addMethod = functions.find((f) => f.name === "add");

      const source = project.get_source_code(addMethod!, "test.ts");
      expect(source).toBe(`add(a: number, b: number): number {
    return a + b;
  }`);
    });

    test("handles missing file gracefully", () => {
      const fakeDef = {
        name: "fake",
        file_path: "non-existent.ts",
        range: {
          start: { row: 0, column: 0 },
          end: { row: 0, column: 10 },
        },
        symbol_kind: "function",
      } as any;

      const source = project.get_source_code(fakeDef, fakeDef.file_path);
      expect(source).toBe("");
    });

    test("handles out-of-bounds ranges gracefully", () => {
      const code = `function test() {}`;
      project.add_or_update_file("test.ts", code);

      const functions = project.get_functions_in_file("test.ts");
      const testFunc = functions.find((f) => f.name === "test");

      // Artificially modify the range to be out of bounds
      const fakeDef = {
        ...testFunc!,
        range: {
          start: { row: 100, column: 0 },
          end: { row: 101, column: 0 },
        },
      };

      const source = project.get_source_code(fakeDef as any, "test.ts");
      expect(source).toBe("");
    });

    test("extracts Python function source", () => {
      const code = `
def calculate(x, y):
    """Calculate sum of x and y."""
    return x + y

result = calculate(1, 2)
`;

      project.add_or_update_file("test.py", code);

      const functions = project.get_functions_in_file("test.py");
      const calcFunc = functions.find((f) => f.name === "calculate");

      const source = project.get_source_code(calcFunc!, "test.py");
      expect(source).toBe(`def calculate(x, y):
    """Calculate sum of x and y."""
    return x + y`);
    });
  });

  describe("get_source_with_context", () => {
    test("extracts JSDoc for TypeScript function", () => {
      const code = `
/**
 * Greets a person by name.
 * @param name - The name of the person
 * @returns A greeting message
 */
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`;

      project.add_or_update_file("test.ts", code);

      const functions = project.get_functions_in_file("test.ts");
      const greetFunc = functions.find((f) => f.name === "greet");

      const result = project.get_source_with_context(greetFunc!, "test.ts");
      expect(result.source).toContain("function greet");
      expect(result.docstring).toBe(
        "Greets a person by name.\n" +
          "@param name - The name of the person\n" +
          "@returns A greeting message"
      );
      expect(result.decorators).toBeUndefined();
    });

    test("extracts Python docstring", () => {
      const code = `
def process_data(data):
    """
    Process the input data.
    
    Args:
        data: The data to process
        
    Returns:
        Processed data
    """
    return data.upper()
`;

      project.add_or_update_file("test.py", code);

      const functions = project.get_functions_in_file("test.py");
      const processFunc = functions.find((f) => f.name === "process_data");

      const result = project.get_source_with_context(processFunc!, "test.py");
      expect(result.source).toContain("def process_data");
      expect(result.docstring).toBe(
        "Process the input data.\n" +
          "    \n" +
          "    Args:\n" +
          "        data: The data to process\n" +
          "        \n" +
          "    Returns:\n" +
          "        Processed data"
      );
    });

    test("extracts Python decorators", () => {
      const code = `
@property
@cached
def expensive_property(self):
    """An expensive computed property."""
    return self._compute_value()

@staticmethod
def utility_function():
    return 42
`;

      project.add_or_update_file("test.py", code);

      const functions = project.get_functions_in_file("test.py");
      const propFunc = functions.find((f) => f.name === "expensive_property");
      const utilFunc = functions.find((f) => f.name === "utility_function");

      const propResult = project.get_source_with_context(propFunc!, "test.py");
      expect(propResult.decorators).toEqual(["@property", "@cached"]);
      expect(propResult.docstring).toBe("An expensive computed property.");

      const utilResult = project.get_source_with_context(utilFunc!, "test.py");
      expect(utilResult.decorators).toEqual(["@staticmethod"]);
    });

    test("includes context lines when requested", () => {
      const code = `
// Some comment before
const PREFIX = 'Hello';

function greet(name: string) {
  return \`\${PREFIX}, \${name}!\`;
}

// Some comment after
const SUFFIX = '!!!';
`;

      project.add_or_update_file("test.ts", code);

      const functions = project.get_functions_in_file("test.ts");
      const greetFunc = functions.find((f) => f.name === "greet");

      const result = project.get_source_with_context(greetFunc!, "test.ts", 2);
      expect(result.source).toContain("const PREFIX");
      expect(result.source).toContain("function greet");
      expect(result.source).toContain("// Some comment after");

      // With 3 context lines, we should also get SUFFIX
      const result3 = project.get_source_with_context(greetFunc!, "test.ts", 3);
      expect(result3.source).toContain("const SUFFIX");
    });

    test("handles single-line Python docstring", () => {
      const code = `
def simple():
    """A simple function."""
    pass
`;

      project.add_or_update_file("test.py", code);

      const functions = project.get_functions_in_file("test.py");
      const simpleFunc = functions.find((f) => f.name === "simple");

      const result = project.get_source_with_context(simpleFunc!, "test.py");
      expect(result.docstring).toBe("A simple function.");
    });

    test("handles missing docstring", () => {
      const code = `
function noDoc() {
  return 42;
}

def no_doc():
    return 42
`;

      project.add_or_update_file("test.ts", code);
      project.add_or_update_file(
        "test.py",
        code.split("\n").slice(4).join("\n")
      );

      const tsFunctions = project.get_functions_in_file("test.ts");
      const tsFunc = tsFunctions.find((f) => f.name === "noDoc");

      const pyFunctions = project.get_functions_in_file("test.py");
      const pyFunc = pyFunctions.find((f) => f.name === "no_doc");

      const tsResult = project.get_source_with_context(tsFunc!, "test.ts");
      expect(tsResult.docstring).toBeUndefined();

      const pyResult = project.get_source_with_context(pyFunc!, "test.py");
      expect(pyResult.docstring).toBeUndefined();
    });

    test("handles edge cases gracefully", () => {
      const fakeDef = {
        name: "fake",
        file_path: "non-existent.ts",
        range: {
          start: { row: 0, column: 0 },
          end: { row: 0, column: 10 },
        },
        symbol_kind: "function",
      } as any;

      const result = project.get_source_with_context(
        fakeDef,
        fakeDef.file_path
      );
      expect(result.source).toBe("");
      expect(result.docstring).toBeUndefined();
      expect(result.decorators).toBeUndefined();
    });

    test("handles decorators with empty lines", () => {
      const code = `
@decorator1

@decorator2
def decorated_func():
    pass
`;

      project.add_or_update_file("test.py", code);

      const functions = project.get_functions_in_file("test.py");
      const func = functions.find((f) => f.name === "decorated_func");

      const result = project.get_source_with_context(func!, "test.py");
      expect(result.decorators).toEqual(["@decorator1", "@decorator2"]);
    });
  });
});
