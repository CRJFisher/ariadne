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
  FunctionCallInfo,
  MethodCallInfo,
  ConstructorCallInfo,
  ClassHierarchy,
  TypeRegistry,
  FileAnalysis,
  ModuleGraph,
  ResolvedGeneric,
  TypeInfo,
  Location
} from '@ariadnejs/types';

import { 
  enrich_method_calls_with_hierarchy,
  MethodCallWithHierarchy 
} from '../method_calls/method_hierarchy_resolver';

import { 
  enrich_constructor_calls_with_types,
  ConstructorCallWithType 
} from '../constructor_calls/constructor_type_resolver';

/**
 * Context for enrichment operations containing global information
 */
export interface EnrichmentContext {
  type_registry: TypeRegistry;
  class_hierarchy: ClassHierarchy;
  module_graph: ModuleGraph;
  resolved_generics?: Map<string, ResolvedGeneric[]>;  // Arrays of resolved generics per type
  propagated_types?: Map<string, any>;  // Type flows or other type info by file path
}

/**
 * Options to control enrichment behavior
 */
export interface EnrichmentOptions {
  resolve_polymorphic?: boolean;     // Resolve polymorphic method calls
  track_interfaces?: boolean;        // Track interface implementations
  include_confidence?: boolean;      // Include confidence scoring
  resolve_virtual_dispatch?: boolean; // Analyze virtual method dispatch
  validate_constructors?: boolean;   // Validate constructor calls
  track_inheritance?: boolean;       // Track inheritance chains
}

/**
 * Enhanced method call with polymorphic resolution and confidence
 */
export interface EnrichedMethodCall extends MethodCallWithHierarchy {
  // From call_resolution module
  possible_targets?: ResolvedTarget[];  // Polymorphic dispatch targets
  dispatch_type?: DispatchType;        // Type of dispatch (static, virtual, interface)
  confidence_score?: number;           // Resolution confidence (0-1)
  interface_implementations?: string[]; // Interfaces this method implements
}

/**
 * Enhanced constructor call with validation
 */
export interface EnrichedConstructorCall extends ConstructorCallWithType {
  // Additional validation from call_resolution
  type_parameters?: string[];          // Resolved generic type parameters
  is_abstract?: boolean;               // Whether trying to instantiate abstract class
}

/**
 * Enhanced function call with type information
 */
export interface EnrichedFunctionCall extends FunctionCallInfo {
  resolved_function?: string;          // Fully qualified function name
  return_type?: string;                // Resolved return type
  parameter_types?: string[];          // Resolved parameter types
  is_imported?: boolean;               // Whether function is imported
  confidence_score?: number;           // Resolution confidence
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
  STATIC = 'static',       // Compile-time resolution
  VIRTUAL = 'virtual',     // Runtime dispatch through vtable
  INTERFACE = 'interface', // Interface method dispatch
  DYNAMIC = 'dynamic'      // Dynamic dispatch (duck typing)
}

/**
 * Result of enrichment operations
 */
