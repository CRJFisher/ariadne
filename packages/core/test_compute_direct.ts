import { Project } from "@ariadnejs/core";

const project = new Project();

const code = `
struct Calculator {
    value: i32,
}

impl Calculator {
    fn compute(&mut self) {
        self.add(5);
        self.multiply(2);
    }
    
    fn add(&mut self, x: i32) {
        self.value += x;
    }
    
    fn multiply(&mut self, x: i32) {
        self.value *= x;
    }
}
`;
project.add_or_update_file("test.rs", code);

// Get the compute function directly
const functions = project.get_functions_in_file("test.rs");
const computeFn = functions.find(f => f.name === "compute");

if (computeFn) {
  console.log("Compute function found:", computeFn.name);
  
  // Get calls using the project API directly
  const calls = project.get_function_calls(computeFn);
  console.log("\nCalls from compute using get_function_calls:", calls.length);
  calls.forEach(c => {
    console.log(`  - ${c.called_def.name} (${c.called_def.symbol_id})`);
  });
}