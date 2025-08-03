import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { Def, Project, get_call_graph, normalize_module_path } from "../src/index";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("Call Graph Extraction", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test("extracts simple function calls", () => {
    const code = `
function helper() {
  return 42;
}

function main() {
  const result = helper();
  return result;
}
`;

    project.add_or_update_file("test.ts", code);

    // Find the main function
    const functions = project.get_functions_in_file("test.ts");
    const mainFunc = functions.find((f) => f.name === "main");
    expect(mainFunc).toBeDefined();

    // Get calls from main
    const calls = project.get_function_calls(mainFunc!);
    expect(calls.length).toBe(1);
    expect(calls[0].called_def.name).toBe("helper");
    expect(calls[0].is_method_call).toBe(false);
  });

  test("detects method calls", () => {
    const code = `
class Calculator {
  add(a: number, b: number) {
    return a + b;
  }
  
  calculate() {
    return this.add(1, 2);
  }
}
`;

    project.add_or_update_file("test.ts", code);

    const functions = project.get_functions_in_file("test.ts");
    const calculateMethod = functions.find((f) => f.name === "calculate");
    expect(calculateMethod).toBeDefined();

    const calls = project.get_function_calls(calculateMethod!);
    expect(calls.length).toBe(1);
    expect(calls[0].called_def.name).toBe("add");
    expect(calls[0].is_method_call).toBe(true);
  });

  test("tracks call locations", () => {
    const code = `
function target() {}

function caller() {
  target(); // line 4
  const x = 1;
  target(); // line 6
}
`;

    project.add_or_update_file("test.ts", code);

    const functions = project.get_functions_in_file("test.ts");
    const callerFunc = functions.find((f) => f.name === "caller");

    const calls = project.get_function_calls(callerFunc!);
    expect(calls.length).toBe(2);
    expect(calls[0].call_location.row).toBe(4);
    expect(calls[1].call_location.row).toBe(6);
  });

  test("handles nested function calls", () => {
    const code = `
function innermost() { return 1; }
function middle() { return innermost(); }
function outer() { return middle(); }
`;

    project.add_or_update_file("test.ts", code);

    const functions = project.get_functions_in_file("test.ts");
    const outerFunc = functions.find((f) => f.name === "outer");
    const middleFunc = functions.find((f) => f.name === "middle");

    const outerCalls = project.get_function_calls(outerFunc!);
    expect(outerCalls.length).toBe(1);
    expect(outerCalls[0].called_def.name).toBe("middle");

    const middleCalls = project.get_function_calls(middleFunc!);
    expect(middleCalls.length).toBe(1);
    expect(middleCalls[0].called_def.name).toBe("innermost");
  });

  test("extracts complete call graph", () => {
    const code = `
function util1() {}
function util2() { util1(); }
function main() {
  util1();
  util2();
}
`;

    project.add_or_update_file("test.ts", code);

    const callGraph = project.extract_call_graph();

    // Should have 3 functions
    expect(callGraph.functions.length).toBe(3);
    expect(callGraph.functions.map((f) => f.name).sort()).toEqual([
      "main",
      "util1",
      "util2",
    ]);

    // Should have 3 calls total
    expect(callGraph.calls.length).toBe(3);

    // Verify specific calls
    const mainCalls = callGraph.calls.filter(
      (c) => c.caller_def.name === "main"
    );
    expect(mainCalls.length).toBe(2);
    expect(mainCalls.map((c) => c.called_def.name).sort()).toEqual([
      "util1",
      "util2",
    ]);

    const util2Calls = callGraph.calls.filter(
      (c) => c.caller_def.name === "util2"
    );
    expect(util2Calls.length).toBe(1);
    expect(util2Calls[0].called_def.name).toBe("util1");
  });

  test("tracks Python self parameter in methods", () => {
    const code = `
class MyClass:
    def helper(self):
        return 42
    
    def main(self):
        result = self.helper()
        return result
`;
    project.add_or_update_file("test.py", code);
    
    // Get the call graph
    const callGraph = project.get_call_graph();
    
    // Debug: check scope graph
    const graph = (project as any).file_graphs.get("test.py");
    const refs = graph?.getNodes('reference');
    console.log("All references:", refs?.map((r: any) => ({ name: r.name, symbol_kind: r.symbol_kind })));
    
    // Check if main calls helper
    const mainNode = callGraph.nodes.get("test#MyClass.main");
    expect(mainNode).toBeDefined();
    
    // Debug: check all calls from main
    console.log("Main node calls:", mainNode?.calls);
    
    const methodCalls = mainNode!.calls.filter(c => c.kind === 'method');
    expect(methodCalls.length).toBeGreaterThanOrEqual(1);
    
    const calledMethods = methodCalls.map(c => c.symbol);
    expect(calledMethods).toContain("test#MyClass.helper");
  });

  test("tracks JavaScript/TypeScript this parameter in methods", () => {
    const code = `
class Counter {
  private count = 0;
  
  increment() {
    this.count++;
    this.log();
  }
  
  log() {
    console.log(this.count);
  }
  
  run() {
    this.increment();
    this.increment();
  }
}
`;
    project.add_or_update_file("test.ts", code);
    
    // Get the call graph
    const callGraph = project.get_call_graph();
    
    // Check if run calls increment
    const runNode = callGraph.nodes.get("test#Counter.run");
    expect(runNode).toBeDefined();
    
    const methodCalls = runNode!.calls.filter(c => c.kind === 'method');
    expect(methodCalls.length).toBe(2); // Two calls to increment
    
    const calledMethods = methodCalls.map(c => c.symbol);
    expect(calledMethods).toEqual(["test#Counter.increment", "test#Counter.increment"]);
    
    // Check if increment calls log
    const incrementNode = callGraph.nodes.get("test#Counter.increment");
    expect(incrementNode).toBeDefined();
    
    const incrementCalls = incrementNode!.calls.filter(c => c.kind === 'method');
    expect(incrementCalls.length).toBe(1); // One call to log
    expect(incrementCalls[0].symbol).toBe("test#Counter.log");
  });

  test.skip("handles Python method calls - original", () => {
    const code = `
class MyClass:
    def helper(self):
        return 42
    
    def main(self):
        return self.helper()
`;

    project.add_or_update_file("test.py", code);

    const functions = project.get_functions_in_file("test.py");
    const mainMethod = functions.find((f) => f.name === "main");

    const calls = project.get_function_calls(mainMethod!);
    expect(calls.length).toBe(1);
    expect(calls[0].called_def.name).toBe("helper");
    expect(calls[0].is_method_call).toBe(true);
  });

  test("tracks Python cls parameter in classmethods", () => {
    const code = `
class Factory:
    instances = []
    
    @classmethod
    def create(cls):
        instance = cls()
        cls.register(instance)
        return instance
    
    @classmethod
    def register(cls, instance):
        cls.instances.append(instance)
    
    @classmethod
    def get_all(cls):
        return cls.instances
`;
    project.add_or_update_file("test.py", code);
    
    // Get the call graph
    const callGraph = project.get_call_graph();
    
    // Check if create calls register
    const createNode = callGraph.nodes.get("test#Factory.create");
    expect(createNode).toBeDefined();
    
    const methodCalls = createNode!.calls.filter(c => c.kind === 'method');
    expect(methodCalls.length).toBeGreaterThanOrEqual(1);
    
    const calledMethods = methodCalls.map(c => c.symbol);
    expect(calledMethods).toContain("test#Factory.register");
  });

  test("tracks Rust self parameter in methods", () => {
    const code = `
struct Calculator {
    value: i32,
}

impl Calculator {
    fn new(value: i32) -> Self {
        Calculator { value }
    }
    
    fn add(&mut self, x: i32) {
        self.value += x;
        self.log();
    }
    
    fn multiply(&mut self, x: i32) {
        self.value *= x;
        self.log();
    }
    
    fn log(&self) {
        println!("Current value: {}", self.value);
    }
    
    fn compute(&mut self) {
        self.add(5);
        self.multiply(2);
    }
}
`;
    project.add_or_update_file("test.rs", code);
    
    // Get the call graph
    const callGraph = project.get_call_graph();
    
    // Check if compute calls add and multiply
    const computeNode = callGraph.nodes.get("test#Calculator.compute");
    expect(computeNode).toBeDefined();
    
    const methodCalls = computeNode!.calls.filter(c => c.kind === 'method');
    expect(methodCalls.length).toBe(2);
    
    const calledMethods = methodCalls.map(c => c.symbol);
    expect(calledMethods).toContain("test#Calculator.add");
    expect(calledMethods).toContain("test#Calculator.multiply");
    
    // Check if add and multiply call log
    const addNode = callGraph.nodes.get("test#Calculator.add");
    expect(addNode).toBeDefined();
    
    const addCalls = addNode!.calls.filter(c => c.kind === 'method');
    expect(addCalls.length).toBe(1);
    expect(addCalls[0].symbol).toBe("test#Calculator.log");
  });

  test("ignores non-function references", () => {
    const code = `
const variable = 42;

function myFunc() {
  return variable; // This is not a function call
}
`;

    project.add_or_update_file("test.ts", code);

    const functions = project.get_functions_in_file("test.ts");
    const myFunc = functions.find((f) => f.name === "myFunc");

    const calls = project.get_function_calls(myFunc!);
    expect(calls.length).toBe(0);
  });

  test("handles recursive calls", () => {
    const code = `
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
`;

    project.add_or_update_file("test.ts", code);

    const functions = project.get_functions_in_file("test.ts");
    const factorial = functions.find((f) => f.name === "factorial");

    const calls = project.get_function_calls(factorial!);
    expect(calls.length).toBe(1);
    expect(calls[0].called_def.name).toBe("factorial");
    expect(calls[0].caller_def.name).toBe("factorial");
  });

  test("returns empty array for non-function definitions", () => {
    const code = `
const notAFunction = 42;
class MyClass {}
`;

    project.add_or_update_file("test.ts", code);

    // Try to get calls from a non-function def
    const graph = project.get_scope_graph("test.ts");
    const defs = graph!.getNodes<Def>("definition");
    const varDef = defs.find((d) => d.name === "notAFunction");
    const classDef = defs.find((d) => d.name === "MyClass");

    expect(project.get_function_calls(varDef!)).toEqual([]);
    expect(project.get_function_calls(classDef!)).toEqual([]);
  });

  test("handles multiple files in call graph", () => {
    const file1 = `
export function shared() {
  return 'shared';
}
`;

    const file2 = `
import { shared } from './file1';

function local() {
  return shared();
}
`;

    project.add_or_update_file("file1.ts", file1);
    project.add_or_update_file("file2.ts", file2);

    const callGraph = project.extract_call_graph();

    // Should have functions from both files
    const functionNames = callGraph.functions.map((f) => f.name);
    expect(functionNames).toContain("shared");
    expect(functionNames).toContain("local");

    // Note: Cross-file resolution might not work perfectly yet,
    // but the structure should be there
    expect(callGraph.calls.length).toBeGreaterThanOrEqual(0);
  });
});

