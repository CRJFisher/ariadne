// Classifier for the known-issues registry rule `dynamic-property-keyed-callback`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A function is stored in a map or object and invoked via `handlers[key](...)`
// or `obj[name]()` where the key is not a literal. The resolver has a collection
// source but no literal key, so the specific callback cannot be linked — a
// permanent limitation when the key is computed at runtime. The discriminator is
// the `is_dynamic_dispatch` syntactic feature on any of the entry's call refs.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

export function check_dynamic_property_keyed_callback(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  return entry_point.diagnostics.ariadne_call_refs.some(
    (r) => r.syntactic_features.is_dynamic_dispatch === true,
  );
}
