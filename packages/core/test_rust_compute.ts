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

// Get functions
const functions = project.get_functions_in_file("test.rs");
const computeFn = functions.find(f => f.name === "compute");

if (computeFn) {
  console.log("Compute function found:", computeFn.name);
  console.log("Symbol ID:", computeFn.symbol_id);
  
  // Get calls from compute
  const calls = project.get_calls_from_definition(computeFn);
  console.log("\nCalls from compute:");
  calls.forEach(call => {
    console.log(`  - ${call.called_def.name} (${call.called_def.symbol_id})`);
  });
  
  // Check call graph
  const callGraph = project.get_call_graph();
  console.log("\n=== Call graph analysis ===");
  console.log("All nodes in call graph:");
  for (const [key, node] of callGraph.nodes) {
    console.log(`  ${key}: ${node.definition.name} (called_by: ${node.called_by.length})`);
  }
  
  // Check if compute node exists
  const computeNode = callGraph.nodes.get(computeFn.symbol_id);
  console.log(`\nCompute node exists in graph: ${computeNode ? 'yes' : 'no'}`);
  
  // Check top-level nodes
  console.log("\nTop-level nodes:", callGraph.top_level_nodes);
}