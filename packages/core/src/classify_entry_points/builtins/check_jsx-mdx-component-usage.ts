// AUTO-GENERATED classifier (from the known-issues registry). Do not edit by hand.
// Provenance: rendered from .claude/skills/triage/known_issues/registry.json.
//
// PascalCase exported components defined in .tsx files with zero grep evidence and zero resolved callers. The pattern indicates a React component whose only usage is in an unindexed file type (typically .mdx documentation files), since Ariadne does not include .mdx in SUPPORTED_EXTENSIONS and so neither greps nor parses those files.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";
import { detect_language } from "../extract_entry_point_diagnostics";

export function check_jsx_mdx_component_usage(
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
): boolean {
  void read_file_lines;
  const check_0 = detect_language(entry_point.file_path) === "typescript";
  const check_1 = new RegExp("\\.tsx$").test(entry_point.file_path);
  const check_2 = new RegExp("^[A-Z][A-Za-z0-9_]*$").test(entry_point.name);
  const check_3 = entry_point.diagnostics.diagnosis === "no-textual-callers";
  const check_4 = entry_point.diagnostics.ariadne_call_refs.length <= 0;
  return check_0 && check_1 && check_2 && check_3 && check_4;
}
