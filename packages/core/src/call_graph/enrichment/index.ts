/**
 * Standardized Call Graph Enrichment
 *
 * Provides a unified API for enriching call information with global context
 * during the Global Assembly phase. This module standardizes the enrichment
 * pattern and incorporates features from the deprecated call_resolution module.
 *
 * Key responsibilities:
 * - Enrich function calls with type information
 * - Enrich method calls with class hierarchy and polymorphic resolution
 * - Enrich constructor calls with type validation
 * - Track virtual dispatch and interface implementations
 * - Calculate confidence scores for resolutions
 */

import {
  FunctionCall,
  MethodCall,
  ConstructorCall,
  ClassHierarchy,
  FileAnalysis,
  ModuleGraph,
  ResolvedGeneric,
  TypeInfo,
  Location,
  NamespaceInfo,
  TypeFlow,
  FilePath,
} from "@ariadnejs/types";

import { TypeRegistry } from "../../type_analysis/type_registry";

import {
  enrich_method_calls_with_hierarchy,
} from "../method_calls/method_hierarchy_resolver";

import {
  enrich_constructor_calls_with_types,
} from "../constructor_calls/constructor_type_resolver";

/**
 * Context for enrichment operations containing global information
 */
export interface EnrichmentContext {
  type_registry: TypeRegistry;
  class_hierarchy: ClassHierarchy;
  module_graph: ModuleGraph;
  resolved_generics: Map<FilePath, ResolvedGeneric[]>; // Arrays of resolved generics per type
  propagated_types: Map<FilePath, TypeFlow[]>; // Type flows or other type info by file path
  namespace_resolutions: Map<FilePath, NamespaceInfo>; // Namespace imports and their exported members
}

/**
 * Options to control enrichment behavior
 */
export interface EnrichmentOptions {
  resolve_polymorphic: boolean; // Resolve polymorphic method calls
  track_interfaces: boolean; // Track interface implementations
  include_confidence: boolean; // Include confidence scoring
  resolve_virtual_dispatch: boolean; // Analyze virtual method dispatch
  validate_constructors: boolean; // Validate constructor calls
  track_inheritance: boolean; // Track inheritance chains
}




/**
 * Resolved target for polymorphic dispatch
 */
export interface ResolvedTarget {
  class: string;
  method: string;
  is_override: boolean;
  confidence: number;
}

/**
 * Type of method dispatch
 */
export enum DispatchType {
  STATIC = "static", // Compile-time resolution
  VIRTUAL = "virtual", // Runtime dispatch through vtable
  INTERFACE = "interface", // Interface method dispatch
  DYNAMIC = "dynamic", // Dynamic dispatch (duck typing)
}

/**
 * Enrich all call types in a file analysis with global context
 *
 * This is the main entry point for call enrichment during Global Assembly.
 * It applies all available enrichments based on the provided context and options.
 *
 * @param analysis File analysis containing calls to enrich
 * @param context Global context for enrichment
 * @param options Options to control enrichment behavior
 * @returns Enriched file analysis
 */
export function enrich_all_calls(
  analysis: FileAnalysis,
  context: EnrichmentContext,
  options: EnrichmentOptions
): FileAnalysis {
  return {
    ...analysis,
    function_calls: enrich_function_calls(
      analysis.function_calls,
      context,
      options
    ),
    method_calls: enrich_method_calls(analysis.method_calls, context, options),
    constructor_calls: enrich_constructor_calls(
      analysis.constructor_calls,
      context,
      options
    ),
  };
}

/**
 * Enrich function calls with type and module information
 *
 * @param calls Function calls to enrich
 * @param context Enrichment context
 * @param options Enrichment options
 * @returns Enriched function calls
 */
export function enrich_function_calls(
  calls: readonly FunctionCall[],
  context: EnrichmentContext,
  options: Required<EnrichmentOptions>
): EnrichedFunctionCall[] {
  return calls.map((call) => {
    const enriched: EnrichedFunctionCall = { ...call };

    // Skip if already resolved locally in Phase 1
    if (call.resolved_target) {
      // Already resolved locally, just add confidence
      if (options.include_confidence) {
        enriched.confidence_score = 1.0; // High confidence for local resolution
      }
      return enriched;
    }

    // Check if this is a namespace member call (e.g., namespace.function)
    if (call.callee_name.includes(".")) {
      const [namespace, member] = call.callee_name.split(".", 2);
      const namespace_key =
        `${call.location.file_path}:${namespace}` as FilePath;
      const namespace_info = context.namespace_resolutions.get(namespace_key);

      if (namespace_info) {
        const member_export = namespace_info.exports.get(member);
        if (member_export && member_export.kind === "function") {
          // Don't overwrite is_imported if already set in Phase 1
          enriched.cross_file_resolved = true;
        }
      }
    }

    // Only check module graph if not already marked as imported in Phase 1
    if (!call.is_imported && call.location.file_path) {
      const module_info = context.module_graph.modules.get(
        call.location.file_path
      );

      if (module_info && module_info.imports) {
        // Module imports are a different type, need to handle carefully
        // For now, mark as cross-file resolved if we can find it
        enriched.cross_file_resolved = true;
      }
    }

    // Try to resolve return types from global type flow
    if (context.propagated_types && call.location.file_path) {
      const type_flows = context.propagated_types.get(call.location.file_path);
      if (type_flows && type_flows.length > 0) {
        // Try to find type flow for this function
        const matching_flow = type_flows.find(
          (flow: any) => flow.symbol === call.callee_name
        );
        if (matching_flow) {
          enriched.return_type =
            (matching_flow as any).type_name ||
            (matching_flow as any).inferred_type;
        }
      }
    }

    // Calculate confidence score
    if (options.include_confidence) {
      enriched.confidence_score = calculate_function_confidence(enriched);
    }

    return enriched;
  });
}

