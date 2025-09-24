/**
 * Rust capture mapping configuration
 *
 * Handles Rust's unique module system, ownership semantics, and type system
 */

import { type LanguageCaptureConfig } from "../capture_types";
import { RUST_CORE_MAPPINGS } from "./rust_core";
import { RUST_PATTERN_MAPPINGS } from "./rust_patterns";
import { RUST_FUNCTION_MAPPINGS } from "./rust_functions";

/**
 * Map Rust tree-sitter captures to normalized semantic concepts
 *
 * Key Rust concepts handled:
 * - Complex visibility system (pub, pub(crate), pub(super), pub(in path))
 * - Module system (crate, super, self references)
 * - Traits vs impl blocks vs inherent implementations
 * - Associated functions vs methods (presence of self parameter)
 * - Ownership semantics (borrowing, dereferencing)
 * - Lifetimes and generic constraints
 * - Pattern matching constructs
 * - Async/await and function/closure patterns
 */
export const RUST_CAPTURE_CONFIG: LanguageCaptureConfig = new Map([
  ...RUST_CORE_MAPPINGS,
  ...RUST_PATTERN_MAPPINGS,
  ...RUST_FUNCTION_MAPPINGS,
]);