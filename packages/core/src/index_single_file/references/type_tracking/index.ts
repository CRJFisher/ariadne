/**
 * Type Tracking - Local extraction only
 *
 * Extracts type annotations and variable declarations
 * without attempting any resolution.
 */

// Export the main extraction function and types
export { extract_type_tracking } from "./type_tracking";
export type {
  LocalTypeTracking,
  LocalVariableAnnotation,
  LocalVariableDeclaration,
  LocalAssignment
} from "./type_tracking";