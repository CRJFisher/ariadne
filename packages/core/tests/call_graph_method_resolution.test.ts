import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { Def, Project, normalize_module_path } from "../src/index";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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
    // Should have 3 calls: new Calculator(), calc.add(), calc.multiply()
    expect(computeNode!.calls.length).toBe(3);
    
    const callSymbols = computeNode!.calls.map(c => c.symbol).sort();
    expect(callSymbols).toEqual(["calculator#Calculator", "calculator#Calculator.add", "calculator#Calculator.multiply"]);
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
    // Should have: DataProcessor(), process(), validate()
    expect(handleNode!.calls.length).toBe(3);
    
    const callSymbols = handleNode!.calls.map(c => c.symbol).sort();
    expect(callSymbols).toEqual(["processor#DataProcessor", "processor#DataProcessor.process", "processor#DataProcessor.validate"]);
  });

  test.skip("cross-file method resolution within same function for Rust", () => {
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
    // In Rust, the method call on the return value is also detected: calc.get_value() 
    // So we have: Calculator::new(), calc.add(10), calc.add(20), calc.get_value(), and possibly built-ins
    expect(computeNode!.calls.length).toBeGreaterThanOrEqual(4);
    
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
    // Should have: 2 new Counter(), 2 increment, 1 decrement, 2 getValue
    expect(manipulateNode!.calls.length).toBe(7);
    
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
    // Should have: new StringUtils(), capitalize(), reverse()
    expect(processNode!.calls.length).toBe(3);
    
    const callSymbols = processNode!.calls.map(c => c.symbol).sort();
    expect(callSymbols).toEqual(["utils#StringUtils", "utils#StringUtils.capitalize", "utils#StringUtils.reverse"]);
  });

  test("cross-file method resolution within same function for Python - requires import-aware type tracking", () => {
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
    // Should have: FileHandler(), read_file(), write_file(), and built-ins like open(), upper()
    expect(processNode!.calls.length).toBeGreaterThanOrEqual(3);
    
    const callSymbols = processNode!.calls.map(c => c.symbol);
    expect(callSymbols).toContain("handler#FileHandler.read_file");
    expect(callSymbols).toContain("handler#FileHandler.write_file");
  });

});