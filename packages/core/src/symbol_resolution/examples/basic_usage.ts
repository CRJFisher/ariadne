/**
 * Basic Symbol Resolution Usage Examples
 *
 * Demonstrates how to use the symbol resolution pipeline to analyze
 * code and extract symbol relationships.
 */

import { resolve_symbols } from "../symbol_resolution";
import { export_symbol_resolution_data, count_total_symbols } from "../data_export";
import type { ResolutionInput, ResolvedSymbols } from "../types";
import type { FilePath, SymbolName, SymbolId } from "@ariadnejs/types";
import { parse_location_key } from "@ariadnejs/types";
import { SemanticIndex } from "../../semantic_index/semantic_index";

/**
 * Example 1: Basic symbol resolution workflow
 *
 * Shows the complete process from loading source files to exporting results.
 */
async function basic_usage_example() {
  console.log("=== Basic Symbol Resolution Example ===\n");

  // Step 1: Build semantic indices from source files
  // In a real application, you would use the semantic_index module
  // to parse and index your source files
  const source_files = await load_source_files("./src");
  const semantic_indices = await build_semantic_indices(source_files);

  // Step 2: Resolve all symbols using the four-phase pipeline
  const resolved_symbols = resolve_symbols({
    indices: semantic_indices,
  });

  // Step 3: Analyze the results
  console.log("=== Resolution Results ===");
  console.log(`Total files analyzed: ${semantic_indices.size}`);
  console.log(`Total symbols found: ${count_total_symbols(resolved_symbols)}`);
  console.log(`Resolved references: ${resolved_symbols.resolved_references.size}`);
  console.log(`Unresolved references: ${resolved_symbols.unresolved_references.size}`);

  // Step 4: Explore phase-specific results
  analyze_import_resolution(resolved_symbols);
  analyze_function_calls(resolved_symbols);
  analyze_method_calls(resolved_symbols);

  // Step 5: Export data for external analysis
  const exported_data = export_symbol_resolution_data(resolved_symbols, "json");
  await save_exported_data("symbol_resolution.json", exported_data);

  console.log("\n✓ Symbol resolution complete!");
}

/**
 * Example 2: Analyze import resolution
 *
 * Shows how to work with the import resolution phase results.
 */
function analyze_import_resolution(resolved_symbols: ResolvedSymbols) {
  console.log("\n=== Import Resolution Analysis ===");

  const imports = resolved_symbols.phases.imports.imports;
  let total_imports = 0;

  for (const [file_path, file_imports] of imports) {
    const import_count = file_imports.size;
    total_imports += import_count;

    if (import_count > 0) {
      console.log(`\n${file_path}:`);
      for (const [imported_name, resolved_symbol] of file_imports) {
        console.log(`  ${imported_name} → ${resolved_symbol}`);
      }
    }
  }

  console.log(`\nTotal imports resolved: ${total_imports}`);
}

/**
 * Example 3: Analyze function call resolution
 *
 * Shows how to work with resolved function calls.
 */
function analyze_function_calls(resolved_symbols: ResolvedSymbols) {
  console.log("\n=== Function Call Analysis ===");

  const function_calls = resolved_symbols.phases.functions.function_calls;
  console.log(`Total function calls resolved: ${function_calls.size}`);

  // Find most called functions
  const call_counts = new Map<SymbolId, number>();
  for (const symbol_id of function_calls.values()) {
    call_counts.set(symbol_id, (call_counts.get(symbol_id) || 0) + 1);
  }

  // Sort by call count
  const sorted_functions = Array.from(call_counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sorted_functions.length > 0) {
    console.log("\nTop 10 most called functions:");
    for (const [symbol_id, count] of sorted_functions) {
      console.log(`  ${symbol_id}: ${count} calls`);
    }
  }

  // Find functions that are never called
  const all_functions = new Set<SymbolId>();
  for (const indices of resolved_symbols.phases.imports.imports.values()) {
    for (const symbol_id of indices.values()) {
      // Check if it's a function symbol
      if (symbol_id.includes("function:")) {
        all_functions.add(symbol_id);
      }
    }
  }

  const called_functions = new Set(function_calls.values());
  const uncalled_functions = Array.from(all_functions)
    .filter(fn => !called_functions.has(fn));

  if (uncalled_functions.length > 0) {
    console.log(`\nFound ${uncalled_functions.length} potentially unused functions`);
  }
}