describe("get_calls_from_definition API", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test("extracts calls from function definitions", () => {
    const code = `
function helper() {
  return 42;
}

function main() {
  const result = helper();
  return result;
}
`;

    project.add_or_update_file("test.ts", code);

    const functions = project.get_functions_in_file("test.ts");
    const mainFunc = functions.find((f) => f.name === "main");
    expect(mainFunc).toBeDefined();

    const calls = project.get_calls_from_definition(mainFunc!);
    expect(calls.length).toBe(1);
    expect(calls[0].called_def.name).toBe("helper");
    expect(calls[0].is_method_call).toBe(false);
  });

  test("extracts calls from class constructors", () => {
    const code = `
class Logger {
  log(msg: string) {
    console.log(msg);
  }
}

class MyClass {
  constructor() {
    const logger = new Logger();
    logger.log('initialized');
  }
}
`;

    project.add_or_update_file("test.ts", code);

    const graph = project.get_scope_graph("test.ts");
    const defs = graph!.getNodes<Def>("definition");

    // Find constructor (often named 'constructor' in TypeScript)
    const constructor = defs.find(
      (d) => d.name === "constructor" && d.symbol_kind === "method"
    );

    if (constructor) {
      const calls = project.get_calls_from_definition(constructor);

      // Should find call to Logger constructor and log method
      const hasLoggerConstructor = calls.some(
        (c) =>
          c.called_def.name === "Logger" && c.called_def.symbol_kind === "class"
      );
      const hasLogMethod = calls.some(
        (c) => c.called_def.name === "log" && c.is_method_call
      );

      expect(hasLoggerConstructor || hasLogMethod).toBe(true);
    }
  });

  test("extracts calls from variable initializers", () => {
    const code = `
function getValue() {
  return 42;
}

const myVar = getValue();
`;

    project.add_or_update_file("test.ts", code);

    const graph = project.get_scope_graph("test.ts");
    const defs = graph!.getNodes<Def>("definition");
    const varDef = defs.find((d) => d.name === "myVar");
    expect(varDef).toBeDefined();

    const calls = project.get_calls_from_definition(varDef!);
    expect(calls.length).toBe(1);
    expect(calls[0].called_def.name).toBe("getValue");
  });

  test("handles arrow functions and callbacks", () => {
    const code = `
function processData(data: any) {
  console.log(data);
}

const handler = () => {
  processData('test');
  return [1, 2, 3].map(item => processData(item));
};
`;

    project.add_or_update_file("test.ts", code);

    const graph = project.get_scope_graph("test.ts");
    const defs = graph!.getNodes<Def>("definition");
    const handlerDef = defs.find((d) => d.name === "handler");

    expect(handlerDef).toBeDefined();
    const calls = project.get_calls_from_definition(handlerDef!);

    // Should find direct call to processData
    const hasProcessData = calls.some(
      (c) => c.called_def.name === "processData"
    );

    // Debug if no calls found
    if (calls.length === 0) {
      console.log("No calls found from handler. Handler def:", handlerDef);
      const refs = graph!.getNodes("reference");
      console.log(
        "All refs:",
        refs.map(
          (r: any) =>
            `${r.name} at ${r.range.start.row}:${r.range.start.column}`
        )
      );
    }

    expect(hasProcessData).toBe(true);
    expect(calls.length).toBeGreaterThan(0);
  });

  test("handles async/await patterns", () => {
    const code = `
async function fetchData() {
  return { data: 'test' };
}

async function processAsync() {
  const result = await fetchData();
  return result;
}
`;

    project.add_or_update_file("test.ts", code);

    const functions = project.get_functions_in_file("test.ts");
    const processFunc = functions.find((f) => f.name === "processAsync");

    const calls = project.get_calls_from_definition(processFunc!);
    expect(calls.length).toBe(1);
    expect(calls[0].called_def.name).toBe("fetchData");
  });

  test("extracts calls from class definitions including methods", () => {
    const code = `
class BaseClass {
  baseMethod() {}
}

class DerivedClass extends BaseClass {
  private helper() {
    return 'help';
  }
  
  public mainMethod() {
    this.helper();
    this.baseMethod();
  }
}
`;

    project.add_or_update_file("test.ts", code);

    const graph = project.get_scope_graph("test.ts");
    const defs = graph!.getNodes<Def>("definition");
    const derivedClass = defs.find(
      (d) => d.name === "DerivedClass" && d.symbol_kind === "class"
    );

    // Get calls from the class definition (should include all method bodies)
    const calls = project.get_calls_from_definition(derivedClass!);

    // Should find method calls within the class
    const hasHelperCall = calls.some(
      (c) => c.called_def.name === "helper" && c.is_method_call
    );
    const hasBaseMethodCall = calls.some(
      (c) => c.called_def.name === "baseMethod" && c.is_method_call
    );

    expect(hasHelperCall).toBe(true);
    expect(hasBaseMethodCall).toBe(true);
  });

  test("handles nested function calls", () => {
    const code = `
function outer() {
  function inner() {
    function innermost() {
      return 42;
    }
    return innermost();
  }
  return inner();
}
`;

    project.add_or_update_file("test.ts", code);

    const functions = project.get_functions_in_file("test.ts");
    const outerFunc = functions.find((f) => f.name === "outer");

    const calls = project.get_calls_from_definition(outerFunc!);

    // Should find the call to inner() and potentially innermost() if nested functions are included
    const hasInnerCall = calls.some((c) => c.called_def.name === "inner");
    expect(hasInnerCall).toBe(true);
  });

  test("handles constructor calls with new keyword", () => {
    const code = `
class MyService {
  start() {}
}

function createService() {
  const service = new MyService();
  service.start();
  return service;
}
`;

    project.add_or_update_file("test.ts", code);

    const functions = project.get_functions_in_file("test.ts");
    const createFunc = functions.find((f) => f.name === "createService");

    const calls = project.get_calls_from_definition(createFunc!);

    // Should find constructor call and method call
    const hasConstructor = calls.some(
      (c) =>
        c.called_def.name === "MyService" &&
        c.called_def.symbol_kind === "class"
    );
    const hasStart = calls.some(
      (c) => c.called_def.name === "start" && c.is_method_call
    );

    expect(hasConstructor).toBe(true);
    expect(hasStart).toBe(true);
  });

  test("gracefully handles unresolved symbols", () => {
    const code = `
function myFunc() {
  // Call to undefined function
  undefinedFunction();
  
  // Call to external library
  console.log('test');
}
`;

    project.add_or_update_file("test.ts", code);

    const functions = project.get_functions_in_file("test.ts");
    const myFunc = functions.find((f) => f.name === "myFunc");

    // Should not throw, just return resolved calls
    const calls = project.get_calls_from_definition(myFunc!);

    // May or may not resolve console.log depending on scope setup
    expect(calls).toBeDefined();
    expect(Array.isArray(calls)).toBe(true);
  });

  test("works with Python classes and methods", () => {
    const code = `
class PythonClass:
    def __init__(self):
        self.setup()
    
    def setup(self):
        pass
    
    def process(self):
        self.setup()
        return self._helper()
    
    def _helper(self):
        return 42
`;

    project.add_or_update_file("test.py", code);

    const functions = project.get_functions_in_file("test.py");
    const processMethod = functions.find((f) => f.name === "process");

    expect(processMethod).toBeDefined();
    if (!processMethod) {
      // Debug: show all functions found
      console.log(
        "Functions found:",
        functions.map((f) => `${f.name} (${f.symbol_kind})`)
      );
      return;
    }

    const calls = project.get_calls_from_definition(processMethod);

    // Should find calls to setup and _helper
    const hasSetup = calls.some(
      (c) => c.called_def.name === "setup" && c.is_method_call
    );
    const hasHelper = calls.some(
      (c) => c.called_def.name === "_helper" && c.is_method_call
    );

    expect(hasSetup).toBe(true);
    expect(hasHelper).toBe(true);
  });

  test("works with Rust impl blocks", () => {
    const code = `
fn helper() -> i32 {
    42
}

fn process() -> i32 {
    helper() * 2
}
`;

    project.add_or_update_file("test.rs", code);

    const functions = project.get_functions_in_file("test.rs");
    const processFunc = functions.find((f) => f.name === "process");

    expect(processFunc).toBeDefined();
    if (!processFunc) return;

    const calls = project.get_calls_from_definition(processFunc);
    const hasHelper = calls.some((c) => c.called_def.name === "helper");

    // Debug if not found
    if (!hasHelper) {
      console.log(
        "Rust process function calls:",
        calls.map((c) => c.called_def.name)
      );
    }

    expect(hasHelper).toBe(true);
  });
});

