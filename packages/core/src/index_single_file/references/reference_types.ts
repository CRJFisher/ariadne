/**
 * Union type of all specialized reference types
 * Preserves rich type information from each processor
 */

import type { CallReference } from "@ariadnejs/types/src/call_chains";
import type { LocalTypeFlowData } from "./type_flow_references/type_flow_references";
import type { ReturnReference } from "./return_references/return_references";
import type { MemberAccessReference } from "./member_access_references/member_access_references";
import type { TypeAnnotationReference } from "./type_annotation_references/type_annotation_references";

/**
 * All possible reference types with their specialized information
 */
export type ProcessedReference =
  | CallReference
  | LocalTypeFlowData
  | ReturnReference
  | MemberAccessReference
  | TypeAnnotationReference;

/**
 * Result of processing all references with full type information
 */
export interface ProcessedReferences {
  readonly calls: readonly CallReference[];
  readonly type_flows: LocalTypeFlowData;
  readonly returns: readonly ReturnReference[];
  readonly member_accesses: readonly MemberAccessReference[];
  readonly type_annotations: readonly TypeAnnotationReference[];
}
