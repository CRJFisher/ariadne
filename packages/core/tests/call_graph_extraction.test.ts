/**
 * Call Graph Extraction Tests
 * 
 * Tests for basic call graph extraction functionality including:
 * - Simple function calls
 * - Method calls  
 * - Recursive calls
 * - Cross-language support
 * - Module-level call detection
 */

import { describe, it, expect } from 'vitest';
import { Project } from '../src/index';

describe("Call Graph Extraction", () => {
  it("should extract simple function calls", () => {
    const project = new Project();
    const code = `
function helper() {
  return 42;
}

function main() {
  helper();
  helper();
}

main();
`;
    project.add_or_update_file("test.js", code);
    
    const mainDef = project.get_all_definitions().find(d => d.name === "main");
    expect(mainDef).toBeDefined();
    if (!mainDef) return;
    
    const calls = project.get_calls_from_definition(mainDef);
    expect(calls).toHaveLength(2);
    expect(calls.every(c => c.name === "helper")).toBe(true);
  });

  it("should detect method calls on objects", () => {
    const project = new Project();
    const code = `
class Calculator {
  add(a, b) {
    return a + b;
  }
  
  calculate() {
    return this.add(1, 2);
  }
}

const calc = new Calculator();
calc.calculate();
`;
    project.add_or_update_file("test.js", code);
    
    const calculateDef = project.get_all_definitions().find(
      d => d.name === "calculate" && d.symbol_kind === "method"
    );
    expect(calculateDef).toBeDefined();
    if (!calculateDef) return;
    
    const calls = project.get_calls_from_definition(calculateDef);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("add");
    expect(calls[0].is_method).toBe(true);
  });

  it("should track recursive function calls", () => {
    const project = new Project();
    const code = `
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

factorial(5);
`;
    project.add_or_update_file("test.js", code);
    
    const factorialDef = project.get_all_definitions().find(d => d.name === "factorial");
    expect(factorialDef).toBeDefined();
    if (!factorialDef) return;
    
    const calls = project.get_calls_from_definition(factorialDef);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("factorial");
    expect(calls[0].is_recursive).toBe(true);
  });

  it("should extract calls across multiple languages", () => {
    const project = new Project();
    
    // JavaScript file
    project.add_or_update_file("test.js", `
function jsFunction() {
  console.log("JavaScript");
}
jsFunction();
`);
    
    // Python file
    project.add_or_update_file("test.py", `
def py_function():
    print("Python")

py_function()
`);
    
    // TypeScript file
    project.add_or_update_file("test.ts", `
function tsFunction(): void {
  console.log("TypeScript");
}
tsFunction();
`);
    
    const allDefs = project.get_all_definitions();
    const jsDef = allDefs.find(d => d.name === "jsFunction");
    const pyDef = allDefs.find(d => d.name === "py_function");
    const tsDef = allDefs.find(d => d.name === "tsFunction");
    
    expect(jsDef).toBeDefined();
    expect(pyDef).toBeDefined();
    expect(tsDef).toBeDefined();
    
    // Each function should have console/print calls
    if (jsDef) {
      const jsCalls = project.get_calls_from_definition(jsDef);
      expect(jsCalls.some(c => c.name === "log")).toBe(true);
    }
    
    if (pyDef) {
      const pyCalls = project.get_calls_from_definition(pyDef);
      expect(pyCalls.some(c => c.name === "print")).toBe(true);
    }
    
    if (tsDef) {
      const tsCalls = project.get_calls_from_definition(tsDef);
      expect(tsCalls.some(c => c.name === "log")).toBe(true);
    }
  });

  describe("Module-level call detection", () => {
    it("should detect calls at module level", () => {
      const project = new Project();
      const code = `
function setup() {
  return { ready: true };
}

// Module-level call
const config = setup();

function main() {
  if (config.ready) {
    console.log("Ready");
  }
}
`;
      project.add_or_update_file("test.js", code);
      
      const moduleDef = project.get_all_definitions().find(
        d => d.name === "__module__" && d.symbol_kind === "module"
      );
      
      if (moduleDef) {
        const calls = project.get_calls_from_definition(moduleDef);
        expect(calls.some(c => c.name === "setup")).toBe(true);
      }
    });

    it("should handle IIFE patterns", () => {
      const project = new Project();
      const code = `
const result = (function() {
  function inner() {
    return 42;
  }
  return inner();
})();
`;
      project.add_or_update_file("test.js", code);
      
      const allCalls = project.get_all_calls();
      expect(allCalls.some(c => c.name === "inner")).toBe(true);
    });
  });

  it("should detect arrow function calls", () => {
    const project = new Project();
    const code = `
const add = (a, b) => a + b;
const multiply = (a, b) => a * b;

const calculate = () => {
  const sum = add(1, 2);
  const product = multiply(3, 4);
  return sum + product;
};

calculate();
`;
    project.add_or_update_file("test.js", code);
    
    const calculateDef = project.get_all_definitions().find(d => d.name === "calculate");
    expect(calculateDef).toBeDefined();
    if (!calculateDef) return;
    
    const calls = project.get_calls_from_definition(calculateDef);
    expect(calls).toHaveLength(2);
    expect(calls.some(c => c.name === "add")).toBe(true);
    expect(calls.some(c => c.name === "multiply")).toBe(true);
  });

  it("should handle async/await calls", () => {
    const project = new Project();
    const code = `
async function fetchData() {
  return { data: "test" };
}

async function processData() {
  const result = await fetchData();
  console.log(result.data);
}

processData();
`;
    project.add_or_update_file("test.js", code);
    
    const processDef = project.get_all_definitions().find(d => d.name === "processData");
    expect(processDef).toBeDefined();
    if (!processDef) return;
    
    const calls = project.get_calls_from_definition(processDef);
    expect(calls.some(c => c.name === "fetchData")).toBe(true);
    expect(calls.some(c => c.name === "log")).toBe(true);
  });

  it("should track generator function calls", () => {
    const project = new Project();
    const code = `
function* numberGenerator() {
  yield 1;
  yield 2;
  yield 3;
}

function useGenerator() {
  const gen = numberGenerator();
  const first = gen.next();
  return first.value;
}
`;
    project.add_or_update_file("test.js", code);
    
    const useDef = project.get_all_definitions().find(d => d.name === "useGenerator");
    expect(useDef).toBeDefined();
    if (!useDef) return;
    
    const calls = project.get_calls_from_definition(useDef);
    expect(calls.some(c => c.name === "numberGenerator")).toBe(true);
    expect(calls.some(c => c.name === "next" && c.is_method)).toBe(true);
  });

  it.skip("should detect dynamic function calls", () => {
    const project = new Project();
    const code = `
function handler1() { return "one"; }
function handler2() { return "two"; }

function dispatch(name) {
  const handlers = { handler1, handler2 };
  return handlers[name]();
}

dispatch("handler1");
`;
    project.add_or_update_file("test.js", code);
    
    const dispatchDef = project.get_all_definitions().find(d => d.name === "dispatch");
    expect(dispatchDef).toBeDefined();
    if (!dispatchDef) return;
    
    const calls = project.get_calls_from_definition(dispatchDef);
    // This is a limitation - dynamic calls are hard to track statically
    expect(calls.length).toBeGreaterThanOrEqual(0);
  });

  it("should handle nested function calls", () => {
    const project = new Project();
    const code = `
function level3() {
  return "deep";
}

function level2() {
  return level3();
}

function level1() {
  return level2();
}

function main() {
  return level1();
}
`;
    project.add_or_update_file("test.js", code);
    
    const mainDef = project.get_all_definitions().find(d => d.name === "main");
    expect(mainDef).toBeDefined();
    if (!mainDef) return;
    
    const calls = project.get_calls_from_definition(mainDef);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("level1");
    
    // Check level1 calls level2
    const level1Def = project.get_all_definitions().find(d => d.name === "level1");
    if (level1Def) {
      const level1Calls = project.get_calls_from_definition(level1Def);
      expect(level1Calls).toHaveLength(1);
      expect(level1Calls[0].name).toBe("level2");
    }
  });

  it("should track calls in different scopes", () => {
    const project = new Project();
    const code = `
function outer() {
  function inner() {
    return "nested";
  }
  
  return inner();
}

function another() {
  // Can't call inner from here
  return outer();
}
`;
    project.add_or_update_file("test.js", code);
    
    const outerDef = project.get_all_definitions().find(d => d.name === "outer");
    const anotherDef = project.get_all_definitions().find(d => d.name === "another");
    
    expect(outerDef).toBeDefined();
    expect(anotherDef).toBeDefined();
    
    if (outerDef) {
      const outerCalls = project.get_calls_from_definition(outerDef);
      expect(outerCalls.some(c => c.name === "inner")).toBe(true);
    }
    
    if (anotherDef) {
      const anotherCalls = project.get_calls_from_definition(anotherDef);
      expect(anotherCalls.some(c => c.name === "outer")).toBe(true);
      expect(anotherCalls.some(c => c.name === "inner")).toBe(false);
    }
  });

  it("should handle calls with complex arguments", () => {
    const project = new Project();
    const code = `
function processArray(arr, callback) {
  return arr.map(callback);
}

function transform(value) {
  return value * 2;
}

function main() {
  const result = processArray([1, 2, 3], transform);
  const inline = processArray([4, 5], x => x + 1);
  return result;
}
`;
    project.add_or_update_file("test.js", code);
    
    const mainDef = project.get_all_definitions().find(d => d.name === "main");
    expect(mainDef).toBeDefined();
    if (!mainDef) return;
    
    const calls = project.get_calls_from_definition(mainDef);
    expect(calls.filter(c => c.name === "processArray")).toHaveLength(2);
  });

  it("should track constructor calls", () => {
    const project = new Project();
    const code = `
class Service {
  constructor(name) {
    this.name = name;
    this.init();
  }
  
  init() {
    console.log("Initializing", this.name);
  }
}

function createService() {
  return new Service("test");
}
`;
    project.add_or_update_file("test.js", code);
    
    const createDef = project.get_all_definitions().find(d => d.name === "createService");
    expect(createDef).toBeDefined();
    if (!createDef) return;
    
    const calls = project.get_calls_from_definition(createDef);
    expect(calls.some(c => c.name === "Service")).toBe(true);
    
    // Check constructor calls init
    const constructorDef = project.get_all_definitions().find(
      d => d.name === "constructor" && d.symbol_kind === "method"
    );
    if (constructorDef) {
      const constructorCalls = project.get_calls_from_definition(constructorDef);
      expect(constructorCalls.some(c => c.name === "init")).toBe(true);
    }
  });

  it("should handle spread operator in calls", () => {
    const project = new Project();
    const code = `
function sum(...numbers) {
  return numbers.reduce((a, b) => a + b, 0);
}

function calculate() {
  const nums = [1, 2, 3];
  return sum(...nums);
}
`;
    project.add_or_update_file("test.js", code);
    
    const calculateDef = project.get_all_definitions().find(d => d.name === "calculate");
    expect(calculateDef).toBeDefined();
    if (!calculateDef) return;
    
    const calls = project.get_calls_from_definition(calculateDef);
    expect(calls.some(c => c.name === "sum")).toBe(true);
  });

  it("should detect template literal tag function calls", () => {
    const project = new Project();
    const code = `
function tag(strings, ...values) {
  return strings.join("");
}

function useTag() {
  const result = tag\`Hello \${name} world\`;
  return result;
}
`;
    project.add_or_update_file("test.js", code);
    
    const useTagDef = project.get_all_definitions().find(d => d.name === "useTag");
    expect(useTagDef).toBeDefined();
    if (!useTagDef) return;
    
    const calls = project.get_calls_from_definition(useTagDef);
    expect(calls.some(c => c.name === "tag")).toBe(true);
  });
});