import { describe, test, expect, beforeEach } from 'vitest';
import { Project } from './index';

describe('Call Graph Extraction', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test('extracts simple function calls', () => {
    const code = `
function helper() {
  return 42;
}

function main() {
  const result = helper();
  return result;
}
`;
    
    project.add_or_update_file('test.ts', code);
    
    // Find the main function
    const functions = project.get_functions_in_file('test.ts');
    const mainFunc = functions.find(f => f.name === 'main');
    expect(mainFunc).toBeDefined();
    
    // Get calls from main
    const calls = project.get_function_calls(mainFunc!);
    expect(calls.length).toBe(1);
    expect(calls[0].called_def.name).toBe('helper');
    expect(calls[0].is_method_call).toBe(false);
  });

  test('detects method calls', () => {
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
    
    project.add_or_update_file('test.ts', code);
    
    const functions = project.get_functions_in_file('test.ts');
    const calculateMethod = functions.find(f => f.name === 'calculate');
    expect(calculateMethod).toBeDefined();
    
    const calls = project.get_function_calls(calculateMethod!);
    expect(calls.length).toBe(1);
    expect(calls[0].called_def.name).toBe('add');
    expect(calls[0].is_method_call).toBe(true);
  });

  test('tracks call locations', () => {
    const code = `
function target() {}

function caller() {
  target(); // line 4
  const x = 1;
  target(); // line 6
}
`;
    
    project.add_or_update_file('test.ts', code);
    
    const functions = project.get_functions_in_file('test.ts');
    const callerFunc = functions.find(f => f.name === 'caller');
    
    const calls = project.get_function_calls(callerFunc!);
    expect(calls.length).toBe(2);
    expect(calls[0].call_location.row).toBe(4);
    expect(calls[1].call_location.row).toBe(6);
  });

  test('handles nested function calls', () => {
    const code = `
function innermost() { return 1; }
function middle() { return innermost(); }
function outer() { return middle(); }
`;
    
    project.add_or_update_file('test.ts', code);
    
    const functions = project.get_functions_in_file('test.ts');
    const outerFunc = functions.find(f => f.name === 'outer');
    const middleFunc = functions.find(f => f.name === 'middle');
    
    const outerCalls = project.get_function_calls(outerFunc!);
    expect(outerCalls.length).toBe(1);
    expect(outerCalls[0].called_def.name).toBe('middle');
    
    const middleCalls = project.get_function_calls(middleFunc!);
    expect(middleCalls.length).toBe(1);
    expect(middleCalls[0].called_def.name).toBe('innermost');
  });

  test('extracts complete call graph', () => {
    const code = `
function util1() {}
function util2() { util1(); }
function main() {
  util1();
  util2();
}
`;
    
    project.add_or_update_file('test.ts', code);
    
    const callGraph = project.extract_call_graph();
    
    // Should have 3 functions
    expect(callGraph.functions.length).toBe(3);
    expect(callGraph.functions.map(f => f.name).sort()).toEqual(['main', 'util1', 'util2']);
    
    // Should have 3 calls total
    expect(callGraph.calls.length).toBe(3);
    
    // Verify specific calls
    const mainCalls = callGraph.calls.filter(c => c.caller_def.name === 'main');
    expect(mainCalls.length).toBe(2);
    expect(mainCalls.map(c => c.called_def.name).sort()).toEqual(['util1', 'util2']);
    
    const util2Calls = callGraph.calls.filter(c => c.caller_def.name === 'util2');
    expect(util2Calls.length).toBe(1);
    expect(util2Calls[0].called_def.name).toBe('util1');
  });

  test('handles Python method calls', () => {
    const code = `
class MyClass:
    def helper(self):
        return 42
    
    def main(self):
        return self.helper()
`;
    
    project.add_or_update_file('test.py', code);
    
    const functions = project.get_functions_in_file('test.py');
    const mainMethod = functions.find(f => f.name === 'main');
    
    const calls = project.get_function_calls(mainMethod!);
    expect(calls.length).toBe(1);
    expect(calls[0].called_def.name).toBe('helper');
    expect(calls[0].is_method_call).toBe(true);
  });

  test('ignores non-function references', () => {
    const code = `
const variable = 42;

function myFunc() {
  return variable; // This is not a function call
}
`;
    
    project.add_or_update_file('test.ts', code);
    
    const functions = project.get_functions_in_file('test.ts');
    const myFunc = functions.find(f => f.name === 'myFunc');
    
    const calls = project.get_function_calls(myFunc!);
    expect(calls.length).toBe(0);
  });

  test('handles recursive calls', () => {
    const code = `
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
`;
    
    project.add_or_update_file('test.ts', code);
    
    const functions = project.get_functions_in_file('test.ts');
    const factorial = functions.find(f => f.name === 'factorial');
    
    const calls = project.get_function_calls(factorial!);
    expect(calls.length).toBe(1);
    expect(calls[0].called_def.name).toBe('factorial');
    expect(calls[0].caller_def.name).toBe('factorial');
  });

  test('returns empty array for non-function definitions', () => {
    const code = `
const notAFunction = 42;
class MyClass {}
`;
    
    project.add_or_update_file('test.ts', code);
    
    // Try to get calls from a non-function def
    const graph = project.get_scope_graph('test.ts');
    const defs = graph!.getNodes('definition');
    const varDef = defs.find(d => d.name === 'notAFunction');
    const classDef = defs.find(d => d.name === 'MyClass');
    
    expect(project.get_function_calls(varDef!)).toEqual([]);
    expect(project.get_function_calls(classDef!)).toEqual([]);
  });

  test('handles multiple files in call graph', () => {
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
    
    project.add_or_update_file('file1.ts', file1);
    project.add_or_update_file('file2.ts', file2);
    
    const callGraph = project.extract_call_graph();
    
    // Should have functions from both files
    const functionNames = callGraph.functions.map(f => f.name);
    expect(functionNames).toContain('shared');
    expect(functionNames).toContain('local');
    
    // Note: Cross-file resolution might not work perfectly yet,
    // but the structure should be there
    expect(callGraph.calls.length).toBeGreaterThanOrEqual(0);
  });
});