export interface EnrichedFileAnalysis extends Omit<FileAnalysis, 'function_calls' | 'method_calls' | 'constructor_calls'> {
  function_calls: EnrichedFunctionCall[];
  method_calls: EnrichedMethodCall[];
  constructor_calls: EnrichedConstructorCall[];
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
  options: EnrichmentOptions = {}
): EnrichedFileAnalysis {
  // Set default options
  const opts: Required<EnrichmentOptions> = {
    resolve_polymorphic: options.resolve_polymorphic ?? true,
    track_interfaces: options.track_interfaces ?? true,
    include_confidence: options.include_confidence ?? true,
    resolve_virtual_dispatch: options.resolve_virtual_dispatch ?? true,
    validate_constructors: options.validate_constructors ?? true,
    track_inheritance: options.track_inheritance ?? true
  };

  return {
    ...analysis,
    function_calls: enrich_function_calls(
      analysis.function_calls,
      context,
      opts
    ),
    method_calls: enrich_method_calls(
      analysis.method_calls,
      context,
      opts
    ),
    constructor_calls: enrich_constructor_calls(
      analysis.constructor_calls,
      context,
      opts
    )
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
  calls: readonly FunctionCallInfo[],
  context: EnrichmentContext,
  options: Required<EnrichmentOptions>
): EnrichedFunctionCall[] {
  return calls.map(call => {
    const enriched: EnrichedFunctionCall = { ...call };

    // Try to resolve the function through module graph
    const module_info = call.file_path ? 
      context.module_graph.modules.get(call.file_path) : undefined;
    
    if (module_info) {
      // Check if function is imported
      const imported = module_info.imports?.find(
        imp => imp.name === call.function_name
      );
      
      if (imported) {
        enriched.is_imported = true;
        enriched.resolved_function = `${imported.source}#${call.function_name}`;
      } else {
        // Local function
        enriched.resolved_function = `${call.file_path}#${call.function_name}`;
      }
    }

    // Try to resolve types if propagated types are available
    if (context.propagated_types && call.file_path) {
      // propagated_types is Map<FilePath, TypeFlow[]>
      const type_flows = context.propagated_types.get(call.file_path);
      if (type_flows && type_flows.length > 0) {
        // Try to find type flow for this function
        const matching_flow = type_flows.find((flow: any) => 
          flow.symbol === call.function_name
        );
        if (matching_flow) {
          enriched.return_type = matching_flow.type_name || matching_flow.inferred_type;
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
  calls: readonly MethodCallInfo[],
  context: EnrichmentContext,
  options: Required<EnrichmentOptions>
): EnrichedMethodCall[] {
  // First apply existing hierarchy enrichment
  const hierarchy_enriched = enrich_method_calls_with_hierarchy(
    calls,
    context.class_hierarchy
  );

  // Then add advanced features from call_resolution
  return hierarchy_enriched.map(call => {
    const enriched: EnrichedMethodCall = { ...call };

    // Add polymorphic resolution
    if (options.resolve_polymorphic && call.receiver_type) {
      const targets = resolve_polymorphic_targets(
        call,
        context.class_hierarchy
      );
      
      if (targets.length > 0) {
        enriched.possible_targets = targets;
        enriched.dispatch_type = determine_dispatch_type(call, targets);
      }
    }

    // Track interface implementations
    if (options.track_interfaces && call.receiver_type) {
      enriched.interface_implementations = find_interface_implementations(
        call,
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
  calls: readonly ConstructorCallInfo[],
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
  return type_enriched.map(call => {
    const enriched: EnrichedConstructorCall = { ...call };

    // Check if trying to instantiate abstract class
    if (options.validate_constructors && call.class_name) {
      const class_info = context.class_hierarchy.classes.get(call.class_name);
      if (class_info?.is_abstract) {
        enriched.is_abstract = true;
        enriched.is_valid = false;
      }
    }

    // Resolve generic type parameters if available
    if (context.resolved_generics && call.location) {
      const generic_key = `${call.file_path}#${call.class_name}`;
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
 * Ported from call_resolution module
 */
function resolve_polymorphic_targets(
  call: MethodCallInfo,
  hierarchy: ClassHierarchy
): ResolvedTarget[] {
  const targets: ResolvedTarget[] = [];
  
  if (!call.receiver_type) {
    return targets;
  }

  const base_class = hierarchy.classes.get(call.receiver_type);
  if (!base_class) {
    return targets;
  }

  // Check if base class has the method
  if (base_class.methods && base_class.methods.has(call.method_name)) {
    targets.push({
      class: call.receiver_type,
      method: call.method_name,
      is_override: false,
      confidence: 1.0
    });
  }

  // Check all derived classes for overrides
  for (const [class_name, class_info] of hierarchy.classes) {
    if (class_info.base_classes?.includes(call.receiver_type)) {
      if (class_info.methods && class_info.methods.has(call.method_name)) {
        targets.push({
          class: class_name,
          method: call.method_name,
          is_override: true,
          confidence: calculate_dispatch_probability(call, class_info)
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
  call: MethodCallInfo,
  targets: ResolvedTarget[]
): DispatchType {
  if (targets.length === 0) {
    return DispatchType.DYNAMIC;
  }
  
  if (targets.length === 1) {
    return DispatchType.STATIC;
  }

  // Multiple targets indicate virtual dispatch
  const has_interface = targets.some(t => 
    t.class.includes('interface') || t.class.includes('trait')
  );
  
  return has_interface ? DispatchType.INTERFACE : DispatchType.VIRTUAL;
}

/**
 * Find interface implementations for a method
 */
function find_interface_implementations(
  call: MethodCallInfo,
  hierarchy: ClassHierarchy
): string[] {
  const implementations: string[] = [];
  
  if (!call.receiver_type) {
    return implementations;
  }

  const class_info = hierarchy.classes.get(call.receiver_type);
  if (!class_info?.interface_nodes) {
    return implementations;
  }

  // Check each implemented interface
  for (const interface_node of class_info.interface_nodes) {
    const interface_key = `${interface_node.file_path}#${interface_node.name}`;
    const interface_info = hierarchy.classes.get(interface_key);
    
    if (interface_info?.methods?.has(call.method_name)) {
      implementations.push(interface_key);
    }
  }

  return implementations;
}

/**
 * Calculate dispatch probability for polymorphic resolution
 */
function calculate_dispatch_probability(
  call: MethodCallInfo,
  target_class: any
): number {
  // Simple heuristic based on class depth and usage
  // In a real implementation, this could use:
  // - Call site analysis
  // - Type flow analysis
  // - Historical profiling data
  
  // For now, use a simple depth-based heuristic
  const depth = target_class.base_classes?.length || 0;
  return Math.max(0.1, 1.0 - (depth * 0.2));
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
function calculate_function_confidence(
  call: EnrichedFunctionCall
): number {
  let score = 0.0;

  // Function resolved
  if (call.resolved_function) {
    score += 0.5;
  }

  // Import information available
  if (call.is_imported !== undefined) {
    score += 0.3;
  }

  // Type information available
  if (call.return_type) {
    score += 0.2;
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
  options: EnrichmentOptions = {}
): EnrichedFileAnalysis[] {
  return analyses.map(analysis => 
    enrich_all_calls(analysis, context, options)
  );
}