/**
 * Enrich method calls with hierarchy and polymorphic resolution
 *
 * @param calls Method calls to enrich
 * @param context Enrichment context
 * @param options Enrichment options
 * @returns Enriched method calls
 */
export function enrich_method_calls(
  calls: readonly MethodCall[],
  context: EnrichmentContext,
  options: Required<EnrichmentOptions>
): EnrichedMethodCall[] {
  // First apply existing hierarchy enrichment
  const hierarchy_enriched = enrich_method_calls_with_hierarchy(
    calls,
    context.class_hierarchy
  );

  // Then add advanced features from call_resolution
  return hierarchy_enriched.map((call) => {
    const enriched: EnrichedMethodCall = { ...call };

    // Check if this is a namespace member method call (e.g., namespace.Class.method)
    if (
      context.namespace_resolutions &&
      enriched.receiver_type &&
      enriched.receiver_type.includes(".")
    ) {
      const parts = enriched.receiver_type.split(".");
      if (parts.length >= 2) {
        const namespace = parts[0];
        const className = parts[1];
        const namespace_key =
          `${call.location.file_path}:${namespace}` as FilePath;
        const namespace_info = context.namespace_resolutions.get(namespace_key);

        if (namespace_info) {
          const member_export = namespace_info.exports.get(className);
          if (member_export && member_export.kind === "class") {
            enriched.receiver_type = className;
            enriched.defining_class_resolved = `${namespace_info.source_path}#${className}`;
          }
        }
      }
    }

    // Add polymorphic resolution
    if (options.resolve_polymorphic && enriched.receiver_type) {
      const targets = resolve_polymorphic_targets(
        enriched,
        context.class_hierarchy
      );

      if (targets.length > 0) {
        enriched.possible_targets = targets;
        enriched.dispatch_type = determine_dispatch_type(call, targets);
      }
    }

    // Track interface implementations
    if (options.track_interfaces && enriched.receiver_type) {
      enriched.interface_implementations = find_interface_implementations(
        enriched,
        context.class_hierarchy
      );
    }

    // Calculate confidence score
    if (options.include_confidence) {
      enriched.confidence_score = calculate_method_confidence(
        enriched,
        context.class_hierarchy
      );
    }

    return enriched;
  });
}

/**
 * Enrich constructor calls with type validation and resolution
 *
 * @param calls Constructor calls to enrich
 * @param context Enrichment context
 * @param options Enrichment options
 * @returns Enriched constructor calls
 */
export function enrich_constructor_calls(
  calls: readonly ConstructorCall[],
  context: EnrichmentContext,
  options: Required<EnrichmentOptions>
): EnrichedConstructorCall[] {
  // Get import information for validation
  const imports_by_file = new Map<string, any[]>();
  for (const [path, module_info] of context.module_graph.modules) {
    if (module_info.imports) {
      imports_by_file.set(path, module_info.imports);
    }
  }

  // First apply existing type validation
  const type_enriched = enrich_constructor_calls_with_types(
    calls,
    context.type_registry,
    imports_by_file
  );

  // Then add advanced features
  return type_enriched.map((call) => {
    const enriched: EnrichedConstructorCall = { ...call };

    // Check if this is a namespace member constructor (e.g., namespace.Class)
    if (context.namespace_resolutions && call.constructor_name.includes(".")) {
      const [namespace, member] = call.constructor_name.split(".", 2);
      const namespace_key =
        `${call.location.file_path}:${namespace}` as FilePath;
      const namespace_info = context.namespace_resolutions.get(namespace_key);

      if (namespace_info) {
        const member_export = namespace_info.exports.get(member);
        if (
          member_export &&
          (member_export.kind === "class" || member_export.kind === "type")
        ) {
          enriched.resolved_type = `${namespace_info.source_path}#${member}`;
          enriched.is_imported = true;
        }
      }
    }

    // Check if trying to instantiate abstract class
    if (options.validate_constructors && call.constructor_name) {
      const class_info = context.class_hierarchy.classes.get(
        call.constructor_name as any
      );
      if (class_info?.is_abstract) {
        enriched.is_abstract = true;
        enriched.is_valid = false;
      }
    }

    // Resolve generic type parameters if available
    if (context.resolved_generics && call.location) {
      const generic_key =
        `${call.location.file_path}#${call.constructor_name}` as FilePath;
      const resolved_array = context.resolved_generics.get(generic_key);
      if (resolved_array && resolved_array.length > 0) {
        // Use the first resolved generic or combine type arguments from all
        enriched.type_parameters = resolved_array[0].type_arguments;
      }
    }

    return enriched;
  });
}