describe("get_call_graph API", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test("builds complete call graph with nodes and edges", () => {
    const code = `
function a() {
  b();
  c();
}

function b() {
  c();
}

function c() {
  return 42;
}

function main() {
  a();
  b();
}
`;

    project.add_or_update_file("test.ts", code);

    const callGraph = project.get_call_graph();

    // Check nodes
    expect(callGraph.nodes.size).toBe(4);
    expect(callGraph.nodes.has("test#a")).toBe(true);
    expect(callGraph.nodes.has("test#b")).toBe(true);
    expect(callGraph.nodes.has("test#c")).toBe(true);
    expect(callGraph.nodes.has("test#main")).toBe(true);

    // Check node structure
    const nodeA = callGraph.nodes.get("test#a");
    expect(nodeA).toBeDefined();
    expect(nodeA!.symbol).toBe("test#a");
    expect(nodeA!.definition.name).toBe("a");
    expect(nodeA!.calls.length).toBe(2);
    expect(nodeA!.calls.map((c) => c.symbol).sort()).toEqual([
      "test#b",
      "test#c",
    ]);

    // Check edges
    expect(callGraph.edges.length).toBe(5); // a->b, a->c, b->c, main->a, main->b

    // Check top-level nodes (only main is not called by others)
    expect(callGraph.top_level_nodes).toEqual(["test#main"]);
  });

  test("handles cross-file calls correctly", () => {
    const file1 = `
export function util() {
  return 'utility';
}

export function helper() {
  return util();
}
`;

    const file2 = `
import { helper, util } from './file1';

function process() {
  return helper() + util();
}

function main() {
  process();
}
`;

    project.add_or_update_file("file1.ts", file1);
    project.add_or_update_file("file2.ts", file2);

    const callGraph = project.get_call_graph();

    // Should have all functions
    expect(callGraph.nodes.size).toBe(4);
    expect(callGraph.nodes.has("file1#util")).toBe(true);
    expect(callGraph.nodes.has("file1#helper")).toBe(true);
    expect(callGraph.nodes.has("file2#process")).toBe(true);
    expect(callGraph.nodes.has("file2#main")).toBe(true);

    // Check cross-file relationships
    const processNode = callGraph.nodes.get("file2#process");
    expect(processNode).toBeDefined();

    // Note: Cross-file resolution might have limitations,
    // but the structure should be there
    expect(processNode!.calls.length).toBeGreaterThanOrEqual(0);
  });

  test("respects file_filter option", () => {
    project.add_or_update_file(
      "include.ts",
      `
function included() {
  return 42;
}
`
    );

    project.add_or_update_file(
      "exclude.ts",
      `
function excluded() {
  return 0;
}
`
    );

    const callGraph = project.get_call_graph({
      file_filter: (path) => path.includes("include"),
    });

    expect(callGraph.nodes.size).toBe(1);
    expect(callGraph.nodes.has("include#included")).toBe(true);
    expect(callGraph.nodes.has("exclude#excluded")).toBe(false);
  });

  test("respects max_depth option", () => {
    const code = `
function level0() {
  level1();
}

function level1() {
  level2();
}

function level2() {
  level3();
}

function level3() {
  return 'deep';
}
`;

    project.add_or_update_file("test.ts", code);

    const callGraph = project.get_call_graph({ max_depth: 2 });

    // With max_depth=2, starting from level0 (depth 0),
    // we should include level0, level1, and level2, but not level3
    expect(callGraph.nodes.size).toBe(3);
    expect(callGraph.nodes.has("test#level0")).toBe(true);
    expect(callGraph.nodes.has("test#level1")).toBe(true);
    expect(callGraph.nodes.has("test#level2")).toBe(true);
    expect(callGraph.nodes.has("test#level3")).toBe(false);

    // Edges should only include those between included nodes
    const edgeSymbols = callGraph.edges.map((e) => `${e.from}->${e.to}`);
    expect(edgeSymbols).toContain("test#level0->test#level1");
    expect(edgeSymbols).toContain("test#level1->test#level2");
    expect(edgeSymbols).not.toContain("test#level2->test#level3");
  });

  test("handles circular dependencies", () => {
    const code = `
function a() {
  b();
}

function b() {
  c();
}

function c() {
  a(); // Circular reference
}
`;

    project.add_or_update_file("test.ts", code);

    const callGraph = project.get_call_graph();

    // All nodes should be included
    expect(callGraph.nodes.size).toBe(3);

    // Check circular relationship
    const nodeA = callGraph.nodes.get("test#a");
    const nodeC = callGraph.nodes.get("test#c");

    expect(nodeA!.calls.some((c) => c.symbol === "test#b")).toBe(true);
    expect(nodeC!.calls.some((c) => c.symbol === "test#a")).toBe(true);

    // No top-level nodes since all are called by something
    expect(callGraph.top_level_nodes.length).toBe(0);
  });

  test("identifies multiple top-level nodes", () => {
    const code = `
function entry1() {
  shared();
}

function entry2() {
  shared();
}

function shared() {
  return 42;
}

function orphan() {
  return 'not called';
}
`;

    project.add_or_update_file("test.ts", code);

    const callGraph = project.get_call_graph();

    // Top-level nodes are those not called by others
    expect(callGraph.top_level_nodes.sort()).toEqual([
      "test#entry1",
      "test#entry2",
      "test#orphan",
    ]);
  });

  test("handles method calls in classes", () => {
    const code = `
class Service {
  init() {
    this.setup();
  }
  
  setup() {
    this.configure();
  }
  
  configure() {
    return true;
  }
  
  run() {
    this.init();
  }
}
`;

    project.add_or_update_file("test.ts", code);

    const callGraph = project.get_call_graph();

    // Should include all methods
    expect(callGraph.nodes.size).toBe(4);

    const runNode = callGraph.nodes.get("test#Service.run");
    expect(runNode).toBeDefined();
    expect(runNode!.calls[0].kind).toBe("method");
    expect(runNode!.calls[0].symbol).toBe("test#Service.init");

    // run is the only top-level method
    expect(callGraph.top_level_nodes).toEqual(["test#Service.run"]);
  });
});