/**
 * Example 4: Analyze method and constructor calls
 *
 * Shows how to work with object-oriented code analysis.
 */
function analyze_method_calls(resolved_symbols: ResolvedSymbols) {
  console.log("\n=== Method Call Analysis ===");

  const method_calls = resolved_symbols.phases.methods.method_calls;
  const constructor_calls = resolved_symbols.phases.methods.constructor_calls;

  console.log(`Total method calls resolved: ${method_calls.size}`);
  console.log(`Total constructor calls resolved: ${constructor_calls.size}`);

  // Find classes with most method calls
  const class_method_calls = new Map<string, number>();

  for (const symbol_id of method_calls.values()) {
    // Extract class name from method symbol
    const match = symbol_id.match(/method:([^:]+):/);
    if (match) {
      const class_name = match[1];
      class_method_calls.set(class_name, (class_method_calls.get(class_name) || 0) + 1);
    }
  }

  if (class_method_calls.size > 0) {
    console.log("\nMethod calls by class:");
    for (const [class_name, count] of class_method_calls) {
      console.log(`  ${class_name}: ${count} method calls`);
    }
  }
}

/**
 * Example 5: Find symbol dependencies
 *
 * Shows how to trace dependencies between symbols.
 */
function find_symbol_dependencies(
  resolved_symbols: ResolvedSymbols,
  symbol_id: SymbolId
): Set<SymbolId> {
  const dependencies = new Set<SymbolId>();

  // Find all locations where this symbol is referenced
  const references = resolved_symbols.references_to_symbol.get(symbol_id) || [];

  // For each reference location, find what symbols are called from there
  for (const ref_location of references) {
    // Check if there are any calls from this location
    for (const [location_key, called_symbol] of resolved_symbols.resolved_references) {
      const location = parse_location_key(location_key);
      if (location.file_path === ref_location.file_path &&
          Math.abs(location.line - ref_location.line) < 10) {
        dependencies.add(called_symbol);
      }
    }
  }

  return dependencies;
}

/**
 * Example 6: Generate call graph data
 *
 * Shows how to build a call graph from resolved symbols.
 */
function generate_call_graph(resolved_symbols: ResolvedSymbols): CallGraphData {
  const nodes = new Set<SymbolId>();
  const edges: Array<{ from: SymbolId; to: SymbolId }> = [];

  // Add all function calls as edges
  for (const [location_key, called_symbol] of resolved_symbols.phases.functions.function_calls) {
    // Find the calling symbol (would need more context in real implementation)
    // For now, we'll just add the called symbol as a node
    nodes.add(called_symbol);
  }

  // Add all method calls as edges
  for (const [location, called_symbol] of resolved_symbols.phases.methods.method_calls) {
    nodes.add(called_symbol);
  }

  // Build edges from the references_to_symbol mapping
  for (const [symbol_id, locations] of resolved_symbols.references_to_symbol) {
    nodes.add(symbol_id);
    // In a real implementation, you would determine the calling context
    // to create proper edges
  }

  return {
    nodes: Array.from(nodes),
    edges,
    stats: {
      total_nodes: nodes.size,
      total_edges: edges.length,
      max_degree: calculate_max_degree(edges),
    },
  };
}

/**
 * Example 7: Detect circular dependencies
 *
 * Shows how to identify circular import dependencies.
 */
