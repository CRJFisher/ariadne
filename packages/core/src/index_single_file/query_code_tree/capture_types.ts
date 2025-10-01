/**
 * Re-export semantic types for backward compatibility with test files
 *
 * These types were moved to scope_processor.ts but tests still import from here.
 */

export { SemanticEntity, SemanticCategory } from "../scopes/scope_processor";
