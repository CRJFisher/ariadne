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
import { node_to_location } from "../../node_utils";
import { find_containing_scope } from "../../scope_tree";
import {
  SemanticEntity,
  SemanticCategory,
  NormalizedCapture,
  CaptureContext,
} from "../../../parse_and_query_code/capture_types";
import { CallReference } from "@ariadnejs/types/src/call_chains";

/**
 * Validation error for invalid captures
 */
export class InvalidCaptureError extends Error {
  constructor(message: string, public readonly capture: NormalizedCapture) {
    super(message);
    this.name = "InvalidCaptureError";
  }
}

/**
 * Validate symbol name from capture text
 */
function validate_symbol_name(
  text: string,
  capture: NormalizedCapture
): SymbolName {
  if (typeof text !== "string") {
    throw new InvalidCaptureError(
      `Symbol name must be a string, got ${typeof text}`,
      capture
    );
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new InvalidCaptureError(
      "Symbol name cannot be empty or whitespace only",
      capture
    );
  }

  return trimmed as SymbolName;
}

/**
 * Safely extract super class name from context
 */
function extract_super_class(context: CaptureContext): SymbolName | undefined {
  if (!context?.extends_class) return undefined;

  if (typeof context.extends_class !== "string") {
    return undefined; // Silently ignore invalid types
  }

  const trimmed = context.extends_class.trim();
  return trimmed.length > 0 ? (trimmed as SymbolName) : undefined;
}

/**
 * Detect if a method call is static from context
 */
function detect_static_call(context: CaptureContext): boolean | undefined {
  if (context?.is_static === true) return true;
  if (context?.is_static === false) return false;
  return undefined; // Cannot determine
}

/**
 * Process call references
 */
export function process_call_references(
  captures: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath,
  scope_to_symbol: Map<ScopeId, SymbolId>
): CallReference[] {
  const calls: CallReference[] = [];
  const errors: InvalidCaptureError[] = [];

  // Filter for call-related entities (only references, not definitions)
  const call_captures = captures.filter(
    (c) =>
      c.entity === SemanticEntity.CALL ||
      c.entity === SemanticEntity.SUPER ||
      (c.entity === SemanticEntity.FUNCTION &&
        c.category === SemanticCategory.REFERENCE) ||
      (c.entity === SemanticEntity.METHOD &&
        c.category === SemanticCategory.REFERENCE) ||
      (c.entity === SemanticEntity.MACRO &&
        c.category === SemanticCategory.REFERENCE)
  );

  for (const capture of call_captures) {
    try {
      const scope = find_containing_scope(
        capture.node_location,
        root_scope,
        scopes
      );

      if (!scope) {
        throw new InvalidCaptureError(
          "No containing scope found for capture",
          capture
        );
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
    console.warn(
      `Skipped ${errors.length} invalid call captures:`,
      errors.map((e) => e.message)
    );
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
  scope_to_symbol: Map<ScopeId, SymbolId>
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
  } else if (capture.entity === SemanticEntity.MACRO) {
    call_type = "macro";
  }

  // Build receiver info for method calls
  let receiver: CallReference["receiver"];
  if (context?.receiver_node) {
    try {
      const receiver_location = node_to_location(
        context.receiver_node,
        file_path
      );
      const receiver_name = context.receiver_node.text?.trim();

      receiver = {
        location: receiver_location,
        name: receiver_name ? (receiver_name as SymbolName) : undefined,
      };
    } catch (error) {
      throw new InvalidCaptureError(
        `Failed to process receiver node: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        capture
      );
    }
  }

  // Detect static calls
  const is_static_call =
    call_type === "method" && context ? detect_static_call(context) : undefined;

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
        `Failed to process construct target: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
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
    super_class: context ? extract_super_class(context) : undefined,
    is_static_call,
    is_higher_order: capture.modifiers?.is_higher_order,
  };
}

/**
 * Get containing function symbol
 */
function get_containing_function(
  scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  scope_to_symbol: Map<ScopeId, SymbolId>
): SymbolId {
  let current: LexicalScope | undefined = scope;
  const visited = new Set<ScopeId>(); // Prevent infinite loops

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    if (
      current.type === "function" ||
      current.type === "method" ||
      current.type === "constructor"
    ) {
      const symbol = scope_to_symbol.get(current.id);
      if (!symbol) {
        throw new Error(
          `Symbol not found for scope at ${current.location.file_path}:${current.location.line}:${current.location.column}`
        );
      }
      return symbol;
    }

    current = current.parent_id ? scopes.get(current.parent_id) : undefined;
  }

  throw new Error(
    `Symbol not found for scope at ${scope.location.file_path}:${scope.location.line}:${scope.location.column}`
  );
}
