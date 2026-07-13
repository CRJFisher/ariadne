import type { SyntaxNode } from "tree-sitter";
import type { SymbolName } from "@ariadnejs/types";
import type { CaptureNode } from "../../capture_types";
import type { ProcessingContext } from "../../scopes/processing_context";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import { create_function_id } from "./symbol_factories.rust";

/**
 * Names of the Rust test-harness attributes that gate a callable.
 *
 * Rust's test runner invokes `#[test]` functions and compiles `#[cfg(test)]`
 * items only in test builds, so neither has a source-level call site and both
 * must be suppressed from dead-code entry-point detection. `#[cfg(test)]` on an
 * enclosing `mod`/`impl` propagates to every item nested inside it, so the walk
 * climbs ancestors collecting inherited `cfg(test)` gates; `#[test]` only counts
 * when applied directly to the function.
 *
 * Returns the macro identifiers to record as decorators: `"test"` for `#[test]`,
 * `"cfg"` for any `cfg(test)` predicate (the sole `cfg` form recorded).
 */
function extract_rust_test_harness_attributes(
  fn_node: SyntaxNode
): SymbolName[] {
  const names = new Set<string>();
  let node: SyntaxNode | null = fn_node;
  let is_direct = true;
  while (node && node.type !== "source_file") {
    let sibling: SyntaxNode | null = node.previousNamedSibling;
    while (sibling && sibling.type === "attribute_item") {
      const kind = classify_test_harness_attribute(sibling);
      if (kind === "test" && is_direct) {
        names.add("test");
      } else if (kind === "cfg_test") {
        names.add("cfg");
      }
      sibling = sibling.previousNamedSibling;
    }
    node = node.parent;
    is_direct = false;
  }
  return Array.from(names) as SymbolName[];
}

function classify_test_harness_attribute(
  attr_item: SyntaxNode
): "test" | "cfg_test" | null {
  const attribute = attr_item.children.find((c) => c.type === "attribute");
  if (!attribute) return null;
  const identifier = attribute.children.find((c) => c.type === "identifier");
  if (!identifier) return null;
  if (identifier.text === "test") return "test";
  if (identifier.text === "cfg") {
    const predicate = attribute.children.find((c) => c.type === "token_tree");
    if (predicate && cfg_predicate_requires_test(predicate)) return "cfg_test";
  }
  return null;
}

/**
 * Whether a `cfg(...)` predicate gates code INTO test builds — `test`,
 * `all(test, ...)`, `any(test, ...)`. A `not(...)` wrapper inverts the sense, so
 * its contents are skipped: `cfg(not(test))` gates code into production-only
 * builds and must NOT be treated as test-gating. `cfg(feature = "test")` is also
 * excluded because there the `test` token is a string literal, not a config
 * identifier.
 */
function cfg_predicate_requires_test(token_tree: SyntaxNode): boolean {
  const children = token_tree.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.type === "identifier") {
      if (child.text === "test") return true;
      if (child.text === "not") {
        // Skip the negated sub-predicate — its `test` does not gate code in.
        const next = children[i + 1];
        if (next && next.type === "token_tree") i++;
      }
    } else if (child.type === "token_tree") {
      if (cfg_predicate_requires_test(child)) return true;
    }
  }
  return false;
}

/**
 * Record the `#[test]`/`#[cfg(test)]` gates carried by an already-added Rust
 * function as decorators, so entry-point detection can suppress test-runner-
 * invoked callables that have no source-level call site.
 */
export function attach_rust_test_harness_attributes(
  builder: DefinitionBuilder,
  capture: CaptureNode,
  context: ProcessingContext
): void {
  const fn_node = capture.node.parent || capture.node;
  const attributes = extract_rust_test_harness_attributes(fn_node);
  if (attributes.length === 0) return;
  const target_id = create_function_id(capture);
  const defining_scope_id = context.get_scope_id(capture.location);
  for (const name of attributes) {
    builder.add_decorator_to_target(target_id, {
      name,
      location: capture.location,
      defining_scope_id,
    });
  }
}
