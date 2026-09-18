/**
 * Which files a resolve pass's method lookups dispatched through which types'
 * subtype closures, gathered as the pass runs and applied to
 * `ResolutionState.subtype_dispatch_files` when it ends.
 */

import type { FilePath, SymbolId } from "@ariadnejs/types";
import type { DispatchedThrough } from "./method_lookup";

/** Type → the files whose lookups enumerated its subtypes during one pass. */
export type SubtypeDispatchFiles = Map<SymbolId, Set<FilePath>>;

/** Record that a lookup in `file_id` enumerated the subtypes of `type_id`. */
export function record_subtype_dispatch(
  dispatches: SubtypeDispatchFiles,
  type_id: SymbolId,
  file_id: FilePath
): void {
  const files = dispatches.get(type_id);
  if (files) {
    files.add(file_id);
  } else {
    dispatches.set(type_id, new Set([file_id]));
  }
}

/**
 * Record what one lookup in `file_id` dispatched through: the type whose
 * subtypes it enumerated, and — where that type is an interface no class
 * declares — the same type again under the interfaces whose implementations can
 * only be found structurally.
 *
 * The second record is what a later pass reads to know which interfaces are
 * worth testing a newly-indexed class against. `dispatched` cannot answer that:
 * it holds every type a lookup enumerated, resolved or not, so its keys include
 * every interface whose declared implementations were found.
 */
export function record_dispatch(
  dispatched: SubtypeDispatchFiles,
  undeclared: SubtypeDispatchFiles,
  lookup: DispatchedThrough,
  file_id: FilePath
): void {
  if (lookup.subtype_closure_of !== null) {
    record_subtype_dispatch(dispatched, lookup.subtype_closure_of, file_id);
  }
  if (lookup.undeclared_interface !== null) {
    record_subtype_dispatch(undeclared, lookup.undeclared_interface, file_id);
  }
}
