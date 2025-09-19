/**
 * Call References - Process function/method/constructor calls (IMPROVED VERSION)
 *
 * This version fixes bugs and improves the original implementation:
 * 1. Better type safety and validation
 * 2. Removes mutation side effects
 * 3. Adds missing implementations
 * 4. Better performance and error handling
 */

import type {
  FilePath,
  SymbolName,
  SymbolId,
  ScopeId,
  LexicalScope,
  Location,
  TypeId,
} from "@ariadnejs/types";
import { node_to_location } from "../../../ast/node_utils";
import { find_containing_scope } from "../../scope_tree";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity } from "../../capture_types";
import type { TypeInfo } from "../type_tracking";

/**
 * Enhanced symbol interface with proper typing
 */
export interface ClassSymbol {
  readonly kind: "class";
  readonly name: string;
  readonly methods?: readonly SymbolId[];
  readonly static_methods?: readonly SymbolId[];
  readonly parent_class?: SymbolId;
}

export interface MethodSymbol {
  readonly kind: "method";
  readonly name: string;
  readonly is_static?: boolean;
  readonly return_type?: TypeId;
}

export type Symbol = ClassSymbol | MethodSymbol | { readonly kind: string; readonly name: string };

/**
 * Call reference - Represents a function/method/constructor call (IMPROVED)
 */
export interface CallReference {
  /** Reference location */
  readonly location: Location;

  /** Name being called */
  readonly name: SymbolName;

  /** Containing scope */
  readonly scope_id: ScopeId;

  /** Type of call */
  readonly call_type: "function" | "method" | "constructor" | "super";

  /** For method calls: receiver type and location */
  readonly receiver?: {
    readonly type?: TypeInfo;
    readonly type_id?: TypeId;  // Resolved TypeId
    readonly location?: Location;
  };

  /** For constructor calls: the instance being created */
  readonly construct_target?: Location;

  /** Containing function for call chain tracking */
  readonly containing_function?: SymbolId;

  /** For super calls: parent class */
  readonly super_class?: SymbolName;

  /** For method calls: whether the receiver is static */
  readonly is_static_call?: boolean;

  // These remain mutable for resolution phase
  resolved_symbol?: SymbolId;
  resolved_return_type?: TypeId;
}

/**
 * Method resolution result - separates resolution from mutation
 */
export interface MethodResolution {
  readonly call_location: Location;
  readonly resolved_symbol: SymbolId;
  readonly resolved_return_type?: TypeId;
}

/**
 * Validation error for invalid captures
 */
export class InvalidCaptureError extends Error {
  constructor(message: string, public readonly capture: NormalizedCapture) {
    super(message);
    this.name = 'InvalidCaptureError';
  }
}

/**
 * Validate symbol name from capture text
 */
function validate_symbol_name(text: string, capture: NormalizedCapture): SymbolName {
  if (typeof text !== 'string') {
    throw new InvalidCaptureError(`Symbol name must be a string, got ${typeof text}`, capture);
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new InvalidCaptureError('Symbol name cannot be empty or whitespace only', capture);
  }

  return trimmed as SymbolName;
}

/**
 * Safely extract super class name from context
 */
function extract_super_class(context: any): SymbolName | undefined {
  if (!context?.extends_class) return undefined;

  if (typeof context.extends_class !== 'string') {
    return undefined; // Silently ignore invalid types
  }

  const trimmed = context.extends_class.trim();
  return trimmed.length > 0 ? (trimmed as SymbolName) : undefined;
}

/**
 * Detect if a method call is static from context
 */
function detect_static_call(context: any): boolean | undefined {
  if (context?.is_static === true) return true;
  if (context?.is_static === false) return false;
  return undefined; // Cannot determine
}

/**
 * Infer type information from context
 */
function infer_receiver_type(context: any): TypeInfo | undefined {
  if (context?.receiver_type && typeof context.receiver_type === 'string') {
    return { type_name: context.receiver_type as SymbolName };
  }
  return undefined;
}

