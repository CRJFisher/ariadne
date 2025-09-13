
export {
  // Local types and extensions
  ModuleNodeWithMetadata,
  ModuleImportInfo,
  ModuleEdge,
  ModuleGraphWithEdges,
  ModuleGraphOptions,

  // Functions
  build_module_graph as build_module_graph_from_files,
} from './module_graph';

export {
  build_module_graph
} from './module_graph_builder';