function detect_circular_dependencies(resolved_symbols: ResolvedSymbols): CircularDependency[] {
  const circular_deps: CircularDependency[] = [];
  const import_graph = new Map<FilePath, Set<FilePath>>();

  // Build import graph
  for (const [file_path, file_imports] of resolved_symbols.phases.imports.imports) {
    const imported_files = new Set<FilePath>();

    for (const symbol_id of file_imports.values()) {
      // Extract file path from symbol_id
      const match = symbol_id.match(/^[^:]+:[^:]+:([^:]+):/);
      if (match) {
        imported_files.add(match[1] as FilePath);
      }
    }

    import_graph.set(file_path, imported_files);
  }

  // DFS to detect cycles
  const visited = new Set<FilePath>();
  const stack = new Set<FilePath>();

  function dfs(file: FilePath, path: FilePath[]): void {
    if (stack.has(file)) {
      // Found a cycle
      const cycle_start = path.indexOf(file);
      const cycle = path.slice(cycle_start).concat(file);
      circular_deps.push({ files: cycle });
      return;
    }

    if (visited.has(file)) {
      return;
    }

    visited.add(file);
    stack.add(file);

    const imports = import_graph.get(file) || new Set();
    for (const imported_file of imports) {
      dfs(imported_file, [...path, file]);
    }

    stack.delete(file);
  }

  for (const file of import_graph.keys()) {
    if (!visited.has(file)) {
      dfs(file, []);
    }
  }

  return circular_deps;
}

/**
 * Example 8: Performance analysis
 *
 * Shows how to measure and analyze resolution performance.
 */
async function performance_analysis_example() {
  console.log("=== Performance Analysis Example ===\n");

  const source_files = await load_source_files("./src");
  const semantic_indices = await build_semantic_indices(source_files);

  // Measure each phase
  const phase_timings: Record<string, number> = {};

  const total_start = performance.now();

  // Time the complete resolution
  const resolution_start = performance.now();
  const resolved_symbols = resolve_symbols({ indices: semantic_indices });
  const resolution_time = performance.now() - resolution_start;

  // Time the export
  const export_start = performance.now();
  const exported_data = export_symbol_resolution_data(resolved_symbols, "json");
  const export_time = performance.now() - export_start;

  const total_time = performance.now() - total_start;

  // Calculate metrics
  const files_count = semantic_indices.size;
  const symbols_count = count_total_symbols(resolved_symbols);
  const time_per_file = resolution_time / files_count;
  const time_per_symbol = resolution_time / symbols_count;

  console.log("Performance Metrics:");
  console.log(`  Files processed: ${files_count}`);
  console.log(`  Symbols resolved: ${symbols_count}`);
  console.log(`  Total time: ${total_time.toFixed(2)}ms`);
  console.log(`  Resolution time: ${resolution_time.toFixed(2)}ms`);
  console.log(`  Export time: ${export_time.toFixed(2)}ms`);
  console.log(`  Time per file: ${time_per_file.toFixed(2)}ms`);
  console.log(`  Time per symbol: ${time_per_symbol.toFixed(4)}ms`);

  // Memory usage
  const memory = process.memoryUsage();
  console.log(`\nMemory Usage:`);
  console.log(`  Heap used: ${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Heap total: ${(memory.heapTotal / 1024 / 1024).toFixed(2)}MB`);
}

// Type definitions for examples
interface CallGraphData {
  nodes: SymbolId[];
  edges: Array<{ from: SymbolId; to: SymbolId }>;
  stats: {
    total_nodes: number;
    total_edges: number;
    max_degree: number;
  };
}

interface CircularDependency {
  files: FilePath[];
}

// Placeholder functions (would be implemented in a real application)
async function load_source_files(directory: string): Promise<any[]> {
  // Implementation would load and parse source files
  return [];
}

async function build_semantic_indices(source_files: any[]): Promise<Map<FilePath, SemanticIndex>> {
  // Implementation would build semantic indices from source files
  return new Map();
}

async function save_exported_data(filename: string, data: string): Promise<void> {
  // Implementation would save data to file
  console.log(`Would save ${data.length} bytes to ${filename}`);
}

function calculate_max_degree(edges: Array<{ from: SymbolId; to: SymbolId }>): number {
  const degree_map = new Map<SymbolId, number>();

  for (const edge of edges) {
    degree_map.set(edge.from, (degree_map.get(edge.from) || 0) + 1);
    degree_map.set(edge.to, (degree_map.get(edge.to) || 0) + 1);
  }

  return Math.max(...degree_map.values(), 0);
}

// Export example functions for external use
export {
  basic_usage_example,
  analyze_import_resolution,
  analyze_function_calls,
  analyze_method_calls,
  find_symbol_dependencies,
  generate_call_graph,
  detect_circular_dependencies,
  performance_analysis_example,
};