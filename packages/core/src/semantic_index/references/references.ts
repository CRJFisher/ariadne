/**
 * References - Process symbol references
 */

import type { SyntaxNode } from "tree-sitter";
import type {
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
  SymbolReference,
  ReferenceType,
} from "@ariadnejs/types";
import { node_to_location } from "../../ast/node_utils";
import { find_containing_scope } from "../scope_tree";
import type { SemanticCapture } from "../types";

/**
 * Process references with enhanced context
 * Resolution requires cross-file type tracking and happens in a separate phase
 */
export function process_references(
  ref_captures: SemanticCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath,
  assignments?: SemanticCapture[],
  method_calls?: SemanticCapture[],
  returns?: SemanticCapture[]
): SymbolReference[] {
  const references: SymbolReference[] = [];

  // Build context maps
  const assignment_map = build_assignment_map(assignments || []);
  const method_map = build_method_map(method_calls || []);
  const return_map = build_return_map(returns || [], root_scope, scopes, file_path);

  for (const capture of ref_captures) {
    const scope = find_containing_scope(capture.node, root_scope, scopes, file_path);
    const name = capture.text as SymbolName;
    const ref_type = get_reference_type(capture);
    const location = node_to_location(capture.node, file_path);

    // Build context based on capture type
    const context = build_reference_context(
      capture,
      location,
      assignment_map,
      method_map,
      return_map,
      file_path
    );

    // Create reference with context
    const reference: SymbolReference = {
      location,
      type: ref_type,
      scope_id: scope.id,
      name,
      context: context || undefined,
    };

    references.push(reference);
  }

  return references;
}

/**
 * Build assignment map
 */
function build_assignment_map(assignments: SemanticCapture[]): Map<string, SemanticCapture> {
  const map = new Map<string, SemanticCapture>();

  for (const capture of assignments) {
    // Map by node position as key
    const key = `${capture.node.startIndex}`;
    map.set(key, capture);
  }

  return map;
}

/**
 * Build method call map
 */
function build_method_map(method_calls: SemanticCapture[]): Map<string, SemanticCapture> {
  const map = new Map<string, SemanticCapture>();

  for (const capture of method_calls) {
    const key = `${capture.node.startIndex}`;
    map.set(key, capture);
  }

  return map;
}

/**
 * Build return statement map
 */
function build_return_map(
  returns: SemanticCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath
): Map<string, ScopeId> {
  const map = new Map<string, ScopeId>();

  for (const capture of returns) {
    const containing_scope = find_containing_scope(capture.node, root_scope, scopes, file_path);
    const key = `${capture.node.startIndex}`;
    map.set(key, containing_scope.id);
  }

  return map;
}

/**
 * Build reference context
 */
function build_reference_context(
  capture: SemanticCapture,
  location: Location,
  assignment_map: Map<string, SemanticCapture>,
  method_map: Map<string, SemanticCapture>,
  return_map: Map<string, ScopeId>,
  file_path: FilePath
): import("@ariadnejs/types").ReferenceContext | null {
  const context: import("@ariadnejs/types").ReferenceContext = {};

  // Check if this is part of an assignment
  if (capture.subcategory === "assign" || capture.detail === "target") {
    const assignment = assignment_map.get(`${capture.node.parent?.startIndex}`);
    if (assignment) {
      // Find the source node
      const source_node = capture.node.parent?.childForFieldName?.("value");
      if (source_node) {
        context.assignment_source = node_to_location(source_node, file_path);
      }
      context.assignment_target = location;
    }
  }

  // Check if this is a method call
  if (capture.subcategory === "method_call" || capture.detail === "method") {
    const method_call = method_map.get(`${capture.node.parent?.startIndex}`);
    if (method_call) {
      // Find the receiver node
      const receiver_node = capture.node.parent?.childForFieldName?.("object");
      if (receiver_node) {
        context.receiver_location = node_to_location(receiver_node, file_path);
      }
    }
  }

  // Check if this is a constructor call
  if (capture.subcategory === "constructor" || capture.subcategory === "new") {
    // Look for assignment context
    const parent = capture.node.parent;
    if (parent?.type === "variable_declarator") {
      const target_node = parent.childForFieldName?.("name");
      if (target_node) {
        context.construct_target = node_to_location(target_node, file_path);
      }
    }
  }

  // Check if this is a return statement
  if (capture.subcategory === "return") {
    const function_scope = return_map.get(`${capture.node.startIndex}`);
    if (function_scope) {
      context.containing_function = function_scope as any; // Will be resolved later
    }
  }

  return Object.keys(context).length > 0 ? context : null;
}

/**
 * Get reference type from capture
 */
export function get_reference_type(capture: SemanticCapture): ReferenceType {
  switch (capture.subcategory) {
    case "call":
      return "call";
    case "new":
    case "constructor":
      return "construct";
    case "member":
    case "method_call":
    case "property":
      return "member_access";
    case "assign":
    case "update":
      return "write";
    case "type":
      return "type";
    default:
      return "read";
  }
}