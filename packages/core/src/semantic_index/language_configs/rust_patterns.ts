/**
 * Rust pattern matching capture configurations
 */

import {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
} from "../capture_types";

/**
 * Pattern matching capture configurations for Rust
 */
export const RUST_PATTERN_MAPPINGS = new Map<string, CaptureMapping>([
  // ============================================================================
  // PATTERN MATCHING - Rust pattern matching constructs
  // ============================================================================
  [
    "match.expression",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
      modifiers: () => ({ match_type: "match" }),
    },
  ],
  [
    "match.value",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "pattern.match_arm",
    {
      category: SemanticCategory.SCOPE,
      entity: SemanticEntity.BLOCK,
      modifiers: () => ({ is_pattern_arm: true }),
    },
  ],
  [
    "pattern.definition",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_pattern_var: true }),
    },
  ],
  [
    "pattern.value",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
    },
  ],
  [
    "variable.pattern",
    {
      category: SemanticCategory.DEFINITION,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_pattern_var: true }),
    },
  ],
  [
    "pattern.struct_type",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.TYPE,
      modifiers: () => ({ is_pattern_type: true }),
    },
  ],
  [
    "pattern.struct_destructure",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.TYPE,
      modifiers: () => ({ is_destructuring: true, pattern_type: "struct" }),
    },
  ],
  [
    "pattern.tuple_destructure",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.TYPE,
      modifiers: () => ({ is_destructuring: true, pattern_type: "tuple" }),
    },
  ],
  [
    "pattern.or",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.OPERATOR,
      modifiers: () => ({ pattern_type: "or" }),
    },
  ],
  [
    "pattern.range",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.OPERATOR,
      modifiers: () => ({ pattern_type: "range" }),
    },
  ],
  [
    "pattern.ref",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.REFERENCE,
      modifiers: () => ({ pattern_type: "ref", is_borrow: true }),
    },
  ],
  [
    "pattern.mut",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.MODIFIER,
      modifiers: () => ({ pattern_type: "mut", is_mutable: true }),
    },
  ],
  [
    "pattern.wildcard",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.OPERATOR,
      modifiers: () => ({ pattern_type: "wildcard" }),
    },
  ],
  [
    "pattern.literal",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.LITERAL,
      modifiers: () => ({ is_pattern_literal: true }),
    },
  ],
  [
    "pattern.if_let_condition",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_pattern_var: true, match_type: "if_let" }),
    },
  ],
  [
    "pattern.if_let_value",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ match_type: "if_let" }),
    },
  ],
  [
    "pattern.while_let_condition",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ is_pattern_var: true, match_type: "while_let" }),
    },
  ],
  [
    "pattern.while_let_value",
    {
      category: SemanticCategory.REFERENCE,
      entity: SemanticEntity.VARIABLE,
      modifiers: () => ({ match_type: "while_let" }),
    },
  ],
]);