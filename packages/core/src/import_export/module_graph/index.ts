/**
 * Module graph exports
 * 
 * Re-exports the module graph functionality
 */

export {
  // Types from @ariadnejs/types
  ModuleNode,
  ModuleGraph,
  ImportedSymbol,
  ExportedSymbol
} from '@ariadnejs/types';

export {
  // Local types and extensions
  ModuleNodeWithMetadata,
  ModuleImportInfo,
  ModuleEdge,
  ModuleGraphWithEdges,
  ModuleGraphOptions,
  
  // Functions
  build_module_graph,
  find_circular_dependencies,
  get_module_dependencies,
  get_module_dependents,
  calculate_module_importance,
  create_module_graph_builder,
  analyze_module_graph
} from './module_graph';