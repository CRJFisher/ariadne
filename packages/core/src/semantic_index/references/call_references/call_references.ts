/**
 * Call References - Process function/method/constructor calls
 */

import type {
  FilePath,
  SymbolName,
  SymbolId,
  ScopeId,
  LexicalScope,
  Location,
} from "@ariadnejs/types";
import { node_to_location } from "../../../ast/node_utils";
import { find_containing_scope } from "../../scope_tree";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity } from "../../capture_types";
import type { TypeInfo } from "../type_tracking";

/**
 * Call reference - Represents a function/method/constructor call
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
    type?: TypeInfo;
    location?: Location;
  };

  /** For constructor calls: the instance being created */
  readonly construct_target?: Location;

  /** Containing function for call chain tracking */
  readonly containing_function?: SymbolId;

  /** For super calls: parent class */
  readonly super_class?: SymbolName;

  /** Resolved symbol (if known) */
  resolved_symbol?: SymbolId;
}

/**
 * Process call references
 */
export function process_call_references(
  captures: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath,
  scope_to_symbol?: Map<ScopeId, SymbolId>
): CallReference[] {
  const calls: CallReference[] = [];

  // Filter for call-related entities
  const call_captures = captures.filter(c =>
    c.entity === SemanticEntity.CALL ||
    c.entity === SemanticEntity.SUPER
  );

  for (const capture of call_captures) {
    const scope = find_containing_scope(
      capture.node_location,
      root_scope,
      scopes
    );

    const call = create_call_reference(
      capture,
      scope,
      scopes,
      file_path,
      scope_to_symbol
    );

    calls.push(call);
  }

  return calls;
}

/**
 * Create a call reference from a capture
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
  const name = capture.text as SymbolName;

  // Determine call type
  let call_type: CallReference["call_type"] = "function";
  if (context?.construct_target) {
    call_type = "constructor";
  } else if (context?.receiver_node) {
    call_type = "method";
  } else if (capture.entity === SemanticEntity.SUPER) {
    call_type = "super";
  }

  // Build receiver info for method calls
  let receiver: CallReference["receiver"];
  if (context?.receiver_node) {
    receiver = {
      location: node_to_location(context.receiver_node, file_path),
      // Type would be inferred from type tracking
    };
  }

  // Get containing function for call chain tracking
  const containing_function = get_containing_function(
    scope,
    scopes,
    scope_to_symbol
  );

  return {
    location,
    name,
    scope_id: scope.id,
    call_type,
    receiver,
    construct_target: context?.construct_target
      ? node_to_location(context.construct_target, file_path)
      : undefined,
    containing_function,
    super_class: context?.extends_class as SymbolName | undefined,
  };
}

/**
 * Get containing function symbol
 */
function get_containing_function(
  scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  scope_to_symbol?: Map<ScopeId, SymbolId>
): SymbolId | undefined {
  if (!scope_to_symbol) return undefined;

  let current: LexicalScope | undefined = scope;

  while (current) {
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
 * Resolve method calls using receiver types
 */
export function resolve_method_calls(
  calls: CallReference[],
  symbols: Map<SymbolId, any>
): Map<Location, SymbolId> {
  const resolutions = new Map<Location, SymbolId>();

  for (const call of calls) {
    if (call.call_type !== "method") continue;

    if (call.receiver?.type) {
      // Find class with matching type
      for (const [id, symbol] of symbols) {
        if (
          symbol.kind === "class" &&
          symbol.name === call.receiver.type.type_name
        ) {
          // Look for method in class
          for (const method_id of symbol.methods || []) {
            const method = symbols.get(method_id);
            if (method?.name === call.name) {
              resolutions.set(call.location, method_id);
              call.resolved_symbol = method_id;
              break;
            }
          }
        }
      }
    }
  }

  return resolutions;
}

/**
 * Build call graph from call references
 */
export interface CallGraphNode {
  symbol: SymbolId;
  calls_to: Set<SymbolId>;
  called_by: Set<SymbolId>;
  call_sites: CallReference[];
}

export function build_call_graph(
  calls: CallReference[]
): Map<SymbolId, CallGraphNode> {
  const graph = new Map<SymbolId, CallGraphNode>();

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

  return graph;
}