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

import { CallReference, process_call_references } from "./call_references/call_references";
import { extract_type_flow, type LocalTypeFlowData } from "./type_flow_references/type_flow_references";
import { process_return_references, ReturnReference } from "./return_references/return_references";
import { MemberAccessReference, process_member_access_references } from "./member_access_references/member_access_references";
import { process_type_annotation_references, TypeAnnotationReference } from "./type_annotation_references/type_annotation_references";
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
  let calls: CallReference[] = [];
  let type_annotations: TypeAnnotationReference[] = [];
  let type_flows: LocalTypeFlowData | undefined;
  let return_refs: ReturnReference[] = [];
  let member_accesses: MemberAccessReference[] = [];

  // 1. Process type annotations (they're anchors for type inference)
  if (type_captures && type_captures.length > 0) {
    type_annotations = process_type_annotation_references(
      type_captures,
      root_scope,
      scopes,
      file_path
    );
  }

  // 2. Process call references
  const call_captures = ref_captures.filter(c =>
    c.entity === SemanticEntity.CALL ||
    c.entity === SemanticEntity.SUPER ||
    c.entity === SemanticEntity.FUNCTION ||
    c.entity === SemanticEntity.METHOD
  );

  if (call_captures.length > 0) {
    calls = process_call_references(
      call_captures,
      root_scope,
      scopes,
      file_path,
      scope_to_symbol
    );
  }

  // 3. Process type flow from all captures
  // The extract_type_flow function now handles all relevant captures
  const all_captures = [
    ...ref_captures,
    ...(assignments || []),
    ...(returns || []),
    ...(type_captures || [])
  ];

  if (all_captures.length > 0) {
    type_flows = extract_type_flow(
      all_captures,
      scopes,
      file_path
    );
  }

  // 4. Process return references
  if (returns && returns.length > 0) {
    return_refs = process_return_references(
      returns,
      root_scope,
      scopes,
      file_path,
      scope_to_symbol
    );
  }

  // 5. Process member access references
  const member_captures = ref_captures.filter(c =>
    c.entity === SemanticEntity.MEMBER_ACCESS ||
    c.entity === SemanticEntity.PROPERTY ||
    c.entity === SemanticEntity.METHOD
  );

  if (member_captures.length > 0) {
    member_accesses = process_member_access_references(
      member_captures,
      root_scope,
      scopes,
      file_path
    );
  }

  return {
    calls,
    type_annotations,
    type_flows,
    returns: return_refs,
    member_accesses,
  };
}