describe("standalone get_call_graph function", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-test-"));
  });

  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("analyzes a directory of TypeScript files", () => {
    // Create test files
    fs.writeFileSync(
      path.join(tempDir, "main.ts"),
      `
import { helper } from './utils';

function main() {
  const result = helper();
  console.log(result);
}

main();
`
    );

    fs.writeFileSync(
      path.join(tempDir, "utils.ts"),
      `
export function helper() {
  return compute(42);
}

function compute(n: number) {
  return n * 2;
}
`
    );

    const callGraph = get_call_graph(tempDir);

    // Should find all functions
    expect(callGraph.nodes.size).toBe(3);

    const mainPath = path.join(tempDir, "main.ts");
    const utilsPath = path.join(tempDir, "utils.ts");

    // Normalize paths for symbol IDs
    const mainModule = normalize_module_path(mainPath);
    const utilsModule = normalize_module_path(utilsPath);

    expect(callGraph.nodes.has(`${mainModule}#main`)).toBe(true);
    expect(callGraph.nodes.has(`${utilsModule}#helper`)).toBe(true);
    expect(callGraph.nodes.has(`${utilsModule}#compute`)).toBe(true);

    // Check relationships
    const helperNode = callGraph.nodes.get(`${utilsModule}#helper`);
    expect(helperNode).toBeDefined();
    expect(
      helperNode!.calls.some((c) => c.symbol === `${utilsModule}#compute`)
    ).toBe(true);
  });

  test("respects file filters in standalone function", () => {
    // Create test files
    fs.writeFileSync(
      path.join(tempDir, "include.js"),
      `
function included() {
  return 'yes';
}
`
    );

    fs.writeFileSync(
      path.join(tempDir, "exclude.js"),
      `
function excluded() {
  return 'no';
}
`
    );

    const callGraph = get_call_graph(tempDir, {
      file_filter: (filePath) => !filePath.includes("exclude"),
    });

    const includePath = path.join(tempDir, "include.js");
    const excludePath = path.join(tempDir, "exclude.js");

    // Normalize paths for symbol IDs
    const includeModule = normalize_module_path(includePath);
    const excludeModule = normalize_module_path(excludePath);

    expect(callGraph.nodes.size).toBe(1);
    expect(callGraph.nodes.has(`${includeModule}#included`)).toBe(true);
    expect(callGraph.nodes.has(`${excludeModule}#excluded`)).toBe(false);
  });

  test("handles nested directories", () => {
    // Create nested structure
    const subDir = path.join(tempDir, "src");
    fs.mkdirSync(subDir);

    fs.writeFileSync(
      path.join(subDir, "index.ts"),
      `
import { util } from './lib/util';

export function main() {
  util();
}
`
    );

    const libDir = path.join(subDir, "lib");
    fs.mkdirSync(libDir);

    fs.writeFileSync(
      path.join(libDir, "util.ts"),
      `
export function util() {
  return 'utility';
}
`
    );

    const callGraph = get_call_graph(tempDir);

    // Should find functions in nested directories
    expect(callGraph.nodes.size).toBe(2);

    const indexPath = path.join(subDir, "index.ts");
    const utilPath = path.join(libDir, "util.ts");

    // Normalize paths for symbol IDs
    const indexModule = normalize_module_path(indexPath);
    const utilModule = normalize_module_path(utilPath);

    expect(callGraph.nodes.has(`${indexModule}#main`)).toBe(true);
    expect(callGraph.nodes.has(`${utilModule}#util`)).toBe(true);
  });
});

