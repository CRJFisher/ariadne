// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json; the renderer lives with the deferred actuator.
//
// Reporter class constructors in a test-runner `lib/reporters/` convention directory that have zero resolved inbound callers. Instantiated via dynamic string-keyed dispatch (e.g. `new this._reporter(runner, options)` after `builtinReporters[name]` lookup), so Ariadne sees no direct `new ClassName()` call. Narrow to language=javascript, entry_point name=constructor, path under `/reporters/*.js`, and zero `ariadne_call_refs`.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_dynamic_dispatch_reporter_constructor(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "javascript";
  const check_1 = new RegExp("^constructor$").test(entry_point.name);
  const check_2 = new RegExp("/reporters/[^/]+\\.js$").test(entry_point.file_path);
  const check_3 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  return check_0 && check_1 && check_2 && check_3;
}
