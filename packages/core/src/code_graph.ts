/**
 * Code Graph Generation
 *
 * Main entry point for analyzing a codebase and generating a comprehensive code graph.
 */

import { analyze_file } from "./file_analyzer";
import { build_module_graph } from "./import_export/module_graph";
import { build_type_registry } from "./type_analysis/type_registry/type_registry";
import { build_type_index } from "./type_analysis/type_tracking";
import { resolve_namespaces_across_files } from "./import_export/namespace_resolution";
import {
  Language,
  // Main types
  CodeGraph,
  CodeGraphOptions,
  FilePath,
  // Scope types
} from "@ariadnejs/types";
import type { FileAnalysis, Import } from "@ariadnejs/types";
import {
  build_class_hierarchy_from_analyses,
} from "./inheritance/class_hierarchy";
import {
  createAnalysisCache,
} from "./cache/analysis_cache";
import {
  scan_files,
  read_and_parse_file,
} from "./project/file_scanner";
import {
  enrich_all_calls,
  EnrichmentContext,
  EnrichmentOptions,
} from "./call_graph/enrichment";
import { create_call_graph } from "./call_graph/call_chain_analysis";
import {
  build_symbol_table,
  build_symbol_index,
} from "./scope_analysis/symbol_resolution";
import { resolve_all_symbols } from "./scope_analysis/symbol_resolution";
import { resolve_generics_across_files } from "./type_analysis/generic_resolution";
import { propagate_types_across_files } from "./type_analysis/type_propagation";

/**
 * Resolve namespace imports and their members across all files
 *
 * This function identifies namespace imports, resolves their exported members,
 * and tracks namespace member access patterns across the codebase.
 */

/**
 * Generate a comprehensive code graph from a codebase
 *
 * This is the main entry point for code analysis. It scans the specified
 * directory, analyzes all matching files, and builds a complete graph
 * representing the code structure and relationships.
 *
 * @param options Configuration for code graph generation
 * @returns A complete code graph of the analyzed codebase
 *
 * @example
 * const graph = await generate_code_graph({
 *   root_path: "/path/to/project",
 *   include_patterns: ["src/**.ts"],
 *   exclude_patterns: ["**.test.ts"]
 * });
 */
