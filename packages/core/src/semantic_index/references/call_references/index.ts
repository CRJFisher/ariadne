/**
 * Call References - Internal module
 *
 * Not exposed publicly. Used internally by references.ts
 */

// Internal exports for references.ts only
export {
  process_call_references,
  resolve_method_calls,
  apply_method_resolutions,
} from "./call_references";

export type {
  CallReference,
  ClassSymbol,
  MethodSymbol,
  Symbol,
  MethodResolution,
} from "./call_references";

export { InvalidCaptureError } from "./call_references";