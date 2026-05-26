/**
 * Closed enumeration of the resolver-level root causes behind a `novel_issue`.
 * Used to label Ariadne-bug backlog tasks so they can be rolled up by category
 * in impact reports, and to drive the fix-sequencer's cluster_hint seeding.
 *
 * - `receiver_resolution`     member-access receiver type lost across a field or
 *                             method hop (e.g. `project.definitions.method()`).
 * - `import_resolution`       import-level linking failure (inline `require()`,
 *                             wildcard imports, re-export chains, module-qualified
 *                             attribute calls).
 * - `syntactic_extraction`    the tree-sitter query / definition extractor does not
 *                             capture the node kind (e.g. JS getter/setter, class
 *                             extends, Rust enum-impl methods).
 * - `coverage_config`         call sites exist but live in files Ariadne excludes
 *                             from indexing (e.g. `/tests/` directories).
 * - `cross_file_flow`         call edge requires flow through a value (argument
 *                             lambdas through higher-order calls, object-literal
 *                             method through destructure, factory return types).
 * - `other`                   anything else; description must explain.
 *
 * The runtime lookup is the single source of truth — the type derives from it
 * via `keyof typeof`, so adding a variant means adding one row to the lookup
 * and TypeScript propagates the change everywhere downstream.
 */
export const ARIADNE_ROOT_CAUSE_CATEGORY_LOOKUP = {
  receiver_resolution: true,
  import_resolution: true,
  syntactic_extraction: true,
  coverage_config: true,
  cross_file_flow: true,
  other: true,
} as const;

export type AriadneRootCauseCategory = keyof typeof ARIADNE_ROOT_CAUSE_CATEGORY_LOOKUP;

export function is_ariadne_root_cause_category(
  s: string,
): s is AriadneRootCauseCategory {
  return Object.prototype.hasOwnProperty.call(ARIADNE_ROOT_CAUSE_CATEGORY_LOOKUP, s);
}

/** String-form enumeration of `AriadneRootCauseCategory`, derived from the lookup. */
export const ARIADNE_ROOT_CAUSE_CATEGORIES: readonly AriadneRootCauseCategory[] =
  Object.keys(ARIADNE_ROOT_CAUSE_CATEGORY_LOOKUP) as AriadneRootCauseCategory[];