export async function generate_code_graph(
  options: CodeGraphOptions
): Promise<CodeGraph> {
  const start_time = Date.now();

  // Create cache if enabled
  const cache = createAnalysisCache({
    enabled: options.cache?.enabled ?? false,
    ttl: options.cache?.ttl,
    maxSize: options.cache?.maxSize,
  });

  // FILE SCAN
  const file_paths = await scan_files(
    options.root_path,
    options.include_patterns,
    options.exclude_patterns
  );

  console.log(`Found ${file_paths.length} files to analyze`);
  if (cache.getStats().enabled) {
    console.log(`Cache enabled with TTL: ${options.cache?.ttl || 900000}ms`);
  }

  // FILE ANALYSIS WITH CACHING
  const analysis_promises = file_paths.map(async (file_path) => {
    const file = await read_and_parse_file(file_path);

    // Check cache first
    const cachedAnalysis = cache.getCachedAnalysis(file_path, file.source_code);
    if (cachedAnalysis) {
      console.debug(`Cache hit for ${file_path}`);
      // Still need to return with tree for compatibility
      const { tree } = await analyze_file(file); // Parse tree only
      return { analysis: cachedAnalysis, tree };
    }

    // Analyze and cache result
    const result = await analyze_file(file);
    cache.cacheAnalysis(file_path, file.source_code, result.analysis);
    return result;
  });

  const analysis_and_trees = await Promise.all(analysis_promises);

  const analyses = analysis_and_trees.map((analysis) => analysis.analysis);
  const file_name_to_tree = new Map(
    analysis_and_trees.map((analysis) => [
      analysis.analysis.file_path,
      analysis.tree,
    ])
  );

  // TYPE REGISTRY - Build unified type registry from all files (needed for enrichment)
  const type_registry = build_type_registry(analyses);

  // CLASS HIERARCHY - Build inheritance tree from all classes (needed for enrichment)
  const class_hierarchy = await build_class_hierarchy_from_analyses(
    analyses,
    file_name_to_tree
  );

  // TODO: LAYER 9 - Global Call Resolution
  // After class hierarchy and type registry are built (Layers 6-7),
  // resolve method and constructor calls using global information:
  // const { resolve_all_calls } = await import('./call_graph/call_resolution');
  // const resolved = resolve_all_calls(
  //   all_method_calls,
  //   all_constructor_calls,
  //   classes,
  //   type_registry
  // );

  // METHOD HIERARCHY ENRICHMENT (task 11.62.5)
  // Enrich method calls with class hierarchy information

  // CONSTRUCTOR TYPE VALIDATION (task 11.62.6)
  // Validate and enrich constructor calls with type registry

  // Create imports map for cross-file resolution
  const imports_by_file = new Map<FilePath, Import[]>();
  for (const analysis of analyses) {
    // Note: analysis.imports are ImportStatement[], but we need ImportInfo[]
    // This is a type mismatch we need to handle - for now, skip the imports
    // TODO: Fix type conversion between ImportStatement and ImportInfo
    imports_by_file.set(analysis.file_path, []);
  }

  // We'll enrich analyses after building the module graph and resolving types
  // let enriched_analyses = analyses as FileAnalysis[];

  // FILE ANALYSIS - Build files map from enriched analyses
  const files = new Map<FilePath, FileAnalysis>();
  const language_stats = new Map<Language, number>();

  // TODO: why was this here before? It's set with FileAnalysis later...
  // for (const analysis of analyses) {
  //   files.set(analysis.file_path, analysis);
  //   const count = language_stats.get(analysis.language) || 0;
  //   language_stats.set(analysis.language, count + 1);
  // }

  // MODULE GRAPH - Build from enriched analyses
  const file_data = new Map(
    analyses.map((a) => [
      a.file_path,
      {
        file_path: a.file_path,
        language: a.language,
        imports: a.imports,
        exports: a.exports,
      },
    ])
  );

  const modules = build_module_graph(file_data, {
    root_path: options.root_path,
    include_external: false,
  });

  // LAYER 7 - Cross-File Type Resolution (Generic Resolution)
  // Resolve generic types across all analyses using the type registry and class hierarchy
  const resolved_generics = await resolve_generics_across_files(
    analyses,
    type_registry,
    class_hierarchy,
    modules
  );

  // LAYER 7b - Type Propagation (after generics)
  // Propagate types through assignments, function calls, and control flow
  const propagated_types = await propagate_types_across_files(
    analyses,
    type_registry,
    resolved_generics,
    modules
  );

  // LAYER 7c - Namespace Resolution (after type propagation)
  // Resolve namespace imports and their members across file boundaries
  const namespace_resolutions = await resolve_namespaces_across_files(
    analyses,
    modules,
    type_registry,
    propagated_types,
    file_name_to_tree
  );

  // LAYER 7d - CALL ENRICHMENT - Enrich calls with all global context now available
  // Create enrichment context with all global information
  const enrichment_context: EnrichmentContext = {
    type_registry,
    class_hierarchy,
    module_graph: modules,
    resolved_generics,
    propagated_types,
    namespace_resolutions,
  };

  // Enrichment options for comprehensive analysis
  const enrichment_options: EnrichmentOptions = {
    resolve_polymorphic: true,
    track_interfaces: true,
    include_confidence: true,
    resolve_virtual_dispatch: true,
    validate_constructors: true,
    track_inheritance: true,
  };

  // Re-enrich analyses with full global context
  const enriched_analyses = analyses.map((analysis) =>
    enrich_all_calls(analysis, enrichment_context, enrichment_options)
  );

  // Update the files map with enriched analyses
  for (const analysis of enriched_analyses) {
    files.set(analysis.file_path, analysis);
  }

  // LAYER 8: GLOBAL SYMBOL RESOLUTION - Build global symbol table and resolve references
  const global_symbols = build_symbol_table({
    analyses: enriched_analyses,
    module_graph: modules,
    type_registry,
    resolve_imports: true,
    track_visibility: true,
  });

  // LAYER 9: SYMBOL RESOLUTION - Resolve all references to their definitions
  const resolution_results = resolve_all_symbols(
    enriched_analyses,
    global_symbols
  );

  console.log(
    `Resolved ${resolution_results.resolved_calls.size} function calls`
  );
  console.log(
    `Resolved ${resolution_results.resolved_methods.size} method calls`
  );
  console.log(
    `Resolved ${resolution_results.resolved_constructors.size} constructor calls`
  );
  console.log(`Unresolved references: ${resolution_results.unresolved.length}`);

  // CALL GRAPH - Build from enriched analyses using resolved symbols
  const calls = create_call_graph(enriched_analyses, resolution_results);

  // TYPE INDEX
  const types = build_type_index(enriched_analyses);

  // SYMBOL INDEX - Enhanced with global symbol table
  const symbols = build_symbol_index(enriched_analyses, global_symbols);

  return {
    files,
    modules,
    calls,
    classes: class_hierarchy,
    types,
    symbols,
    metadata: {
      root_path: options.root_path,
      file_count: file_paths.length,
      analysis_time: Date.now() - start_time,
      language_stats,
    },
  };
}