/**
 * Process call references (IMPROVED)
 */
export function process_call_references(
  captures: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath,
  scope_to_symbol?: Map<ScopeId, SymbolId>
): CallReference[] {
  const calls: CallReference[] = [];
  const errors: InvalidCaptureError[] = [];

  // Filter for call-related entities
  const call_captures = captures.filter(c =>
    c.entity === SemanticEntity.CALL ||
    c.entity === SemanticEntity.SUPER
  );

  for (const capture of call_captures) {
    try {
      const scope = find_containing_scope(
        capture.node_location,
        root_scope,
        scopes
      );

      if (!scope) {
        throw new InvalidCaptureError('No containing scope found for capture', capture);
      }

      const call = create_call_reference(
        capture,
        scope,
        scopes,
        file_path,
        scope_to_symbol
      );

      calls.push(call);
    } catch (error) {
      if (error instanceof InvalidCaptureError) {
        errors.push(error);
      } else {
        // Re-throw unexpected errors
        throw error;
      }
    }
  }

  // For now, log errors but don't fail the entire operation
  if (errors.length > 0) {
    console.warn(`Skipped ${errors.length} invalid call captures:`, errors.map(e => e.message));
  }

  return calls;
}

/**
 * Create a call reference from a capture (IMPROVED)
 */
function create_call_reference(
  capture: NormalizedCapture,
  scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath,
  scope_to_symbol?: Map<ScopeId, SymbolId>
): CallReference {
  const context = capture.context;
  const location = capture.node_location;
  const name = validate_symbol_name(capture.text, capture);

  // Determine call type
  let call_type: CallReference["call_type"] = "function";
  if (context?.construct_target) {
    call_type = "constructor";
  } else if (context?.receiver_node) {
    call_type = "method";
  } else if (capture.entity === SemanticEntity.SUPER) {
    call_type = "super";
  }

  // Build receiver info for method calls with better type inference
  let receiver: CallReference["receiver"];
  if (context?.receiver_node) {
    try {
      const receiver_location = node_to_location(context.receiver_node, file_path);
      const inferred_type = infer_receiver_type(context);

      receiver = {
        location: receiver_location,
        type: inferred_type,
      };
    } catch (error) {
      throw new InvalidCaptureError(
        `Failed to process receiver node: ${error instanceof Error ? error.message : 'Unknown error'}`,
        capture
      );
    }
  }

  // Detect static calls
  const is_static_call = call_type === "method" ? detect_static_call(context) : undefined;

  // Get containing function for call chain tracking
  const containing_function = get_containing_function(
    scope,
    scopes,
    scope_to_symbol
  );

  // Process construct target safely
  let construct_target: Location | undefined;
  if (context?.construct_target) {
    try {
      construct_target = node_to_location(context.construct_target, file_path);
    } catch (error) {
      throw new InvalidCaptureError(
        `Failed to process construct target: ${error instanceof Error ? error.message : 'Unknown error'}`,
        capture
      );
    }
  }

  return {
    location,
    name,
    scope_id: scope.id,
    call_type,
    receiver,
    construct_target,
    containing_function,
    super_class: extract_super_class(context),
    is_static_call,
  };
}

/**
 * Get containing function symbol (IMPROVED with better error handling)
 */
function get_containing_function(
  scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  scope_to_symbol?: Map<ScopeId, SymbolId>
): SymbolId | undefined {
  if (!scope_to_symbol) return undefined;

  let current: LexicalScope | undefined = scope;
  const visited = new Set<ScopeId>(); // Prevent infinite loops

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    if (
      current.type === "function" ||
      current.type === "method" ||
      current.type === "constructor"
    ) {
      return scope_to_symbol.get(current.id);
    }

    current = current.parent_id ? scopes.get(current.parent_id) : undefined;
  }

  return undefined;
}

/**
 * Resolve method calls using receiver types (IMPROVED - no mutation)
 */
