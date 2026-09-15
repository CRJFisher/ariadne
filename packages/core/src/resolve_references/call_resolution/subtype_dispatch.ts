/**
 * Which files a resolve pass's method lookups dispatched through which types'
 * subtype closures, gathered as the pass runs and applied to
 * `ResolutionState.subtype_dispatch_files` when it ends.
 */

import type { FilePath, SymbolId } from "@ariadnejs/types";

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
