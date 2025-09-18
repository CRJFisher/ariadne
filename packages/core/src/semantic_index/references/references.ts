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
  SymbolId,
} from "@ariadnejs/types";
import { node_to_location } from "../../ast/node_utils";
import { find_containing_scope } from "../scope_tree";
import type { NormalizedCapture } from "../capture_types";
import { SemanticEntity } from "../capture_types";

/**
 * Process references with enhanced context
 * Resolution requires cross-file type tracking and happens in a separate phase
 */
export function process_references(
  ref_captures: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath,
  assignments?: NormalizedCapture[],
  type_captures?: NormalizedCapture[],
  returns?: NormalizedCapture[]
): SymbolReference[] {
  const references: SymbolReference[] = [];

  // Build context maps
  const assignment_map = build_assignment_map(assignments || []);
  const return_map = build_return_map(returns || [], root_scope, scopes, file_path);

  for (const capture of ref_captures) {
    const scope = find_containing_scope(capture.node, root_scope, scopes, file_path);
    const name = capture.text as SymbolName;
    const ref_type = get_reference_type_from_entity(capture.entity);
    const location = node_to_location(capture.node, file_path);

    // Use context from normalized capture
    const context = capture.context;

    // Create reference with context
    const reference: SymbolReference = {
      location,
      type: ref_type,
      scope_id: scope.id,
      name,
      context: {
        receiver_location: context?.receiver_node ? node_to_location(context.receiver_node, file_path) : undefined,
        assignment_source: context?.source_node ? node_to_location(context.source_node, file_path) : undefined,
        assignment_target: context?.target_node ? node_to_location(context.target_node, file_path) : undefined,
        construct_target: context?.construct_target ? node_to_location(context.construct_target, file_path) : undefined,
        containing_function: containing_function,
        property_chain: context?.property_chain ? context.property_chain.map(p => p as SymbolName) : undefined,
      },
    };

    references.push(reference);
  }

  return references;
}

/**
 * Build assignment map
 */
function build_assignment_map(assignments: NormalizedCapture[]): Map<string, NormalizedCapture> {
  const map = new Map<string, NormalizedCapture>();

  for (const capture of assignments) {
    // Map by node position as key
    const key = `${capture.node.startIndex}`;
    map.set(key, capture);
  }

  return map;
}

/**
 * Build return statement map
 */
function build_return_map(
  returns: NormalizedCapture[],
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
 * Get reference type from entity
 */
export function get_reference_type_from_entity(entity: SemanticEntity): ReferenceType {
  switch (entity) {
    case SemanticEntity.CALL:
      return "call";
    case SemanticEntity.MEMBER_ACCESS:
      return "member_access";
    case SemanticEntity.TYPE_REFERENCE:
      return "type";
    case SemanticEntity.THIS:
    case SemanticEntity.SUPER:
    case SemanticEntity.VARIABLE:
    default:
      return "read";
  }
}