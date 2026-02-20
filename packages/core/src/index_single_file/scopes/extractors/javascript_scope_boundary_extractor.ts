import { JavaScriptTypeScriptScopeBoundaryExtractor } from "./javascript_typescript_scope_boundary_extractor";

/**
 * JavaScript-specific scope boundary extractor.
 * Inherits all logic from shared JS/TS base.
 *
 * JavaScript follows similar patterns to TypeScript but without types:
 * - Function declarations and expressions
 * - Class declarations
 * - Arrow functions
 * - Method definitions
 *
 * JavaScript and TypeScript scope boundaries are identical.
 */
export class JavaScriptScopeBoundaryExtractor extends JavaScriptTypeScriptScopeBoundaryExtractor {
  // All logic inherited from base class
  // JavaScript and TypeScript scope boundaries are identical
}