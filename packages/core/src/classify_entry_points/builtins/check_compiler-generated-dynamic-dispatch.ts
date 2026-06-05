// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// Angular Ivy compiler-generated instruction functions: ɵɵ-prefixed names defined under packages/core/src/render3/instructions/. These are invoked indirectly via the string-keyed angularCoreEnv map (packages/core/src/render3/jit/environment.ts) and via ExternalReference identifiers in packages/compiler/src/render3/r3_identifiers.ts; the compiler emits string names that the runtime resolves through the map, so no static call site exists in the source graph. The name + path combination is highly specific to this framework convention.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_compiler_generated_dynamic_dispatch(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const check_1 = new RegExp("^ɵɵ[A-Za-z][A-Za-z0-9_]*$").test(entry_point.name);
  const check_2 = new RegExp("/packages/core/src/render3/instructions/").test(entry_point.file_path);
  return check_0 && check_1 && check_2;
}
