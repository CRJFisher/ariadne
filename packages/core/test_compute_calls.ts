import { Project } from "@ariadnejs/core";
import { get_all_functions_flat } from "@ariadnejs/core/src/utils/query_utils";

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

// Get all functions and calls
const state = (project as any).storage.getState();
const functions = get_all_functions_flat(state);

console.log("Functions:");
functions.forEach(f => {
  console.log(`  ${f.name}: ${f.symbol_id}`);
});

// Get all calls in the project
const extractCallGraph = (project as any).callGraphService.extractCallGraph.bind((project as any).callGraphService);
const goToDefinition = () => undefined;
const getImportsWithDefinitions = () => [];
const getAllFunctions = () => functions;

const { functions: graphFunctions, calls } = extractCallGraph(
  state,
  goToDefinition,
  getImportsWithDefinitions,
  getAllFunctions
);

console.log("\nAll calls in project:");
calls.forEach(c => {
  console.log(`  ${c.caller_def.name} (${c.caller_def.symbol_id}) -> ${c.called_def.name} (${c.called_def.symbol_id})`);
});

// Check specifically for calls from compute
const computeCalls = calls.filter(c => c.caller_def.name === 'compute');
console.log(`\nCalls from compute: ${computeCalls.length}`);