// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// Webpack dependency-template apply() methods invoked via dependencyTemplates.get(constructor).apply(...). Narrowed to JavaScript `apply` methods under lib/dependencies/ to exclude the serializer-registry dispatch pattern (entries 1-3 are serialize() methods dispatched via ObjectMiddleware/ClassSerializer, not the dependencyTemplates Map).

import type { EnrichedEntryPoint, Language } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

export function check_dynamic_dispatch(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
  language: Language,
): boolean {
  void read_file_lines;
  const check_0 = language === "javascript";
  const check_1 = new RegExp("^apply$").test(entry_point.name);
  const check_2 = new RegExp("/lib/dependencies/[^/]+\\.js$").test(entry_point.file_path);
  return check_0 && check_1 && check_2;
}
