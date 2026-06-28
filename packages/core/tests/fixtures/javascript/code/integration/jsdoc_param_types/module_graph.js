// TASK-350.1 evidence — modelled on webpack's ModuleGraph.
// getParentBlockIndex has no other caller; it is reached only through the
// JSDoc-typed `@param {ModuleGraph} g` receiver in build_chunk_graph.js. If the
// JSDoc param type is dropped at indexing, the receiver type is unknown, the
// call cannot resolve, and this method is reported as a dead entry point.

export class ModuleGraph {
  getParentBlockIndex() {
    return 0;
  }
}
