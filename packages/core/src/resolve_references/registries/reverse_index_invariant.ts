/**
 * The invariant that every forward map in the definition store has a reverse
 * index agreeing with it, as a guard a test run can arm.
 *
 * A write site that populates a forward map and forgets its reverse index fails
 * silently rather than loudly: eviction under-deletes, the stale ownership edge
 * outlives the file that produced it, and the call graph moves an edge onto a
 * symbol that no longer exists. Nothing observable says so, which is why the
 * invariant is stated and checked here rather than left to review.
 *
 * Checking costs a pass over the whole registry, which a test run can afford
 * and a corpus load cannot, so the guard stays disarmed unless the environment
 * arms it.
 */

import type { MemberIndex } from "./member_index";
import type { SubtypeGraph } from "./subtype_graph";

/**
 * Read per write rather than cached, so a test can arm and disarm the invariant
 * around the code it measures. Three lookups per indexed file is nothing beside
 * the pass the invariant itself costs.
 */
function reverse_index_assertions_enabled(): boolean {
  return process.env.ARIADNE_ASSERT_REGISTRY_INVARIANTS === "1";
}

/**
 * The composed indexes' own reverse-index checks, chained: the first divergence
 * found in either, or null when everything agrees.
 */
export function first_reverse_index_divergence(
  members: MemberIndex,
  heritage: SubtypeGraph
): string | null {
  return members.verify() ?? heritage.verify();
}

/**
 * The invariant as a guard, run after every registry write when
 * `ARIADNE_ASSERT_REGISTRY_INVARIANTS=1` arms it. `after` names the write, so a
 * divergence reports which one left the indexes disagreeing.
 */
export function assert_reverse_indices_consistent(
  members: MemberIndex,
  heritage: SubtypeGraph,
  after: string
): void {
  if (!reverse_index_assertions_enabled()) {
    return;
  }
  const divergence = first_reverse_index_divergence(members, heritage);
  if (divergence !== null) {
    throw new Error(`DefinitionRegistry reverse index diverged after ${after}: ${divergence}`);
  }
}
