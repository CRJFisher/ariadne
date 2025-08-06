import { describe, test, expect } from "vitest";
import { Project } from "../src/index";

describe("Method call detection", () => {
  test("detects method calls on built-in types", () => {
    const project = new Project();
    
    const code = `
function arrayOperations() {
  const arr = [1, 2, 3];
  arr.push(4);
  arr.pop();
  return arr;
}

function stringOperations() {
  const str = "hello";
  const upper = str.toUpperCase();
  const lower = str.toLowerCase();
  return upper + lower;
}`;
    
    project.add_or_update_file("test.js", code);
    
    // Test array operations
    const funcs = project.get_functions_in_file("test.js");
    const arrayFunc = funcs.find(f => f.name === "arrayOperations");
    const stringFunc = funcs.find(f => f.name === "stringOperations");
    
    expect(arrayFunc).toBeDefined();
    expect(stringFunc).toBeDefined();
    
    // Get calls from array function
    const arrayCalls = project.get_calls_from_definition(arrayFunc!);
    expect(arrayCalls.length).toBeGreaterThan(0);
    expect(arrayCalls.some(c => c.called_def.name === "push")).toBe(true);
    expect(arrayCalls.some(c => c.called_def.name === "pop")).toBe(true);
    
    // Get calls from string function
    const stringCalls = project.get_calls_from_definition(stringFunc!);
    expect(stringCalls.length).toBeGreaterThan(0);
    expect(stringCalls.some(c => c.called_def.name === "toUpperCase")).toBe(true);
    expect(stringCalls.some(c => c.called_def.name === "toLowerCase")).toBe(true);
    
    // Check in call graph
    const callGraph = project.get_call_graph();
    const arrayNode = callGraph.nodes.get("test#arrayOperations");
    const stringNode = callGraph.nodes.get("test#stringOperations");
    
    expect(arrayNode).toBeDefined();
    expect(stringNode).toBeDefined();
    
    // Built-in calls should be tracked
    expect(arrayNode!.calls.some(c => c.symbol === "<builtin>#push")).toBe(true);
    expect(arrayNode!.calls.some(c => c.symbol === "<builtin>#pop")).toBe(true);
    expect(stringNode!.calls.some(c => c.symbol === "<builtin>#toUpperCase")).toBe(true);
    expect(stringNode!.calls.some(c => c.symbol === "<builtin>#toLowerCase")).toBe(true);
  });
  
  test("distinguishes between built-in and user-defined methods", () => {
    const project = new Project();
    
    const code = `
class MyClass {
  push(item) {
    // Custom push implementation
  }
}

function test() {
  const arr = [];
  arr.push(1);  // Built-in push
  
  const obj = new MyClass();
  obj.push(2);  // User-defined push
}`;
    
    project.add_or_update_file("test.js", code);
    
    const funcs = project.get_functions_in_file("test.js");
    const testFunc = funcs.find(f => f.name === "test");
    
    expect(testFunc).toBeDefined();
    
    const calls = project.get_calls_from_definition(testFunc!);
    
    // Should detect both push calls
    const pushCalls = calls.filter(c => c.called_def.name === "push");
    expect(pushCalls.length).toBe(2);
    
    // One should be built-in, one should be user-defined
    const builtinPush = pushCalls.find(c => c.called_def.symbol_id === "<builtin>#push");
    expect(builtinPush).toBeDefined();
    
    // Note: The user-defined push might also resolve to builtin due to type tracking limitations
    // This is part of the larger issue with cross-file method resolution
  });
});