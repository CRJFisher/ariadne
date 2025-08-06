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

// Get the compute function
const functions = project.get_functions_in_file("test.rs");
const computeFn = functions.find(f => f.name === "compute");

if (computeFn) {
  // Get ALL calls (before filtering)
  const callGraphService = (project as any).callGraphService;
  const state = (project as any).storage.getState();
  const goToDefinition = () => undefined;
  const getImportsWithDefinitions = () => [];
  
  const allCalls = callGraphService.getCallsFromDefinition(
    state,
    computeFn,
    goToDefinition,
    getImportsWithDefinitions
  );
  
  console.log("All calls from compute (before filtering):", allCalls.length);
  allCalls.forEach(c => {
    console.log(`  - ${c.called_def.name}: symbol_kind=${c.called_def.symbol_kind}`);
  });
  
  // Now with the filter
  const filteredCalls = allCalls.filter(call => 
    ['function', 'method', 'generator'].includes(call.called_def.symbol_kind)
  );
  
  console.log("\nFiltered calls (function/method/generator only):", filteredCalls.length);
  filteredCalls.forEach(c => {
    console.log(`  - ${c.called_def.name}: symbol_kind=${c.called_def.symbol_kind}`);
  });
}