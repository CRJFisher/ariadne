/**
 * Ariadne Core - Public API
 *
 * Main entry point for the Ariadne code analysis library.
 * Provides functions to analyze codebases and extract code graphs.
 */

// Project management
export { Project } from "./project";

// Semantic index API
export { build_semantic_index } from "./semantic_index/semantic_index";
export type { SemanticIndex, ProjectSemanticIndex } from "./semantic_index/semantic_index";

// Main API functions
// TODO: Fix - code_graph module doesn't exist
// export {
//   generate_code_graph,
// } from "./code_graph";
