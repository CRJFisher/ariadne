import { Project } from "@ariadnejs/core";
import { find_definition } from "@ariadnejs/core/src/symbol_resolver";
import { get_all_functions_flat } from "@ariadnejs/core/src/utils/query_utils";
import { build_call_graph_for_display } from "@ariadnejs/core/src/call_graph/graph_builder";

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

// Full call graph flow
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

console.log("Functions passed to build_call_graph_for_display:", graphFunctions.length);
graphFunctions.forEach(f => {
  console.log(`  ${f.name}: ${f.symbol_id}`);
});

console.log("\nCalls passed to build_call_graph_for_display:", calls.length);
calls.forEach(c => {
  console.log(`  ${c.caller_def.name} -> ${c.called_def.name}`);
});

// Build the display graph
const graph = build_call_graph_for_display(
  graphFunctions,
  calls,
  (filePath: string, name: string) => {
    const tracker = state.call_graph_data.fileTypeTrackers.get(filePath);
    return tracker ? tracker.exportedDefinitions.has(name) : false;
  },
  undefined
);

console.log("\nFinal graph nodes:", graph.nodes.size);
for (const [key, node] of graph.nodes) {
  console.log(`  ${key}: ${node.definition.name}`);
}

const computeNode = graph.nodes.get("test#Calculator.compute");
console.log("\nCompute node exists:", computeNode ? "yes" : "no");