/**
 * Resolve polymorphic targets for a method call
 */
function resolve_polymorphic_targets(
  call: any,
  hierarchy: ClassHierarchy
): ResolvedTarget[] {
  const targets: ResolvedTarget[] = [];

  if (!call.receiver_type) {
    return targets;
  }

  const base_class = hierarchy.classes.get(call.receiver_type as any);
  if (!base_class) {
    return targets;
  }

  // Check if base class has the method
  if (base_class.methods && base_class.methods.has(call.method_name as any)) {
    targets.push({
      class: call.receiver_type,
      method: call.method_name,
      is_override: false,
      confidence: 1.0,
    });
  }

  // Check all derived classes for overrides
  for (const [class_name, class_info] of hierarchy.classes) {
    if (class_info.base_classes?.includes(call.receiver_type)) {
      if (
        class_info.methods &&
        class_info.methods.has(call.method_name as any)
      ) {
        targets.push({
          class: class_name,
          method: call.method_name,
          is_override: true,
          confidence: calculate_dispatch_probability(call, class_info),
        });
      }
    }
  }

  return targets;
}

/**
 * Determine the type of dispatch for a method call
 */
function determine_dispatch_type(
  call: MethodCall,
  targets: ResolvedTarget[]
): DispatchType {
  if (targets.length === 0) {
    return DispatchType.DYNAMIC;
  }

  if (targets.length === 1) {
    return DispatchType.STATIC;
  }

  // Multiple targets indicate virtual dispatch
  const has_interface = targets.some(
    (t) => t.class.includes("interface") || t.class.includes("trait")
  );

  return has_interface ? DispatchType.INTERFACE : DispatchType.VIRTUAL;
}

/**
 * Find interface implementations for a method
 */
function find_interface_implementations(
  call: any,
  hierarchy: ClassHierarchy
): string[] {
  const implementations: string[] = [];

  if (!call.receiver_type) {
    return implementations;
  }

  const class_info = hierarchy.classes.get(call.receiver_type as any);
  if (!class_info?.interface_nodes) {
    return implementations;
  }

  // Check each implemented interface
  for (const interface_node of class_info.interface_nodes) {
    const interface_key = `${interface_node.file_path}#${interface_node.name}`;
    const interface_info = hierarchy.classes.get(interface_key);

    if (interface_info?.methods?.has(call.method_name as any)) {
      implementations.push(interface_key);
    }
  }

  return implementations;
}

/**
 * Calculate dispatch probability for polymorphic resolution
 */
function calculate_dispatch_probability(
  call: MethodCall,
  target_class: any
): number {
  // Simple heuristic based on class depth and usage
  // In a real implementation, this could use:
  // - Call site analysis
  // - Type flow analysis
  // - Historical profiling data

  // For now, use a simple depth-based heuristic
  const depth = target_class.base_classes?.length || 0;
  return Math.max(0.1, 1.0 - depth * 0.2);
}

/**
 * Calculate confidence score for method resolution
 */
function calculate_method_confidence(
  call: EnrichedMethodCall,
  hierarchy: ClassHierarchy
): number {
  let score = 0.0;

  // Base score from receiver type resolution
  if (call.receiver_type) {
    score += 0.3;

    // Higher confidence if class exists in hierarchy
    if (hierarchy.classes.has(call.receiver_type)) {
      score += 0.3;
    }
  }

  // Method definition found
  if (call.defining_class_resolved) {
    score += 0.3;
  }

  // Single target (no ambiguity)
  if (call.possible_targets && call.possible_targets.length === 1) {
    score += 0.1;
  }

  return Math.min(1.0, score);
}

/**
 * Calculate confidence score for function resolution
 */
function calculate_function_confidence(call: EnrichedFunctionCall): number {
  let score = 0.0;

  // Function resolved locally (highest confidence)
  if (call.resolved_target) {
    score += 0.5;
  }

  // Import information available
  if (call.is_imported !== undefined) {
    score += 0.3;
  }

  // Type information available
  if (call.return_type) {
    score += 0.1;
  }

  // Cross-file resolution
  if (call.cross_file_resolved) {
    score += 0.1;
  }

  return Math.min(1.0, score);
}

/**
 * Batch enrich multiple file analyses
 *
 * @param analyses File analyses to enrich
 * @param context Enrichment context
 * @param options Enrichment options
 * @returns Enriched file analyses
 */
export function batch_enrich_analyses(
  analyses: FileAnalysis[],
  context: EnrichmentContext,
  options: Partial<EnrichmentOptions> = {}
): FileAnalysis[] {
  // Provide default values for all required options
  const fullOptions: EnrichmentOptions = {
    resolve_polymorphic: false,
    track_interfaces: false,
    include_confidence: false,
    resolve_virtual_dispatch: false,
    validate_constructors: false,
    track_inheritance: false,
    ...options,
  };

  return analyses.map((analysis) =>
    enrich_all_calls(analysis, context, fullOptions)
  );
}
