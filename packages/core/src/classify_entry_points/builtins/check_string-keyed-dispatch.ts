// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// Angular runtime instruction functions exported under the `ɵɵ`-prefixed naming convention from `packages/core/src/...`. The Angular JIT compiler stores these in a string-keyed dispatch map (`angularCoreEnv` in `packages/core/src/render3/jit/environment.ts`) and invokes them via `new Function(...)` over compiler-emitted source; no static AST call site exists, so Ariadne cannot link the call sites to the definitions. The double-`ɵ` (U+0275 GREEK SMALL LETTER BARRED O) prefix is Angular's convention for compiler-injected runtime APIs and is exclusive to this dispatch path.

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

export function check_string_keyed_dispatch(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;
  const check_0 = language === "typescript";
  const check_1 = new RegExp("^ɵɵ").test(entry_point.name);
  const check_2 = new RegExp("/packages/core/src/").test(entry_point.file_path);
  return check_0 && check_1 && check_2;
}
