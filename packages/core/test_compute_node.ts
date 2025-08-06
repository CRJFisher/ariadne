import { Project } from "@ariadnejs/core";

const project = new Project();

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

// Get the compute function
const functions = project.get_functions_in_file("test.rs");
const computeFn = functions.find(f => f.name === "compute");

if (computeFn) {
  console.log("Compute function:");
  console.log("  name:", computeFn.name);
  console.log("  symbol_id:", computeFn.symbol_id);
  console.log("  is_exported:", computeFn.is_exported);
  
  // Get calls from compute
  const calls = project.get_calls_from_definition(computeFn);
  console.log("\nCalls from compute:", calls.length);
  calls.forEach(c => {
    console.log(`  - ${c.called_def.name}`);
  });
}

// Get call graph
const callGraph = project.get_call_graph();

console.log("\n=== Call Graph Analysis ===");
console.log("Total nodes:", callGraph.nodes.size);

// Check if compute is in the graph
const computeKey = "test#Calculator.compute";
const computeNode = callGraph.nodes.get(computeKey);
console.log(`\nNode '${computeKey}' exists:`, computeNode ? "yes" : "no");

if (computeNode) {
  console.log("Compute node details:");
  console.log("  calls:", computeNode.calls.length);
  console.log("  called_by:", computeNode.called_by.length);
  console.log("  is_exported:", computeNode.is_exported);
}

// List all nodes
console.log("\nAll nodes in graph:");
for (const [key, node] of callGraph.nodes) {
  console.log(`  ${key}: calls=${node.calls.length}, called_by=${node.called_by.length}`);
}