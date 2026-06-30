// Classifier for the known-issues registry rule `untyped-attribute-receiver`.
// Hand-authored; keep in sync with the registry entry that names it.
//
// A Python method reached only as `self.<attr>.<method>()` where `<attr>` is an
// untyped instance attribute (a Cython `object` constructor parameter such as
// pandas `self.obj`, or any attribute never assigned `self.<attr> = Constructor()`).
// The resolver cannot follow the attribute's type, so it collapses the receiver
// to the caller's own enclosing class, fails to find the method there, and
// records `member_type_unknown` with `resolved_receiver_type` pointing at that
// caller class (emitted by the type-inference stage in `receiver_resolution.ts`)
// — so the resolved receiver-type's file equals the call ref's
// `caller_file`. That equality is the discriminator: it isolates the
// receiver-collapsed-to-self case from a typed attribute whose sub-member is
// unknown (where the resolved type lives in another file).
//
// Self-narrowing behind TASK-350 Fix C: `self.<attr> = Constructor()` assignments
// promote to typed properties, so typeable receivers resolve and never reach this
// classifier; only genuinely-untyped receivers remain. The residual case — a Cython
// `object` constructor parameter that can never gain a followable type — is out of
// static reach, so the rule is a permanent-limitations-catalog entry (`status:
// permanent`).
//
// Distinct from the JavaScript `receiver-type-unknown` builtin, which keys on the
// inverse shape (`callers-not-in-registry` with empty call refs, identifier
// receiver). This rule requires a populated `self_keyword` call ref.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_untyped_attribute_receiver(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  if (detect_language(entry_point.file_path) !== "python") return false;
  if (entry_point.kind !== "method") return false;
  return entry_point.diagnostics.ariadne_call_refs.some((ref) => {
    if (ref.receiver_kind !== "self_keyword") return false;
    if (ref.resolution_count !== 0) return false;
    const failure = ref.resolution_failure;
    if (failure === null || failure.reason !== "member_type_unknown") return false;
    const receiver_type = failure.partial_info.resolved_receiver_type;
    if (receiver_type === undefined) return false;
    // SymbolId is `kind:file_path:start_line:start_col:end_line:end_col:name`.
    // The 5 trailing fields are fixed-arity, so the file path is everything
    // between the kind and them — reconstructed by slice so a path that itself
    // contains a colon (e.g. a Windows drive letter) is not truncated.
    const parts = receiver_type.split(":");
    const receiver_file = parts.slice(1, -5).join(":");
    return receiver_file === ref.caller_file;
  });
}
