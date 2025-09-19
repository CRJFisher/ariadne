/**
 * Type Tracking - Internal utilities
 *
 * Not exposed publicly. Used internally by reference processors.
 */

// Only export what's actually used by the reference processors
export { build_type_annotation_map, build_typed_return_map } from "./type_tracking";
export type { ReturnContext, TypeSource } from "./type_tracking";
export type { TypeInfo } from "./type_info";