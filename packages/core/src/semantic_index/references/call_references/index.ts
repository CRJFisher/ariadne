/**
 * Call References - Internal module
 *
 * Not exposed publicly. Used internally by references.ts
 */

// Internal exports for references.ts only
export {
  process_call_references,
} from "./call_references";

export type {
  CallReference,
} from "./call_references";

export { InvalidCaptureError } from "./call_references";