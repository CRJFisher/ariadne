// TASK-350.1 evidence — modelled on webpack's buildChunkGraph.
// `g` is typed only through the JSDoc `@param {ModuleGraph} g` tag. The core fix
// puts "ModuleGraph" on the parameter definition's type, so g.getParentBlockIndex()
// resolves to ModuleGraph.getParentBlockIndex and that member stops being an
// entry point. The import makes ModuleGraph a resolvable type name in this file.

import { ModuleGraph } from "./module_graph";

/**
 * @param {ModuleGraph} g the module graph
 */
export function buildChunkGraph(g) {
  g.getParentBlockIndex();
}
