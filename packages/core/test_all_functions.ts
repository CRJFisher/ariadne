import { Project } from "@ariadnejs/core";
import { get_all_functions_flat } from "@ariadnejs/core/src/utils/query_utils";

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

// Get all functions using the same method as getCallGraph
const state = (project as any).storage.getState();
const allFunctions = get_all_functions_flat(state);

console.log("All functions from get_all_functions_flat:");
allFunctions.forEach(f => {
  console.log(`  ${f.name}: ${f.symbol_id} (${f.symbol_kind})`);
});

const computeFn = allFunctions.find(f => f.name === "compute");
console.log("\nCompute found:", computeFn ? "yes" : "no");