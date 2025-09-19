/**
 * References - Main entry point for processing symbol references
 *
 */

import type {
  FilePath,
  ScopeId,
  LexicalScope,
  SymbolId,
} from "@ariadnejs/types";
import type { NormalizedCapture } from "../capture_types";
import { SemanticEntity } from "../capture_types";

import { process_call_references } from "./call_references/call_references";
import { process_type_flow_references } from "./type_flow_references/type_flow_references";
import { process_return_references } from "./return_references/return_references";
import { process_member_access_references } from "./member_access_references/member_access_references";
import { process_type_annotation_references } from "./type_annotation_references/type_annotation_references";
import { build_type_annotation_map } from "./type_tracking/type_tracking";
import type { ProcessedReferences } from "./reference_types";

/**
 * Process all references 
 */
export function process_references(
  ref_captures: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath,
  assignments?: NormalizedCapture[],
  type_captures?: NormalizedCapture[],
  returns?: NormalizedCapture[],
  scope_to_symbol?: Map<ScopeId, SymbolId>
): ProcessedReferences {
  const result: ProcessedReferences = {
    calls: [],
    type_flows: [],
    returns: [],
    member_accesses: [],
    type_annotations: [],
  };

  // 1. Process type annotations (they're anchors for type inference)
  if (type_captures && type_captures.length > 0) {
    const type_annotations = process_type_annotation_references(
      type_captures,
      root_scope,
      scopes,
      file_path
    );
    (result as any).type_annotations = type_annotations;
  }

  // 2. Process call references
  const call_captures = ref_captures.filter(c =>
    c.entity === SemanticEntity.CALL ||
    c.entity === SemanticEntity.SUPER
  );

  if (call_captures.length > 0) {
    const calls = process_call_references(
      call_captures,
      root_scope,
      scopes,
      file_path,
      scope_to_symbol
    );
    (result as any).calls = calls;
  }

  // 3. Process type flow from assignments
  if (assignments && assignments.length > 0) {
    const type_map = type_captures
      ? build_type_annotation_map(type_captures)
      : new Map();

    const type_flows = process_type_flow_references(
      assignments,
      root_scope,
      scopes,
      file_path,
      type_map
    );
    (result as any).type_flows = type_flows;
  }

  // 4. Process return references
  if (returns && returns.length > 0) {
    const return_refs = process_return_references(
      returns,
      root_scope,
      scopes,
      file_path,
      scope_to_symbol
    );
    (result as any).returns = return_refs;
  }

  // 5. Process member access references
  const member_captures = ref_captures.filter(c =>
    c.entity === SemanticEntity.MEMBER_ACCESS ||
    c.entity === SemanticEntity.PROPERTY ||
    c.entity === SemanticEntity.METHOD
  );

  if (member_captures.length > 0) {
    const member_accesses = process_member_access_references(
      member_captures,
      root_scope,
      scopes,
      file_path
    );
    (result as any).member_accesses = member_accesses;
  }

  return result;
}