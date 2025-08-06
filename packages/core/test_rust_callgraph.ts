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

// Get the call graph
const callGraph = project.get_call_graph();

// List all nodes
console.log("Call graph nodes:");
for (const [key, node] of callGraph.nodes) {
  console.log(`  ${key}: ${node.definition.name} (${node.definition.symbol_kind})`);
}

// Check specific nodes
console.log("\nLooking for compute node...");
const computeNode = callGraph.nodes.get("test#Calculator.compute");
console.log("Found with key 'test#Calculator.compute':", computeNode ? "yes" : "no");

// Try alternative keys
const altKey1 = "test#compute";
const altNode1 = callGraph.nodes.get(altKey1);
console.log(`Found with key '${altKey1}':`, altNode1 ? "yes" : "no");

// Check all functions
const functions = project.get_functions_in_file("test.rs");
console.log("\nFunctions found in file:");
functions.forEach(f => {
  console.log(`  ${f.name}: symbol_id=${f.symbol_id}, symbol_kind=${f.symbol_kind}`);
});