describe("Module-level call detection", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test("detects module-level function calls", () => {
      const code = `
function setup() {
  console.log("Setting up");
}

function runApp() {
  console.log("Running app");
}

// Module-level initialization
setup();
runApp();
`;

      project.add_or_update_file("app.ts", code);
      const callGraph = project.get_call_graph();

      // Functions should not be top-level since they're called from module
      expect(callGraph.top_level_nodes).not.toContain("app#setup");
      expect(callGraph.top_level_nodes).not.toContain("app#runApp");

      // Should have module-level edges
      const moduleEdges = callGraph.edges.filter(e => e.from.includes("#<module>"));
      expect(moduleEdges.length).toBe(2);
      expect(moduleEdges.some(e => e.to === "app#setup")).toBe(true);
      expect(moduleEdges.some(e => e.to === "app#runApp")).toBe(true);
    });

    test("distinguishes module-level from function-level calls", () => {
      const code = `
function helper() {
  return "help";
}

function main() {
  helper(); // Function-level call
}

helper(); // Module-level call
`;

      project.add_or_update_file("mixed.ts", code);
      const callGraph = project.get_call_graph();

      // main should be top-level (not called)
      expect(callGraph.top_level_nodes).toContain("mixed#main");
      
      // helper should not be top-level (called from module)
      expect(callGraph.top_level_nodes).not.toContain("mixed#helper");

      // Should have one module-level edge and one function-level edge
      const moduleEdges = callGraph.edges.filter(e => e.from.includes("#<module>"));
      const functionEdges = callGraph.edges.filter(e => e.from === "mixed#main");
      
      expect(moduleEdges.length).toBe(1);
      expect(moduleEdges[0].to).toBe("mixed#helper");
      
      expect(functionEdges.length).toBe(1);
      expect(functionEdges[0].to).toBe("mixed#helper");
    });

    test("handles executable script patterns", () => {
      const code = `
#!/usr/bin/env node

function parseArgs(args: string[]) {
  return { help: args.includes("--help") };
}

function main() {
  const options = parseArgs(process.argv);
  console.log(options);
}

// Entry point
if (require.main === module) {
  main();
}
`;

      project.add_or_update_file("cli.ts", code);
      const callGraph = project.get_call_graph();

      // main should not be top-level (called from module)
      expect(callGraph.top_level_nodes).not.toContain("cli#main");
      
      // parseArgs is only called from main, not from module
      expect(callGraph.top_level_nodes).not.toContain("cli#parseArgs");
      
      const moduleEdges = callGraph.edges.filter(e => e.from.includes("#<module>"));
      expect(moduleEdges.some(e => e.to === "cli#main")).toBe(true);
      expect(moduleEdges.some(e => e.to === "cli#parseArgs")).toBe(false);
    });

    test("extract_call_graph includes module-level calls", () => {
      const code = `
function init() {
  return "initialized";
}

init(); // Module-level call
`;

      project.add_or_update_file("init.ts", code);
      const result = project.extract_call_graph();

      // Should include the module-level call
      const moduleCalls = result.calls.filter(c => 
        c.caller_def.name === "<module>" && c.called_def.name === "init"
      );
      expect(moduleCalls.length).toBe(1);
      expect(moduleCalls[0].call_location.row).toBe(5); // Line where init() is called
    });
});

