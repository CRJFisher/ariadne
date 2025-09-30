/**
 * Rust language configuration using builder pattern
 *
 * Handles Rust's unique module system, ownership semantics, and type system
 */

import { RUST_BUILDER_CONFIG } from "./rust_builder";

/**
 * Export the builder configuration for Rust
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
export { RUST_BUILDER_CONFIG } from "./rust_builder";
export type { LanguageBuilderConfig } from "./rust_builder";

// For backwards compatibility during migration
export const RUST_CAPTURE_CONFIG = RUST_BUILDER_CONFIG;