export function resolve_method_calls(
  calls: readonly CallReference[],
  symbols: Map<SymbolId, Symbol>
): MethodResolution[] {
  const resolutions: MethodResolution[] = [];

  // Create lookup map for better performance
  const class_lookup = new Map<string, { symbol_id: SymbolId; class_symbol: ClassSymbol }>();
  const method_lookup = new Map<SymbolId, MethodSymbol>();

  // Build lookup maps
  for (const [id, symbol] of symbols) {
    if (symbol.kind === "class") {
      const class_symbol = symbol as ClassSymbol;
      class_lookup.set(class_symbol.name, { symbol_id: id, class_symbol });
    } else if (symbol.kind === "method") {
      method_lookup.set(id, symbol as MethodSymbol);
    }
  }

  for (const call of calls) {
    if (call.call_type !== "method" || !call.receiver?.type) continue;

    const class_info = class_lookup.get(call.receiver.type.type_name);
    if (!class_info) continue;

    const { class_symbol } = class_info;

    // Look for method in class (with proper array validation)
    const methods = Array.isArray(class_symbol.methods) ? class_symbol.methods : [];
    const static_methods = Array.isArray(class_symbol.static_methods) ? class_symbol.static_methods : [];

    // Search in appropriate method list based on call type
    const search_methods = call.is_static_call ? static_methods : methods;

    for (const method_id of search_methods) {
      const method = method_lookup.get(method_id);
      if (method?.name === call.name) {
        resolutions.push({
          call_location: call.location,
          resolved_symbol: method_id,
          resolved_return_type: method.return_type,
        });
        break; // Found the method, stop searching
      }
    }
  }

  return resolutions;
}

/**
 * Apply method resolutions to calls (separate function for mutation)
 */
export function apply_method_resolutions(
  calls: CallReference[],
  resolutions: readonly MethodResolution[]
): void {
  const resolution_map = new Map<Location, MethodResolution>();

  for (const resolution of resolutions) {
    resolution_map.set(resolution.call_location, resolution);
  }

  for (const call of calls) {
    const resolution = resolution_map.get(call.location);
    if (resolution) {
      call.resolved_symbol = resolution.resolved_symbol;
      call.resolved_return_type = resolution.resolved_return_type;
    }
  }
}

/**
 * Build call graph from call references (IMPROVED)
 */
export interface CallGraphNode {
  readonly symbol: SymbolId;
  readonly calls_to: ReadonlySet<SymbolId>;
  readonly called_by: ReadonlySet<SymbolId>;
  readonly call_sites: readonly CallReference[];
}

export function build_call_graph(
  calls: readonly CallReference[]
): Map<SymbolId, CallGraphNode> {
  const graph = new Map<SymbolId, {
    symbol: SymbolId;
    calls_to: Set<SymbolId>;
    called_by: Set<SymbolId>;
    call_sites: CallReference[];
  }>();

  for (const call of calls) {
    if (!call.resolved_symbol || !call.containing_function) continue;

    const caller = call.containing_function;
    const callee = call.resolved_symbol;

    // Ensure nodes exist
    if (!graph.has(caller)) {
      graph.set(caller, {
        symbol: caller,
        calls_to: new Set(),
        called_by: new Set(),
        call_sites: [],
      });
    }

    if (!graph.has(callee)) {
      graph.set(callee, {
        symbol: callee,
        calls_to: new Set(),
        called_by: new Set(),
        call_sites: [],
      });
    }

    // Add edges
    graph.get(caller)!.calls_to.add(callee);
    graph.get(callee)!.called_by.add(caller);
    graph.get(caller)!.call_sites.push(call);
  }

  // Convert to readonly interface
  const readonly_graph = new Map<SymbolId, CallGraphNode>();
  for (const [id, node] of graph) {
    readonly_graph.set(id, {
      symbol: node.symbol,
      calls_to: new Set(node.calls_to) as ReadonlySet<SymbolId>,
      called_by: new Set(node.called_by) as ReadonlySet<SymbolId>,
      call_sites: [...node.call_sites],
    });
  }

  return readonly_graph;
}