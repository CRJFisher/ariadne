/**
 * Rust function, closure, and async/await capture configurations
 */

import {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
} from "../capture_types";

/**
 * Function, closure, and async/await capture configurations for Rust
 */
export const RUST_FUNCTION_MAPPINGS = new Map<string, CaptureMapping>([
  // ============================================================================
  // FUNCTIONS AND CLOSURES
  // ============================================================================

  // Generic functions
  [
    "def.function.generic",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_generic: true }),
    },
  ],

  // Const functions
  [
    "def.function.const",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_const: true }),
    },
  ],

  // Async functions
  [
    "def.function.async",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_async: true }),
    },
  ],

  // Functions returning impl Trait
  [
    "def.function.returns_impl",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ returns_impl_trait: true }),
    },
  ],

  // Functions accepting impl Trait
  [
    "def.function.accepts_impl",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ accepts_impl_trait: true }),
    },
  ],

  // Closure definitions
  [
    "def.function.closure",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_closure: true }),
    },
  ],
  [
    "def.function.async_closure",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_closure: true, is_async: true }),
    },
  ],
  [
    "def.function.async_move_closure",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_closure: true, is_async: true, is_move: true }),
    },
  ],
  [
    "def.function.closure.async",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_closure: true, is_async: true }),
    },
  ],
  [
    "def.function.closure.move",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.FUNCTION,
      modifiers: () => ({ is_closure: true, is_move: true }),
    },
  ],

  // Closure parameters
  [
    "def.param.closure",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.PARAMETER,
      modifiers: () => ({ is_closure_param: true }),
    },
  ],

  // Function pointer types
  [
    "type.function_pointer",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.TYPE,
      modifiers: () => ({ is_function_pointer: true }),
    },
  ],

  // Function trait objects (Fn, FnMut, FnOnce)
  [
    "type.function_trait",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.TYPE,
      modifiers: () => ({ is_function_trait: true }),
    },
  ],

  // Higher-order function calls
  [
    "call.higher_order",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_higher_order: true }),
    },
  ],

  // ============================================================================
  // ASYNC/AWAIT SUPPORT
  // ============================================================================

  // Async blocks
  [
    "scope.block.async",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
      modifiers: () => ({ is_async: true }),
    },
  ],

  // Async move blocks
  [
    "scope.block.async_move",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
      modifiers: () => ({ is_async: true, is_move: true }),
    },
  ],

  // Await expressions
  [
    "ref.await",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_await: true }),
    },
  ],

  // Try expressions (?)
  [
    "ref.try",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.OPERATOR,
      modifiers: () => ({ is_try: true }),
    },
  ],

  // Async closures
  [
    "def.closure.async",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CLOSURE,
      modifiers: () => ({ is_async: true }),
    },
  ],

  // Async move closures
  [
    "def.closure.async_move",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.CLOSURE,
      modifiers: () => ({ is_async: true, is_move: true }),
    },
  ],

  // Future trait methods
  [
    "call.future_method",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.METHOD,
      modifiers: () => ({ is_future_method: true }),
    },
  ],
]);