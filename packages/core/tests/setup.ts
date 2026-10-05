/**
 * Every test in this package runs with `DefinitionRegistry`'s reverse-index
 * invariant armed: after each registry write, `owner_members` is rebuilt from
 * `member_owner`, and `parent_types` and `edges_by_file` from `type_subtypes`,
 * and compared, and any divergence throws.
 *
 * A write site that populates a forward map and forgets its reverse index is
 * silent — eviction under-deletes and the stale edge outlives the file that
 * produced it — so the whole suite is the coverage that finds it.
 */
process.env.ARIADNE_ASSERT_REGISTRY_INVARIANTS = "1";
