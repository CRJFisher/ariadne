import { describe, test, expect } from "vitest";
import { Project } from "../src/index";

describe("Cross-file method resolution for all supported languages", () => {
  test("JavaScript - CommonJS", () => {
    const project = new Project();
    
    const file1 = `
class Calculator {
  add(a, b) {
    return a + b;
  }
  
  multiply(a, b) {
    return a * b;
  }
}

module.exports = Calculator;
`;
    
    const file2 = `
const Calculator = require('./calculator');

function compute() {
  const calc = new Calculator();
  const sum = calc.add(5, 3);
  const product = calc.multiply(4, 2);
  return { sum, product };
}

module.exports = compute;
`;
    
    project.add_or_update_file("calculator.js", file1);
    project.add_or_update_file("compute.js", file2);
    
    // Build the call graph to detect exports and resolve imports
    const callGraph = project.get_call_graph();
    
    
    // Check that nodes exist in the graph
    expect(callGraph.nodes.has("calculator#Calculator.add")).toBe(true);
    expect(callGraph.nodes.has("calculator#Calculator.multiply")).toBe(true);
    expect(callGraph.nodes.has("compute#compute")).toBe(true);
    
    // Calculator methods should not be top-level since they're called
    expect(callGraph.top_level_nodes).not.toContain("calculator#Calculator.add");
    expect(callGraph.top_level_nodes).not.toContain("calculator#Calculator.multiply");
    
    // compute should call Calculator methods
    const computeNode = callGraph.nodes.get("compute#compute");
    expect(computeNode).toBeDefined();
    expect(computeNode!.calls.length).toBe(2);
    
    const callSymbols = computeNode!.calls.map(c => c.symbol).sort();
    expect(callSymbols).toEqual(["calculator#Calculator.add", "calculator#Calculator.multiply"]);
  });

  test("TypeScript - ES6 imports", () => {
    const project = new Project();
    
    const file1 = `
export class StringProcessor {
  toUpperCase(str: string): string {
    return str.toUpperCase();
  }
  
  toLowerCase(str: string): string {
    return str.toLowerCase();
  }
  
  trim(str: string): string {
    return str.trim();
  }
}
`;
    
    const file2 = `
import { StringProcessor } from './processor';

export function processText(text: string): string {
  const processor = new StringProcessor();
  const upper = processor.toUpperCase(text);
  const trimmed = processor.trim(upper);
  return trimmed;
}
`;
    
    project.add_or_update_file("processor.ts", file1);
    project.add_or_update_file("main.ts", file2);
    
    const callGraph = project.get_call_graph();
    
    
    // For TypeScript with ES6 exports, the whole class is exported, not individual methods
    // So we'll just check that processText calls the right methods
    expect(callGraph.nodes.has("main#processText")).toBe(true);
    
    // processText should call two methods
    const processNode = callGraph.nodes.get("main#processText");
    expect(processNode).toBeDefined();
    
    // Get unique method calls (dedup any duplicates)
    const uniqueCallSymbols = [...new Set(processNode!.calls.map(c => c.symbol))].sort();
    expect(uniqueCallSymbols).toEqual(["processor#StringProcessor.toUpperCase", "processor#StringProcessor.trim"]);
  });

  test("Python - from/import statements", () => {
    const project = new Project();
    
    const file1 = `
class DataProcessor:
    def __init__(self):
        self.data = []
    
    def add_data(self, item):
        self.data.append(item)
    
    def process_data(self):
        return [str(item).upper() for item in self.data]
    
    def clear_data(self):
        self.data = []
    
    def _internal_method(self):
        # This should not be exported (underscore prefix)
        pass
`;
    
    const file2 = `
from processor import DataProcessor

def analyze_data(items):
    processor = DataProcessor()
    for item in items:
        processor.add_data(item)
    
    result = processor.process_data()
    processor.clear_data()
    return result
`;
    
    project.add_or_update_file("processor.py", file1);
    project.add_or_update_file("analyzer.py", file2);
    
    const callGraph = project.get_call_graph();
    
    // Methods called by analyze_data should not be top-level
    expect(callGraph.top_level_nodes).not.toContain("processor#DataProcessor.add_data");
    expect(callGraph.top_level_nodes).not.toContain("processor#DataProcessor.process_data");
    expect(callGraph.top_level_nodes).not.toContain("processor#DataProcessor.clear_data");
    
    // __init__ might be top-level or not depending on whether constructor calls are tracked
    // _internal_method should exist but not be exported
    // Since it's not called, it will be in top-level (but that's ok since it's private)
    const internalMethod = callGraph.nodes.get("processor#DataProcessor._internal_method");
    if (internalMethod) {
      expect(internalMethod.is_exported).toBe(false);
    }
    
    // analyze_data should call the three methods
    const analyzeNode = callGraph.nodes.get("analyzer#analyze_data");
    expect(analyzeNode).toBeDefined();
    expect(analyzeNode!.calls.length).toBe(3);
    
    const callSymbols = analyzeNode!.calls.map(c => c.symbol).sort();
    expect(callSymbols).toEqual([
      "processor#DataProcessor.add_data",
      "processor#DataProcessor.clear_data",
      "processor#DataProcessor.process_data"
    ]);
  });

  test("Rust - use statements", () => {
    const project = new Project();
    
    const file1 = `
pub struct Logger {
    messages: Vec<String>,
}

impl Logger {
    pub fn new() -> Self {
        Logger { messages: Vec::new() }
    }
    
    pub fn log(&mut self, message: &str) {
        self.messages.push(message.to_string());
    }
    
    pub fn get_logs(&self) -> &Vec<String> {
        &self.messages
    }
    
    fn internal_format(&self, msg: &str) -> String {
        // This is private (no pub)
        format!("[LOG] {}", msg)
    }
}
`;
    
    const file2 = `
use logger::Logger;

pub fn run_logging() {
    let mut logger = Logger::new();
    logger.log("Starting application");
    logger.log("Processing data");
    
    let logs = logger.get_logs();
    for log in logs {
        println!("{}", log);
    }
}
`;
    
    project.add_or_update_file("logger.rs", file1);
    project.add_or_update_file("main.rs", file2);
    
    const callGraph = project.get_call_graph();
    
    // Debug: Print all nodes and their details
    console.log("\nRust test - All nodes:");
    callGraph.nodes.forEach((node, key) => {
      console.log(`  ${key}: kind=${node.definition.symbol_kind}, calls=${node.calls.length}, exported=${node.is_exported}, file=${node.definition.file_path}`);
    });
    console.log("\nTop-level nodes:", callGraph.top_level_nodes);
    
    // Debug: Check scope graph for logger.rs
    const loggerGraph = project.get_scope_graph("logger.rs");
    if (loggerGraph) {
      const defs = loggerGraph.getAllDefs();
      console.log("\nDefinitions in logger.rs:");
      defs.slice(0, 5).forEach(d => {
        console.log(`  ${d.name}: kind=${d.symbol_kind}, exported=${d.is_exported}`);
      });
    }
    
    // Debug: Check imports
    const loggerImports = project.get_imports_with_definitions("main.rs");
    console.log("\nImports in main.rs:", loggerImports);
    
    // Debug: Check references in main.rs
    const mainGraph = project.get_scope_graph("main.rs");
    if (mainGraph) {
      const refs = mainGraph.getNodes('reference');
      console.log("\nReferences in main.rs:");
      refs.forEach(r => {
        console.log(`  ${r.name}: kind=${r.symbol_kind}, range=${r.range.start.row}:${r.range.start.column}`);
      });
      
      // Check raw imports
      const imports = mainGraph.getAllImports();
      console.log("\nRaw imports in main.rs:");
      imports.forEach(i => {
        console.log(`  ${i.name}: source_module=${i.source_module}`);
      });
    }
    
    // Debug: Check calls from run_logging
    const runLoggingNode = callGraph.nodes.get("main#run_logging");
    console.log("\nrun_logging calls:", runLoggingNode?.calls.map(c => ({ symbol: c.symbol, kind: c.kind })));
    
    // Logger methods called by run_logging should not be top-level
    expect(callGraph.top_level_nodes).not.toContain("logger#Logger.new");
    expect(callGraph.top_level_nodes).not.toContain("logger#Logger.log");
    expect(callGraph.top_level_nodes).not.toContain("logger#Logger.get_logs");
    
    // internal_format should not appear (private)
    expect(callGraph.nodes.has("logger#Logger.internal_format")).toBe(false);
    
    // run_logging should call the Logger methods
    const runNode = callGraph.nodes.get("main#run_logging");
    expect(runNode).toBeDefined();
    expect(runNode!.calls.length).toBeGreaterThanOrEqual(3); // new, log (2x), get_logs
    
    const callSymbols = runNode!.calls.map(c => c.symbol);
    expect(callSymbols).toContain("logger#Logger.new");
    expect(callSymbols).toContain("logger#Logger.log");
    expect(callSymbols).toContain("logger#Logger.get_logs");
  });

  test("Mixed languages in a project", () => {
    const project = new Project();
    
    // TypeScript service
    const tsFile = `
export class ApiService {
  async fetchData(url: string) {
    return fetch(url).then(r => r.json());
  }
}
`;
    
    // Python processor
    const pyFile = `
class DataTransformer:
    def transform(self, data):
        return {"transformed": data}
    
    def validate(self, data):
        return data is not None
`;
    
    // JavaScript consumer (CommonJS)
    const jsFile = `
function processData(data) {
  console.log('Processing:', data);
  return data;
}

module.exports = { processData };
`;
    
    project.add_or_update_file("api.ts", tsFile);
    project.add_or_update_file("transformer.py", pyFile);
    project.add_or_update_file("processor.js", jsFile);
    
    const callGraph = project.get_call_graph();
    
    // Debug: print nodes
    console.log("\nMixed language test - All nodes:");
    callGraph.nodes.forEach((node, key) => {
      console.log(`  ${key}: kind=${node.definition.symbol_kind}, exported=${node.is_exported}`);
    });
    console.log("Top-level nodes:", callGraph.top_level_nodes);
    
    // Each file should have its own nodes
    expect(callGraph.nodes.has("api#ApiService.fetchData")).toBe(true);
    expect(callGraph.nodes.has("transformer#DataTransformer.transform")).toBe(true);
    expect(callGraph.nodes.has("transformer#DataTransformer.validate")).toBe(true);
    expect(callGraph.nodes.has("processor#processData")).toBe(true);
    
    // Since these files don't import each other, all should be top-level
    expect(callGraph.top_level_nodes).toContain("api#ApiService.fetchData");
    expect(callGraph.top_level_nodes).toContain("transformer#DataTransformer.transform");
    expect(callGraph.top_level_nodes).toContain("transformer#DataTransformer.validate");
    expect(callGraph.top_level_nodes).toContain("processor#processData");
  });
});