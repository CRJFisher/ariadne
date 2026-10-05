import * as graphs from "./barrel";

/**
 * @param {import("./barrel").ChunkGraph=} graph
 */
export function build_inline(graph) {
  graph.connect();
}

/**
 * @param {graphs.ChunkGraph|null} graph
 */
export function build_namespaced(graph) {
  graph.connect();
}