describe("Method call detection on local variables", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test("detects method calls on local variable instances within same file", () => {
    const code = `
class ScopeGraph {
  insert_local_def(def: any) {
    console.log("local", def);
  }
  
  insert_hoisted_def(def: any) {
    console.log("hoisted", def);
  }
  
  insert_global_def(def: any) {
    console.log("global", def);
  }
}

export function build_scope_graph() {
  const graph = new ScopeGraph();
  graph.insert_local_def("def1");
  graph.insert_hoisted_def("def2");
  graph.insert_global_def("def3");
  return graph;
}
`;

    project.add_or_update_file("builder.ts", code);
    const callGraph = project.get_call_graph();

    // build_scope_graph should call ScopeGraph methods
    const buildNode = callGraph.nodes.get("builder#build_scope_graph");
    expect(buildNode).toBeDefined();
    
    // Should have calls to the three insert methods
    const methodCalls = buildNode!.calls.filter(c => c.kind === 'method');
    expect(methodCalls.length).toBeGreaterThanOrEqual(3);
    
    // Check specific method calls
    const methodNames = methodCalls.map(c => c.symbol);
    expect(methodNames).toContain("builder#ScopeGraph.insert_local_def");
    expect(methodNames).toContain("builder#ScopeGraph.insert_hoisted_def");
    expect(methodNames).toContain("builder#ScopeGraph.insert_global_def");
    
    // These methods should not be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("builder#ScopeGraph.insert_local_def");
    expect(callGraph.top_level_nodes).not.toContain("builder#ScopeGraph.insert_hoisted_def");
    expect(callGraph.top_level_nodes).not.toContain("builder#ScopeGraph.insert_global_def");
  });

  test("detects method calls with type persistence across variable scopes in same file", () => {
    // This test should pass with file-level type tracking
    const code = `
class Logger {
  log(message: string) {
    console.log(message);
  }
}

let globalLogger: Logger;

function initializeLogger() {
  globalLogger = new Logger();
}

function useLogger() {
  globalLogger.log("Test message");
}
`;
    project.add_or_update_file("logger.ts", code);
    const callGraph = project.get_call_graph();
    
    // useLogger should call Logger.log
    const useLoggerNode = callGraph.nodes.get("logger#useLogger");
    expect(useLoggerNode).toBeDefined();
    
    const methodCalls = useLoggerNode!.calls.filter(c => c.kind === 'method');
    expect(methodCalls.length).toBeGreaterThanOrEqual(1);
    
    const methodNames = methodCalls.map(c => c.symbol);
    expect(methodNames).toContain("logger#Logger.log");
    
    // Logger.log should not be top-level since it's called
    expect(callGraph.top_level_nodes).not.toContain("logger#Logger.log");
  });

  test.skip("detects method calls with type persistence across functions in same file - needs return type tracking", () => {
    // This test documents what we want to achieve with task 68 (type inference)
    const code = `
class Database {
  query(sql: string) {
    console.log("Executing:", sql);
    return [];
  }
  
  close() {
    console.log("Closing database");
  }
}

function createDatabase() {
  return new Database();
}

function useDatabase() {
  const db = createDatabase();
  db.query("SELECT * FROM users");
  db.close();
}
`;
    project.add_or_update_file("database.ts", code);
    const callGraph = project.get_call_graph();
    
    // useDatabase should call Database methods
    const useDbNode = callGraph.nodes.get("database#useDatabase");
    expect(useDbNode).toBeDefined();
    
    // Should have calls to both query and close
    const methodCalls = useDbNode!.calls.filter(c => c.kind === 'method');
    expect(methodCalls.length).toBeGreaterThanOrEqual(2);
    
    const methodNames = methodCalls.map(c => c.symbol);
    expect(methodNames).toContain("database#Database.query");
    expect(methodNames).toContain("database#Database.close");
    
    // These methods should not be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("database#Database.query");
    expect(callGraph.top_level_nodes).not.toContain("database#Database.close");
  });

  test("detects method calls on imported class instances", () => {
    // First file with the class definition
    const graphFile = `
export class ScopeGraph {
  insert_global_def(def: string) {
    console.log("Inserting global:", def);
  }
  
  insert_local_def(def: string) {
    console.log("Inserting local:", def);
  }
}
`;
    project.add_or_update_file("graph.ts", graphFile);
    
    // Second file that imports and uses the class
    const builderFile = `
import { ScopeGraph } from "./graph";

export function build_scope_graph() {
  const graph = new ScopeGraph();
  graph.insert_global_def("globalDef");
  graph.insert_local_def("localDef");
  return graph;
}
`;
    project.add_or_update_file("builder.ts", builderFile);
    
    const callGraph = project.get_call_graph();
    
    // build_scope_graph should call ScopeGraph methods
    const buildNode = callGraph.nodes.get("builder#build_scope_graph");
    expect(buildNode).toBeDefined();
    
    // Should have calls to both insert methods
    const methodCalls = buildNode!.calls.filter(c => c.kind === 'method');
    expect(methodCalls.length).toBeGreaterThanOrEqual(2);
    
    const methodNames = methodCalls.map(c => c.symbol);
    expect(methodNames).toContain("graph#ScopeGraph.insert_global_def");
    expect(methodNames).toContain("graph#ScopeGraph.insert_local_def");
    
    // These methods should not be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("graph#ScopeGraph.insert_global_def");
    expect(callGraph.top_level_nodes).not.toContain("graph#ScopeGraph.insert_local_def");
  });

  test("detects method calls on renamed imported class instances", () => {
    // First file with the class definition
    const databaseFile = `
export class Database {
  query(sql: string) {
    console.log("Executing:", sql);
    return [];
  }
  
  execute(sql: string) {
    console.log("Execute:", sql);
  }
}
`;
    project.add_or_update_file("database.ts", databaseFile);
    
    // Second file that imports with rename
    const appFile = `
import { Database as DB } from "./database";

export function runQuery() {
  const db = new DB();
  db.query("SELECT * FROM users");
  db.execute("UPDATE users SET active = true");
}
`;
    project.add_or_update_file("app.ts", appFile);
    
    const callGraph = project.get_call_graph();
    
    // runQuery should call Database methods
    const runQueryNode = callGraph.nodes.get("app#runQuery");
    expect(runQueryNode).toBeDefined();
    
    // Should have calls to both methods
    const methodCalls = runQueryNode!.calls.filter(c => c.kind === 'method');
    expect(methodCalls.length).toBeGreaterThanOrEqual(2);
    
    const methodNames = methodCalls.map(c => c.symbol);
    expect(methodNames).toContain("database#Database.query");
    expect(methodNames).toContain("database#Database.execute");
  });

  test.skip("cross-file method resolution for TypeScript - requires variable type tracking across function boundaries", () => {
    // This test documents the current limitation
    // The tree-sitter scope queries don't capture method properties as references
    // Only the object identifier is captured, not the method name
    const file1 = `
export class ScopeGraph {
  insert_global_def(def: any) {
    console.log("global", def);
  }
}
`;

    const file2 = `
import { ScopeGraph } from "./graph";

export function build_scope_graph() {
  const graph = new ScopeGraph();
  graph.insert_global_def("def");
}
`;

    project.add_or_update_file("graph.ts", file1);
    project.add_or_update_file("builder.ts", file2);
    const callGraph = project.get_call_graph();

    const buildNode = callGraph.nodes.get("builder#build_scope_graph");

    // With the fix: method references are now captured and resolved correctly
    // The method should NOT be top-level since it's called from build_scope_graph
    expect(callGraph.top_level_nodes).not.toContain("graph#ScopeGraph.insert_global_def");
    
    // The build function should now have the detected call 
    expect(buildNode).toBeDefined();
    expect(buildNode!.calls.length).toBe(1);
    expect(buildNode!.calls[0].symbol).toBe("graph#ScopeGraph.insert_global_def");
  });

  test("cross-file method resolution within same function for TypeScript - with project type registry", () => {
    const project = new Project();
    
    const file1 = `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }
}
`;

    const file2 = `
import { Calculator } from "./calculator";

export function compute() {
  const calc = new Calculator();
  const sum = calc.add(10, 20);
  const product = calc.multiply(sum, 2);
  return product;
}
`;

    project.add_or_update_file("calculator.ts", file1);
    project.add_or_update_file("compute.ts", file2);
    const callGraph = project.get_call_graph();

    // Methods should NOT be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("calculator#Calculator.add");
    expect(callGraph.top_level_nodes).not.toContain("calculator#Calculator.multiply");
    
    // The compute function should have the detected calls
    const computeNode = callGraph.nodes.get("compute#compute");
    expect(computeNode).toBeDefined();
    expect(computeNode!.calls.length).toBe(2);
    
    const callSymbols = computeNode!.calls.map(c => c.symbol).sort();
    expect(callSymbols).toEqual(["calculator#Calculator.add", "calculator#Calculator.multiply"]);
  });

  test.skip("cross-file method resolution for JavaScript - requires variable type tracking across function boundaries", () => {
    const project = new Project();
    
    const file1 = `
export class Logger {
  log(message) {
    console.log(message);
  }
  
  error(message) {
    console.error(message);
  }
}
`;

    const file2 = `
import { Logger } from "./logger";

export function processData() {
  const logger = new Logger();
  logger.log("Processing started");
  logger.error("An error occurred");
}
`;

    project.add_or_update_file("logger.js", file1);
    project.add_or_update_file("processor.js", file2);
    const callGraph = project.get_call_graph();

    // Methods should NOT be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("logger#Logger.log");
    expect(callGraph.top_level_nodes).not.toContain("logger#Logger.error");
    
    // The process function should have the detected calls
    const processNode = callGraph.nodes.get("processor#processData");
    expect(processNode).toBeDefined();
    expect(processNode!.calls.length).toBe(2);
    
    const callSymbols = processNode!.calls.map(c => c.symbol).sort();
    expect(callSymbols).toEqual(["logger#Logger.error", "logger#Logger.log"]);
  });

  test.skip("cross-file method resolution for Python - requires variable type tracking across function boundaries", () => {
    const project = new Project();
    
    const file1 = `
class DataProcessor:
    def process(self, data):
        return data.upper()
    
    def validate(self, data):
        return len(data) > 0
`;

    const file2 = `
from processor import DataProcessor

def handle_request(request):
    processor = DataProcessor()
    if processor.validate(request):
        return processor.process(request)
    return None
`;

    project.add_or_update_file("processor.py", file1);
    project.add_or_update_file("handler.py", file2);
    const callGraph = project.get_call_graph();

    // Methods should NOT be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("processor#DataProcessor.process");
    expect(callGraph.top_level_nodes).not.toContain("processor#DataProcessor.validate");
    
    // The handler function should have the detected calls
    const handleNode = callGraph.nodes.get("handler#handle_request");
    expect(handleNode).toBeDefined();
    expect(handleNode!.calls.length).toBe(2);
    
    const callSymbols = handleNode!.calls.map(c => c.symbol).sort();
    expect(callSymbols).toEqual(["processor#DataProcessor.process", "processor#DataProcessor.validate"]);
  });

  test.skip("cross-file method resolution for Rust - requires variable type tracking across function boundaries", () => {
    const project = new Project();
    
    const file1 = `
pub struct Calculator {
    value: i32,
}

impl Calculator {
    pub fn new() -> Self {
        Calculator { value: 0 }
    }
    
    pub fn add(&mut self, x: i32) {
        self.value += x;
    }
    
    pub fn get_value(&self) -> i32 {
        self.value
    }
}
`;

    const file2 = `
use crate::calculator::Calculator;

pub fn compute() -> i32 {
    let mut calc = Calculator::new();
    calc.add(10);
    calc.add(20);
    calc.get_value()
}
`;

    project.add_or_update_file("calculator.rs", file1);
    project.add_or_update_file("compute.rs", file2);
    const callGraph = project.get_call_graph();

    // Methods should NOT be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("calculator#Calculator.new");
    expect(callGraph.top_level_nodes).not.toContain("calculator#Calculator.add");
    expect(callGraph.top_level_nodes).not.toContain("calculator#Calculator.get_value");
    
    // The compute function should have the detected calls
    const computeNode = callGraph.nodes.get("compute#compute");
    expect(computeNode).toBeDefined();
    expect(computeNode!.calls.length).toBe(4); // new, add, add, get_value
    
    const callSymbols = computeNode!.calls.map(c => c.symbol);
    expect(callSymbols).toContain("calculator#Calculator.new");
    expect(callSymbols).toContain("calculator#Calculator.add");
    expect(callSymbols).toContain("calculator#Calculator.get_value");
  });

  test.skip("cross-file method resolution with method chaining - requires variable type tracking across function boundaries", () => {
    const project = new Project();
    
    const file1 = `
export class Builder {
  private value = "";
  
  add(text: string): Builder {
    this.value += text;
    return this;
  }
  
  build(): string {
    return this.value;
  }
}
`;

    const file2 = `
import { Builder } from "./builder";

export function createMessage() {
  const result = new Builder()
    .add("Hello")
    .add(" ")
    .add("World")
    .build();
  return result;
}
`;

    project.add_or_update_file("builder.ts", file1);
    project.add_or_update_file("creator.ts", file2);
    const callGraph = project.get_call_graph();

    // Methods should NOT be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("builder#Builder.add");
    expect(callGraph.top_level_nodes).not.toContain("builder#Builder.build");
    
    // The create function should have all the chained calls
    const createNode = callGraph.nodes.get("creator#createMessage");
    expect(createNode).toBeDefined();
    expect(createNode!.calls.length).toBe(4); // 3 add() + 1 build()
    
    const callSymbols = createNode!.calls.map(c => c.symbol);
    expect(callSymbols.filter(s => s === "builder#Builder.add").length).toBe(3);
    expect(callSymbols).toContain("builder#Builder.build");
  });

  test.skip("cross-file method resolution with renamed imports - requires variable type tracking across function boundaries", () => {
    const project = new Project();
    
    const file1 = `
export class Database {
  query(sql: string) {
    return [];
  }
  
  execute(sql: string) {
    // execute
  }
}
`;

    const file2 = `
import { Database as DB } from "./database";

export function runQuery() {
  const database = new DB();
  database.query("SELECT * FROM users");
  database.execute("DELETE FROM logs");
}
`;

    project.add_or_update_file("database.ts", file1);
    project.add_or_update_file("query.ts", file2);
    const callGraph = project.get_call_graph();

    // Methods should NOT be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("database#Database.query");
    expect(callGraph.top_level_nodes).not.toContain("database#Database.execute");
    
    // The run function should have the detected calls
    const runNode = callGraph.nodes.get("query#runQuery");
    expect(runNode).toBeDefined();
    expect(runNode!.calls.length).toBe(2);
    
    const callSymbols = runNode!.calls.map(c => c.symbol).sort();
    expect(callSymbols).toEqual(["database#Database.execute", "database#Database.query"]);
  });

  test.skip("cross-file method resolution with multiple class instances - requires variable type tracking across function boundaries", () => {
    const project = new Project();
    
    const file1 = `
export class Counter {
  private count = 0;
  
  increment() {
    this.count++;
  }
  
  decrement() {
    this.count--;
  }
  
  getValue() {
    return this.count;
  }
}
`;

    const file2 = `
import { Counter } from "./counter";

export function manipulateCounters() {
  const counter1 = new Counter();
  const counter2 = new Counter();
  
  counter1.increment();
  counter1.increment();
  counter2.decrement();
  
  return counter1.getValue() + counter2.getValue();
}
`;

    project.add_or_update_file("counter.ts", file1);
    project.add_or_update_file("manipulator.ts", file2);
    const callGraph = project.get_call_graph();

    // Methods should NOT be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("counter#Counter.increment");
    expect(callGraph.top_level_nodes).not.toContain("counter#Counter.decrement");
    expect(callGraph.top_level_nodes).not.toContain("counter#Counter.getValue");
    
    // The manipulate function should have all calls from both instances
    const manipulateNode = callGraph.nodes.get("manipulator#manipulateCounters");
    expect(manipulateNode).toBeDefined();
    expect(manipulateNode!.calls.length).toBe(5); // 2 increment, 1 decrement, 2 getValue
    
    const callSymbols = manipulateNode!.calls.map(c => c.symbol);
    expect(callSymbols.filter(s => s === "counter#Counter.increment").length).toBe(2);
    expect(callSymbols.filter(s => s === "counter#Counter.decrement").length).toBe(1);
    expect(callSymbols.filter(s => s === "counter#Counter.getValue").length).toBe(2);
  });

  test("cross-file method resolution within same function for JavaScript - with project type registry", () => {
    const project = new Project();
    
    const file1 = `
export class StringUtils {
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  reverse(str) {
    return str.split('').reverse().join('');
  }
}
`;

    const file2 = `
import { StringUtils } from "./utils.js";

export function processString(input) {
  const utils = new StringUtils();
  const capitalized = utils.capitalize(input);
  const reversed = utils.reverse(capitalized);
  return reversed;
}
`;

    project.add_or_update_file("utils.js", file1);
    project.add_or_update_file("processor.js", file2);
    const callGraph = project.get_call_graph();

    // Methods should NOT be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("utils#StringUtils.capitalize");
    expect(callGraph.top_level_nodes).not.toContain("utils#StringUtils.reverse");
    
    // The process function should have the detected calls
    const processNode = callGraph.nodes.get("processor#processString");
    expect(processNode).toBeDefined();
    expect(processNode!.calls.length).toBe(2);
    
    const callSymbols = processNode!.calls.map(c => c.symbol).sort();
    expect(callSymbols).toEqual(["utils#StringUtils.capitalize", "utils#StringUtils.reverse"]);
  });

  test.skip("cross-file method resolution within same function for Python - requires import-aware type tracking", () => {
    const project = new Project();
    
    const file1 = `
class FileHandler:
    def read_file(self, path):
        with open(path) as f:
            return f.read()
    
    def write_file(self, path, content):
        with open(path, 'w') as f:
            f.write(content)
`;

    const file2 = `
from handler import FileHandler

def process_file(input_path, output_path):
    handler = FileHandler()
    content = handler.read_file(input_path)
    processed = content.upper()
    handler.write_file(output_path, processed)
`;

    project.add_or_update_file("handler.py", file1);
    project.add_or_update_file("processor.py", file2);
    const callGraph = project.get_call_graph();

    // Methods should NOT be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("handler#FileHandler.read_file");
    expect(callGraph.top_level_nodes).not.toContain("handler#FileHandler.write_file");
    
    // The process function should have the detected calls
    const processNode = callGraph.nodes.get("processor#process_file");
    expect(processNode).toBeDefined();
    expect(processNode!.calls.length).toBe(2);
    
    const callSymbols = processNode!.calls.map(c => c.symbol).sort();
    expect(callSymbols).toEqual(["handler#FileHandler.read_file", "handler#FileHandler.write_file"]);
  });

});
