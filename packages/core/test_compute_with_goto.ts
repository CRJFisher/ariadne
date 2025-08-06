import { Project } from "@ariadnejs/core";
import { find_definition } from "@ariadnejs/core/src/symbol_resolver";
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

// Get all functions and calls with proper goToDefinition
const state = (project as any).storage.getState();
const functions = get_all_functions_flat(state);

const goToDefinition = (filePath: string, position: { row: number; column: number }) => 
  find_definition(filePath, position, new Map(state.file_graphs)) || undefined;

const getImportsWithDefinitions = (filePath: string) =>
  (project as any).importResolver.getImportsWithDefinitions(state, filePath);

const getAllFunctions = () => functions;

const extractCallGraph = (project as any).callGraphService.extractCallGraph.bind((project as any).callGraphService);

const { functions: graphFunctions, calls } = extractCallGraph(
  state,
  goToDefinition,
  getImportsWithDefinitions,
  getAllFunctions
);

console.log("All calls in project:");
calls.forEach(c => {
  console.log(`  ${c.caller_def.name} -> ${c.called_def.name}`);
});

// Check specifically for calls from compute
const computeCalls = calls.filter(c => c.caller_def.name === 'compute');
console.log(`\nCalls from compute: ${computeCalls.length}`);