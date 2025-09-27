/**
 * Type Flow References - Local assignment tracking only
 *
 * Tracks assignment patterns and flow relationships without
 * attempting to resolve or propagate types.
 */

import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import { find_containing_scope } from "../../scope_tree";
import type { NormalizedCapture } from "../../../parse_and_query_code/capture_types";
import { SemanticCategory } from "../../../parse_and_query_code/capture_types";

/**
 * Local type flow data tracking without resolution
 */
export interface LocalTypeFlowData {
  /** Constructor calls found in code */
  readonly constructor_calls: LocalConstructorCall[];

  /** Assignment flows between variables */
  readonly assignments: LocalAssignmentFlow[];

  /** Return statements and their values */
  readonly returns: LocalReturnFlow[];

  /** Function call results assigned to variables */
  readonly call_assignments: LocalCallAssignment[];
}

export interface LocalConstructorCall {
  /** Constructor name (unresolved) */
  readonly class_name: SymbolName;

  /** Location of the new expression */
  readonly location: Location;

  /** Target variable if assigned */
  readonly assigned_to?: SymbolName;

  /** Arguments passed (for signature matching later) */
  readonly argument_count: number;

  /** Containing scope */
  readonly scope_id: ScopeId;
}

export interface LocalAssignmentFlow {
  /** Source variable or expression */
  readonly source: FlowSource;

  /** Target variable */
  readonly target: SymbolName;

  /** Assignment location */
  readonly location: Location;

  /** Assignment kind */
  readonly kind: "direct" | "destructured" | "spread";
}

export interface LocalReturnFlow {
  /** Function containing the return */
  readonly function_name?: SymbolName;

  /** Return statement location */
  readonly location: Location;

  /** Returned expression info */
  readonly value: FlowSource;

  /** Containing scope */
  readonly scope_id: ScopeId;
}

export interface LocalCallAssignment {
  /** Function being called (unresolved) */
  readonly function_name: SymbolName;

  /** Call location */
  readonly location: Location;

  /** Variable receiving the result */
  readonly assigned_to: SymbolName;

  /** Method call info if applicable */
  readonly method_info?: {
    readonly object_name: SymbolName;
    readonly method_name: SymbolName;
  };
}

export type FlowSource =
  | { kind: "variable"; name: SymbolName }
  | {
      kind: "literal";
      value: string;
      literal_type: "string" | "number" | "boolean";
    }
  | { kind: "constructor"; class_name: SymbolName }
  | { kind: "function_call"; function_name: SymbolName }
  | { kind: "expression"; text: string };

/**
 * Extract type flow patterns without resolution
 */
export function extract_type_flow(
  captures: NormalizedCapture[],
  scopes: Map<ScopeId, LexicalScope>,
): LocalTypeFlowData {
  const constructor_calls: LocalConstructorCall[] = [];
  const assignments: LocalAssignmentFlow[] = [];
  const returns: LocalReturnFlow[] = [];
  const call_assignments: LocalCallAssignment[] = [];

  // Get root scope - assuming first scope is root if no parent_id
  let root_scope: LexicalScope | undefined;
  for (const scope of scopes.values()) {
    if (!scope.parent_id) {
      root_scope = scope;
      break;
    }
  }

  for (const capture of captures) {
    // For now, handle basic categories - proper implementation would need
    // to analyze the captures to determine the correct flow type
    switch (capture.category) {
      case SemanticCategory.ASSIGNMENT:
        assignments.push(extract_assignment_flow(capture));
        break;

      case SemanticCategory.RETURN:
        returns.push(extract_return_flow(capture, scopes, root_scope));
        break;

      case SemanticCategory.REFERENCE:
        // Check if this is a constructor call or function call
        // This would need proper analysis of the capture
        if (is_constructor_call(capture)) {
          const constructor_scope = root_scope ?
            find_containing_scope(capture.node_location, root_scope, scopes) :
            Array.from(scopes.values())[0];

          constructor_calls.push({
            class_name: extract_class_name(capture),
            location: capture.node_location,
            assigned_to: extract_assignment_target(capture),
            argument_count: count_arguments(capture),
            scope_id: constructor_scope.id,
          });
        } else if (is_function_call(capture) && has_assignment_target(capture)) {
          call_assignments.push(extract_call_assignment(capture));
        }
        break;
    }
  }

  return { constructor_calls, assignments, returns, call_assignments };
}

/**
 * Extract class name from constructor call capture
 */
function extract_class_name(capture: NormalizedCapture): SymbolName {
  // The capture text should be the class name for constructor calls
  return capture.text as SymbolName;
}

/**
 * Extract assignment target from capture
 */
function extract_assignment_target(capture: NormalizedCapture): SymbolName | undefined {
  // Look for parent assignment node
  // This would need to analyze the parent node in the AST
  // For now, return undefined - proper implementation would check parent nodes
  return undefined;
}

/**
 * Count arguments in a function/constructor call
 */
function count_arguments(capture: NormalizedCapture): number {
  // This would need to analyze the arguments node
  // For now, return 0 - proper implementation would count argument nodes
  return 0;
}

/**
 * Extract assignment flow from capture
 */
function extract_assignment_flow(capture: NormalizedCapture): LocalAssignmentFlow {
  return {
    source: { kind: "expression", text: capture.text },
    target: capture.text as SymbolName, // Would need proper target extraction
    location: capture.node_location,
    kind: "direct",
  };
}

/**
 * Extract return flow from capture
 */
function extract_return_flow(
  capture: NormalizedCapture,
  scopes: Map<ScopeId, LexicalScope>,
  root_scope: LexicalScope | undefined
): LocalReturnFlow {
  const containing_scope = root_scope ?
    find_containing_scope(capture.node_location, root_scope, scopes) :
    Array.from(scopes.values())[0];

  return {
    function_name: undefined, // Would need to find containing function
    location: capture.node_location,
    value: { kind: "expression", text: capture.text },
    scope_id: containing_scope.id,
  };
}

/**
 * Check if capture is a constructor call
 */
function is_constructor_call(capture: NormalizedCapture): boolean {
  // Simple heuristic - would need proper implementation
  return capture.text.charAt(0) === capture.text.charAt(0).toUpperCase();
}

/**
 * Check if capture is a function call
 */
function is_function_call(capture: NormalizedCapture): boolean {
  // Would need to check the node type
  return capture.category === SemanticCategory.REFERENCE;
}

/**
 * Check if capture has an assignment target
 */
function has_assignment_target(capture: NormalizedCapture): boolean {
  // Would need to check if this call is part of an assignment
  return false;
}

/**
 * Extract call assignment from capture
 */
function extract_call_assignment(capture: NormalizedCapture): LocalCallAssignment {
  return {
    function_name: capture.text as SymbolName,
    location: capture.node_location,
    assigned_to: "unknown" as SymbolName, // Would need proper extraction
    method_info: undefined,
  };
}