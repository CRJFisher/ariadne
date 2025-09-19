/**
 * Type Resolution Module
 *
 * Phase 3 of symbol resolution - handles all cross-file type resolution
 * after imports and functions have been resolved.
 */

export * from "./types";
export { resolve_types } from "./resolve_types";
export { build_type_registry } from "./type_registry";
export { resolve_type_members } from "./resolve_members";
export { track_type_flow } from "./type_flow";
export { resolve_type_annotations } from "./resolve_annotations";
export { resolve_inheritance } from "./inheritance";